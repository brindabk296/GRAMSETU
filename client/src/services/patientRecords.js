const DATABASE_NAME = 'careroute-patient-records';
const DATABASE_VERSION = 1;
const PATIENTS_STORE = 'patients';
const MUTATIONS_STORE = 'mutations';
const SYNC_REQUEST_TIMEOUT_MS = 20000;
let syncInFlight = null;
let syncRetryTimer = null;
let syncRetryAttempt = 0;
let syncState = 'idle';
let syncError = '';

// Mutations queued in this browser belong to the account that created them. Without this, a
// doctor's queued edits were replayed under a patient's token (and vice versa), which the
// server rejected ("Only licensed clinical doctors are authorized") and that blocked the queue.
const decodeSession = (token) => {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(window.atob(payload));
    return claims?.id ? { id: String(claims.id), role: claims.role } : null;
  } catch (error) {
    return null;
  }
};

const currentSession = (token) => {
  let activeToken = token;
  if (!activeToken) {
    try {
      activeToken = window.localStorage.getItem('careroute_token');
    } catch (error) {
      activeToken = null;
    }
  }
  return activeToken ? decodeSession(activeToken) : null;
};

// Queued items from before ownership tracking have no ownerId: patient check-ins can be
// sent by anyone who owns the record; create/update changes can only come from a doctor.
const isOwnedBy = (mutation, session) => {
  if (!session) return false;
  if (mutation.ownerId) return String(mutation.ownerId) === session.id;
  return mutation.type === 'observation' || session.role === 'doctor';
};

const getMyMutations = async (token) => {
  const session = currentSession(token);
  return (await getAllMutations()).filter(mutation => isOwnedBy(mutation, session));
};

const dispatchRecordsUpdated = () => {
  window.dispatchEvent(new CustomEvent('patient-records-updated'));
};

const openDatabase = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('Offline patient records are not supported by this browser.'));
    return;
  }

  const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(PATIENTS_STORE)) {
      database.createObjectStore(PATIENTS_STORE, { keyPath: 'id' });
    }
    if (!database.objectStoreNames.contains(MUTATIONS_STORE)) {
      database.createObjectStore(MUTATIONS_STORE, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Could not open offline patient records.'));
});

const withStore = async (storeName, mode, action) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request;

    try {
      request = action(store);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      database.close();
      resolve(request?.result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Offline patient record operation failed.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Offline patient record operation was cancelled.'));
    };
  });
};

const withStores = async (storeNames, action) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, 'readwrite');
    const stores = Object.fromEntries(storeNames.map(name => [name, transaction.objectStore(name)]));
    try {
      action(stores);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Offline patient record operation failed.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Offline patient record operation was cancelled.'));
    };
  });
};

const withPatientState = async (id, apply) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PATIENTS_STORE, MUTATIONS_STORE], 'readwrite');
    const patients = transaction.objectStore(PATIENTS_STORE);
    const mutations = transaction.objectStore(MUTATIONS_STORE);
    const requests = [
      patients.get(String(id)),
      mutations.get(`create-${id}`),
      mutations.get(`update-${id}`),
      mutations.getAll()
    ];
    const values = [];
    let remaining = requests.length;
    let result;
    let failure;

    requests.forEach((request, index) => {
      request.onsuccess = () => {
        values[index] = request.result;
        remaining -= 1;
        if (remaining !== 0) return;
        try {
          result = apply({
            record: values[0],
            createMutation: values[1],
            updateMutation: values[2],
            allMutations: values[3],
            patients,
            mutations
          });
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
    });

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(failure || transaction.error || new Error('Offline patient record operation failed.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(failure || transaction.error || new Error('Offline patient record operation was cancelled.'));
    };
  });
};

const getRecord = (id) => withStore(PATIENTS_STORE, 'readonly', store => store.get(String(id)));
const getAllRecords = () => withStore(PATIENTS_STORE, 'readonly', store => store.getAll());
const getAllMutations = () => withStore(MUTATIONS_STORE, 'readonly', store => store.getAll());
const putRecord = (record) => withStore(PATIENTS_STORE, 'readwrite', store => store.put(record));

const mergeObservations = (serverObservations = [], localObservations = []) => {
  const merged = new Map();
  for (const observation of serverObservations) {
    merged.set(String(observation._id), observation);
  }
  for (const observation of localObservations) {
    merged.set(String(observation._id), observation);
  }
  return Array.from(merged.values()).sort(
    (left, right) => new Date(left.recordedAt) - new Date(right.recordedAt)
  );
};

export const getPatientSyncStatus = async () => {
  const mutations = await getMyMutations();
  const records = await getAllRecords();
  const conflictedPatientIds = new Set(
    records.filter(record => record.syncConflict).map(record => record.id)
  );
  const failed = mutations.filter(mutation => mutation.failed);
  const waiting = mutations.filter(mutation => !mutation.failed);
  const conflictCount = waiting.filter(mutation =>
    conflictedPatientIds.has(mutation.patientId)
  ).length;
  const pendingCount = waiting.length - conflictCount;
  const failureMessage = failed[0]?.failed?.error || '';
  return {
    pendingCount,
    conflictCount,
    failedCount: failed.length,
    isSyncing: syncState === 'syncing',
    isRetrying: syncState === 'retrying',
    syncError: syncError || failureMessage,
    syncState
  };
};

const mutationForPatient = async (id, type) => {
  const mutations = await getAllMutations();
  return mutations.find(mutation => mutation.patientId === String(id) && mutation.type === type);
};

const hasPendingMutation = async (id) =>
  (await getAllMutations()).some(mutation => mutation.patientId === String(id) && !mutation.failed);

const persistServerPatient = async (patient) => {
  const id = String(patient._id);
  const existing = await getRecord(id);

  if (existing && (await hasPendingMutation(id) || existing.syncConflict)) {
    return existing;
  }

  const record = {
    ...(existing || {}),
    id,
    patient,
    visits: existing?.visits || [],
    observations: existing?.observations || [],
    followups: existing?.followups || [],
    syncStatus: 'synced',
    syncConflict: null,
    updatedAt: Date.now()
  };
  await putRecord(record);
  return record;
};

const networkUnavailable = (error) =>
  !navigator.onLine ||
  error instanceof TypeError ||
  error?.name === 'AbortError' ||
  error?.name === 'TimeoutError';

const fetchForSync = async (url, options) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SYNC_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error('Patient record synchronization timed out.');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

const authHeaders = (token, json = false) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});

export const createLocalPatientId = () => {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

// credentials ({ loginPassword, email }) are kept only on the queued request, never on the
// stored patient record, and are discarded once the server accepts or rejects the request.
export const createPatientRecord = async (patient, token, credentials) => {
  const id = String(patient._id || createLocalPatientId());
  const completePatient = {
    ...patient,
    _id: id,
    assignedDoctorId: patient.assignedDoctorId || '',
    patientId: patient.patientId || `PT-${String(patient.district || 'RNC').slice(0, 3).toUpperCase()}-${id.toUpperCase()}`,
    version: 1
  };
  const record = {
    id,
    patient: completePatient,
    visits: [],
    observations: [],
    followups: [],
    syncStatus: 'pending',
    syncConflict: null,
    updatedAt: Date.now()
  };

  await withStores([PATIENTS_STORE, MUTATIONS_STORE], stores => {
    stores[PATIENTS_STORE].put(record);
    stores[MUTATIONS_STORE].put({
      id: `create-${id}`,
      type: 'create',
      patientId: id,
      ownerId: currentSession(token)?.id,
      payload: completePatient,
      ...(credentials ? { credentials } : {}),
      createdAt: Date.now()
    });
  });
  dispatchRecordsUpdated();
  await syncPendingPatientRecords(token);
  return (await getRecord(id)) || record;
};

export const getCreateFailure = async (id) => {
  const mutation = (await getAllMutations()).find(item => item.id === `create-${id}`);
  return mutation?.failed?.error || '';
};

export const updatePatientRecord = async (id, changes, token) => {
  const key = String(id);
  await withPatientState(key, ({ record, createMutation, updateMutation, patients, mutations }) => {
    if (!record) throw new Error('Patient record is not available on this device.');
    if (record.syncConflict) {
      throw new Error('This patient record has an unresolved sync conflict. Review both versions before editing again.');
    }

    const patient = { ...record.patient, ...changes };
    if (createMutation) {
      mutations.put({
        ...createMutation,
        payload: patient,
        revision: (createMutation.revision || 0) + 1
      });
    } else {
      mutations.put({
        id: `update-${key}`,
        type: 'update',
        patientId: key,
        ownerId: currentSession(token)?.id,
        baseVersion: updateMutation?.baseVersion ?? record.patient.version ?? 1,
        changes: { ...(updateMutation?.changes || {}), ...changes },
        createdAt: updateMutation?.createdAt || Date.now(),
        revision: (updateMutation?.revision || 0) + 1
      });
    }

    const updatedRecord = {
      ...record,
      patient,
      syncStatus: 'pending',
      updatedAt: Date.now()
    };
    patients.put(updatedRecord);
    return updatedRecord;
  });

  dispatchRecordsUpdated();
  await syncPendingPatientRecords(token);
  return (await getRecord(key));
};

export const resolvePatientConflict = async (id, resolution, token) => {
  const key = String(id);
  await withPatientState(key, ({ record, updateMutation, allMutations, patients, mutations }) => {
    if (!record?.syncConflict || !updateMutation) {
      throw new Error('There is no pending patient update conflict to resolve.');
    }

    const serverPatient = record.syncConflict.server;
    if (resolution === 'server') {
      mutations.delete(updateMutation.id);
      const hasPendingMutations = allMutations.some(item =>
        item.patientId === key && item.id !== updateMutation.id && !item.failed
      );
      const localTime = record.patient.latestVitals?.recordedAt
        ? new Date(record.patient.latestVitals.recordedAt)
        : null;
      const serverTime = serverPatient.latestVitals?.recordedAt
        ? new Date(serverPatient.latestVitals.recordedAt)
        : null;
      const resolvedPatient = localTime && (!serverTime || localTime > serverTime)
        ? { ...serverPatient, latestVitals: record.patient.latestVitals }
        : serverPatient;
      patients.put({
        ...record,
        patient: resolvedPatient,
        syncStatus: hasPendingMutations ? 'pending' : 'synced',
        syncConflict: null,
        updatedAt: Date.now()
      });
    } else if (resolution === 'merge-local-changes') {
      mutations.put({
        ...updateMutation,
        baseVersion: serverPatient.version,
        createdAt: Date.now(),
        revision: (updateMutation.revision || 0) + 1
      });
      patients.put({
        ...record,
        patient: { ...serverPatient, ...updateMutation.changes },
        syncStatus: 'pending',
        syncConflict: null,
        updatedAt: Date.now()
      });
    } else {
      throw new Error('Choose either the server version or apply the saved local changes.');
    }
  });

  if (resolution === 'merge-local-changes') {
    await syncPendingPatientRecords(token);
  } else if (resolution !== 'server') {
    throw new Error('Choose either the server version or apply the saved local changes.');
  }

  dispatchRecordsUpdated();
  return getRecord(key);
};

const syncPendingPatientRecordsImpl = async (token) => {
  if (!token || !navigator.onLine) return 'retry';

  const mutations = (await getMyMutations(token))
    .filter(mutation => !mutation.failed)
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const mutation of mutations) {
    try {
      const currentRecord = await getRecord(mutation.patientId);
      if (mutation.type === 'update' && currentRecord?.syncConflict) continue;

      const creating = mutation.type === 'create';
      const observing = mutation.type === 'observation';
      const response = await fetchForSync(
        creating
          ? '/api/auth/register/patient'
          : observing
            ? `/api/patients/${mutation.patientId}/observations`
            : `/api/patients/${mutation.patientId}`,
        {
          method: creating || observing ? 'POST' : 'PATCH',
          headers: authHeaders(token, true),
          body: JSON.stringify(
            creating
              ? { ...mutation.payload, ...(mutation.credentials || {}) }
              : observing
                ? mutation.payload
                : { expectedVersion: mutation.baseVersion, changes: mutation.changes }
          )
        }
      );
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        return 'retry';
      }
      if (response.status === 401) return 'retry';
      const result = await response.json().catch(() => ({}));

      if (response.status === 409 && !creating && !observing) {
        await withPatientState(mutation.patientId, ({ record, patients }) => {
          if (!record) return;
          patients.put({
            ...record,
            syncStatus: 'conflict',
            syncConflict: { local: record.patient, server: result.patient },
            updatedAt: Date.now()
          });
        });
        dispatchRecordsUpdated();
        continue;
      }

      if (!response.ok) {
        // The server understood the request and refused it (validation, access, missing record).
        // Retrying cannot succeed, so park this one change instead of blocking every other change.
        await withStore(MUTATIONS_STORE, 'readwrite', store => store.put({
          ...mutation,
          credentials: undefined,
          failed: {
            status: response.status,
            error: result.error || 'The server rejected this saved change.',
            at: Date.now()
          }
        }));
        dispatchRecordsUpdated();
        continue;
      }

      let hasConflict = false;
      await withPatientState(
        mutation.patientId,
        ({ record, createMutation, updateMutation, allMutations, patients, mutations: mutationStore }) => {
          const currentMutation = creating ? createMutation : observing ? null : updateMutation;
          let observations = record?.observations || [];
          if (observing && record && result.observation) {
            const savedObservation = result.observation;
            const existingIndex = observations.findIndex(item =>
              String(item._id) === String(savedObservation._id)
            );
            observations = existingIndex < 0
              ? [...observations, savedObservation]
              : observations.map((item, index) => index === existingIndex ? savedObservation : item);
          }

          let nextUpdate = null;
          let nextPatient = null;
          if (creating && currentMutation &&
            JSON.stringify(currentMutation.payload) !== JSON.stringify(mutation.payload)) {
            const editableFields = new Set([
              'name', 'age', 'sex', 'contactPhone', 'district', 'village', 'villageCode', 'conditions', 'allergies'
            ]);
            const changes = Object.fromEntries(
              Object.entries(currentMutation.payload).filter(([field, value]) =>
                editableFields.has(field) &&
                JSON.stringify(value) !== JSON.stringify(mutation.payload[field])
              )
            );
            if (Object.keys(changes).length > 0) {
              nextUpdate = {
                id: `update-${mutation.patientId}`,
                type: 'update',
                patientId: mutation.patientId,
                ownerId: mutation.ownerId,
                baseVersion: result.patientProfile.version || 1,
                changes,
                createdAt: Date.now(),
                revision: 1
              };
              nextPatient = { ...result.patientProfile, ...changes };
            }
          } else if (!creating && !observing && currentMutation &&
            (currentMutation.revision || 0) !== (mutation.revision || 0)) {
            const changes = Object.fromEntries(
              Object.entries(currentMutation.changes || {}).filter(([field, value]) =>
                JSON.stringify(value) !== JSON.stringify((mutation.changes || {})[field])
              )
            );
            if (Object.keys(changes).length > 0) {
              nextUpdate = {
                ...currentMutation,
                baseVersion: result.patient.version,
                changes,
                createdAt: Date.now()
              };
              nextPatient = { ...result.patient, ...changes };
            }
          }

          if (currentMutation) mutationStore.delete(mutation.id);
          if (nextUpdate) mutationStore.put(nextUpdate);
          const remainingMutations = allMutations.filter(item => item.id !== mutation.id);
          if (nextUpdate) {
            const existingIndex = remainingMutations.findIndex(item => item.id === nextUpdate.id);
            if (existingIndex < 0) remainingMutations.push(nextUpdate);
            else remainingMutations[existingIndex] = nextUpdate;
          }
          const hasPendingMutations = remainingMutations.some(item =>
            item.patientId === mutation.patientId && !item.failed
          );
          const syncedPatient = creating
            ? nextPatient || result.patientProfile
            : observing
              ? {
                ...record?.patient,
                latestVitals: result.patient?.latestVitals || record?.patient?.latestVitals
              }
              : nextPatient || result.patient;
          const localLatestAt = record?.patient?.latestVitals?.recordedAt
            ? new Date(record.patient.latestVitals.recordedAt)
            : null;
          const serverLatestAt = syncedPatient?.latestVitals?.recordedAt
            ? new Date(syncedPatient.latestVitals.recordedAt)
            : null;
          if (record?.patient && localLatestAt && (!serverLatestAt || localLatestAt > serverLatestAt)) {
            syncedPatient.latestVitals = record.patient.latestVitals;
          }
          hasConflict = Boolean(record?.syncConflict);
          patients.put({
            ...(record || {}),
            id: mutation.patientId,
            patient: { ...syncedPatient, syncStatus: 'synced' },
            visits: record?.visits || [],
            observations,
            followups: record?.followups || [],
            syncStatus: hasConflict
              ? 'conflict'
              : hasPendingMutations ? 'pending' : 'synced',
            syncConflict: record?.syncConflict || null,
            updatedAt: Date.now()
          });
        }
      );
      dispatchRecordsUpdated();
      if (hasConflict) continue;
    } catch (error) {
      if (networkUnavailable(error)) return 'retry';
      throw error;
    }
  }

  return 'complete';
};

const scheduleSyncRetry = (token) => {
  if (syncRetryTimer || !token) return;
  const delay = Math.min(2000 * (2 ** syncRetryAttempt), 30000);
  syncRetryAttempt = Math.min(syncRetryAttempt + 1, 5);
  syncRetryTimer = window.setTimeout(() => {
    syncRetryTimer = null;
    syncPendingPatientRecords(token).catch(error => {
      console.error('Patient record synchronization failed:', error);
    });
  }, delay);
};

export const syncPendingPatientRecords = async (token) => {
  if (!token || !navigator.onLine) return;
  if (syncInFlight) return syncInFlight;
  if (syncRetryTimer) {
    window.clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
  }
  syncState = 'syncing';
  syncError = '';
  dispatchRecordsUpdated();
  syncInFlight = (async () => {
    try {
      const result = await syncPendingPatientRecordsImpl(token);
      const mutations = await getMyMutations(token);
      const records = await getAllRecords();
      const conflicts = new Set(records.filter(record => record.syncConflict).map(record => record.id));
      const retryableMutations = mutations.filter(mutation =>
        !mutation.failed &&
        !(mutation.type === 'update' && conflicts.has(mutation.patientId))
      );
      if (retryableMutations.length > 0) {
        syncState = 'retrying';
        scheduleSyncRetry(token);
      } else {
        syncState = 'idle';
        syncRetryAttempt = 0;
      }
    } catch (error) {
      syncState = 'error';
      syncError = error.message || 'Patient record synchronization failed.';
      if (networkUnavailable(error)) {
        syncState = 'retrying';
        scheduleSyncRetry(token);
      }
      throw error;
    }
  })();
  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
    dispatchRecordsUpdated();
  }
};

const isRecordAssignedTo = (patient, access) => {
  if (!access) return false;
  if (access.role === 'patient') return String(patient.userId || '') === String(access.userId || '');
  if (access.role === 'doctor') return String(patient.assignedDoctorId || '') === String(access.doctorProfileId || '');
  return false;
};

export const recordPatientObservation = async (id, observation, token, access, options = {}) => {
  const key = String(id);
  let record = await getRecord(key);
  if (!record && navigator.onLine) {
    await getPatientRecord(key, token, access);
    record = await getRecord(key);
  }
  if (!record || !isRecordAssignedTo(record.patient, access)) {
    throw new Error('This patient record is not available on this device or is assigned to another doctor.');
  }

  const payload = {
    ...observation,
    _id: createLocalPatientId(),
    patientId: key,
    recordedAt: new Date().toISOString()
  };
  await withPatientState(key, ({ record: currentRecord, patients, mutations }) => {
    if (!currentRecord || !isRecordAssignedTo(currentRecord.patient, access)) {
      throw new Error('This patient record is not available on this device or is assigned to another doctor.');
    }

    const updatedPatient = {
      ...currentRecord.patient,
      latestVitals: { ...(currentRecord.patient.latestVitals || {}) }
    };
    const recordedAt = new Date(payload.recordedAt);
    const latestRecordedAt = updatedPatient.latestVitals.recordedAt
      ? new Date(updatedPatient.latestVitals.recordedAt)
      : null;
    if (!latestRecordedAt || recordedAt >= latestRecordedAt) {
      const latestFields = {
        bp_systolic: 'systolicBP',
        bp_diastolic: 'diastolicBP',
        blood_glucose: 'bloodGlucose',
        heart_rate: 'heartRate',
        weight: 'weightKg'
      };
      const field = latestFields[payload.type];
      if (field) updatedPatient.latestVitals[field] = Number(payload.value);
      updatedPatient.latestVitals.recordedAt = payload.recordedAt;
    }

    mutations.put({
      id: `observation-${payload._id}`,
      type: 'observation',
      patientId: key,
      ownerId: currentSession(token)?.id || access?.userId,
      payload,
      createdAt: Date.now()
    });
    const updatedRecord = {
      ...currentRecord,
      patient: updatedPatient,
      observations: [...(currentRecord.observations || []), payload],
      syncStatus: 'pending',
      updatedAt: Date.now()
    };
    patients.put(updatedRecord);
    return updatedRecord;
  });
  dispatchRecordsUpdated();
  // The reading is already safely stored on this device; a sync problem must not make the
  // save look like it failed. The status pill in the header reports sync trouble instead.
  if (options.sync !== false) {
    await syncPendingPatientRecords(token).catch(error => {
      console.error('Patient record synchronization failed:', error);
    });
  }
  return getRecord(key);
};

export const getPatientRecords = async (filters, token, access) => {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  let serverPatients;
  try {
    if (!navigator.onLine) throw new TypeError('Offline');
    const response = await fetch(`/api/patients?${params.toString()}`, {
      headers: authHeaders(token)
    });
    if (!response.ok) throw new Error('Failed to retrieve patient records.');
    serverPatients = await response.json();
  } catch (error) {
    if (!networkUnavailable(error)) throw error;
    return filterPatients((await getAllRecords())
      .filter(record => isRecordAssignedTo(record.patient, access))
      .map(record => ({
        ...record.patient,
        syncStatus: record.syncStatus,
        syncConflict: record.syncConflict
      })), filters);
  }

  const merged = new Map();
  for (const patient of serverPatients) {
    const record = await persistServerPatient(patient);
    merged.set(String(patient._id), {
      ...record.patient,
      syncStatus: record.syncStatus,
      syncConflict: record.syncConflict
    });
  }
  for (const record of await getAllRecords()) {
    if (isRecordAssignedTo(record.patient, access) &&
      (record.syncStatus !== 'synced' || record.syncConflict)) {
      merged.set(record.id, {
        ...record.patient,
        syncStatus: record.syncStatus,
        syncConflict: record.syncConflict
      });
    }
  }
  return filterPatients(Array.from(merged.values()), filters);
};

export const preparePatientRecordsForOffline = async (patients, token, access, onProgress) => {
  if (!navigator.onLine) {
    throw new Error('Connect to the internet before preparing records for offline use.');
  }

  let completed = 0;
  let nextIndex = 0;
  const workerCount = Math.min(4, patients.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < patients.length) {
      const patient = patients[nextIndex++];
      await getPatientRecord(patient._id, token, access);
      completed += 1;
      onProgress?.(completed, patients.length);
    }
  });
  const results = await Promise.allSettled(workers);
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
  return completed;
};

const filterPatients = (patients, filters = {}) => patients.filter(patient => {
  if (filters.district && filters.district !== 'all' && patient.district?.toLowerCase() !== filters.district.toLowerCase()) return false;
  if (filters.village && filters.village !== 'all' && patient.village?.toLowerCase() !== filters.village.toLowerCase()) return false;
  if (filters.riskTier && filters.riskTier !== 'all' && patient.riskTier !== filters.riskTier) return false;
  if (filters.search) {
    const query = filters.search.toLowerCase();
    if (!patient.name?.toLowerCase().includes(query) && !patient.patientId?.toLowerCase().includes(query)) return false;
  }
  return true;
});

export const getPatientRecord = async (id, token, access) => {
  try {
    if (!navigator.onLine) throw new TypeError('Offline');
    const response = await fetch(`/api/patients/${id}`, {
      headers: authHeaders(token)
    });
    if (!response.ok) {
      const result = await response.json();
      if (response.status === 404 && await mutationForPatient(String(id), 'create')) {
        const pendingRecord = await getRecord(String(id));
        if (pendingRecord && isRecordAssignedTo(pendingRecord.patient, access)) {
          return {
            patient: { ...pendingRecord.patient, syncStatus: pendingRecord.syncStatus },
            visits: pendingRecord.visits || [],
            observations: pendingRecord.observations || [],
            followups: pendingRecord.followups || []
          };
        }
      }
      throw new Error(result.error || 'Failed to retrieve patient record.');
    }
    const data = await response.json();
    if (!isRecordAssignedTo(data.patient, access)) {
      throw new Error('You do not have access to this patient record.');
    }
    const record = await persistServerPatient(data.patient);
    const hasPending = await hasPendingMutation(String(id));
    const localRecord = await getRecord(String(id));
    const preserved = {
      ...(hasPending || record.syncConflict ? localRecord : record),
      visits: data.visits || [],
      observations: mergeObservations(data.observations || [], localRecord?.observations || []),
      followups: data.followups || []
    };
    if (preserved) await putRecord(preserved);
    return {
      patient: {
        ...preserved.patient,
        syncStatus: preserved.syncStatus,
        syncConflict: preserved.syncConflict
      },
      visits: preserved.visits || data.visits || [],
      observations: preserved.observations || data.observations || [],
      followups: preserved.followups || data.followups || []
    };
  } catch (error) {
    if (!networkUnavailable(error)) throw error;
    const record = await getRecord(String(id));
    if (!record || !isRecordAssignedTo(record.patient, access)) {
      throw new Error('This patient record has not been downloaded to this device or is assigned to another doctor.');
    }
    return {
      patient: { ...record.patient, syncStatus: record.syncStatus, syncConflict: record.syncConflict },
      visits: record.visits || [],
      observations: record.observations || [],
      followups: record.followups || []
    };
  }
};
