const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PatientProfile = require('../models/PatientProfile');
const Observation = require('../models/Observation');
const Visit = require('../models/Visit');
const FollowUp = require('../models/FollowUp');
const districtsData = require('../data/districtsVillages');
const { authenticate } = require('../middleware/auth');
const { requireVerifiedDoctor } = require('../middleware/doctorVerified');
const { getStatus, memoryStore } = require('../db');
const { findPatient, authorizePatientAccess } = require('../middleware/patientAccess');

// Apply an offline edit only when it was based on the latest server version.
router.patch('/:id', authenticate, requireVerifiedDoctor, async (req, res) => {
  try {
    const { isConnected } = getStatus();

    if (isConnected && !mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient record identifier.' });
    }

    const { expectedVersion, changes } = req.body;
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1 || !changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return res.status(400).json({ error: 'A valid expected version and patient changes are required.' });
    }

    const update = {};
    if (changes.name !== undefined) {
      if (typeof changes.name !== 'string' || !changes.name.trim()) return res.status(400).json({ error: 'Patient name cannot be empty.' });
      update.name = changes.name.trim();
    }
    if (changes.age !== undefined) {
      if (!Number.isFinite(Number(changes.age)) || Number(changes.age) <= 0) return res.status(400).json({ error: 'Patient age must be a positive number.' });
      update.age = Number(changes.age);
    }
    if (changes.sex !== undefined) {
      if (!['Female', 'Male', 'Other'].includes(changes.sex)) return res.status(400).json({ error: 'Patient sex is invalid.' });
      update.sex = changes.sex;
    }
    for (const field of ['district', 'village']) {
      if (changes[field] !== undefined) {
        if (typeof changes[field] !== 'string' || !changes[field].trim()) return res.status(400).json({ error: `Patient ${field} cannot be empty.` });
        update[field] = changes[field].trim();
      }
    }
    if (changes.contactPhone !== undefined) {
      if (typeof changes.contactPhone !== 'string') return res.status(400).json({ error: 'Contact phone must be text.' });
      update.contactPhone = changes.contactPhone.trim();
    }
    if (changes.villageCode !== undefined) {
      if (typeof changes.villageCode !== 'string') return res.status(400).json({ error: 'Village code must be text.' });
      update.villageCode = changes.villageCode.trim();
    }
    if (changes.conditions !== undefined) {
      if (!Array.isArray(changes.conditions)) return res.status(400).json({ error: 'Conditions must be a list.' });
      update.conditions = changes.conditions
        .map(condition => typeof condition === 'string' ? { name: condition.trim(), status: 'active' } : condition)
        .filter(condition => condition && typeof condition.name === 'string' && condition.name.trim())
        .map(condition => ({ ...condition, name: condition.name.trim() }));
    }
    if (changes.allergies !== undefined) {
      if (!Array.isArray(changes.allergies) || changes.allergies.some(allergy => typeof allergy !== 'string')) {
        return res.status(400).json({ error: 'Allergies must be a list of text values.' });
      }
      update.allergies = changes.allergies.map(allergy => allergy.trim()).filter(Boolean);
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No editable patient fields were provided.' });
    }

    const assignedPatient = await findPatient(req.params.id);
    if (!assignedPatient) return res.status(404).json({ error: 'Patient record not found.' });
    if (String(assignedPatient.assignedDoctorId || '') !== String(req.doctorProfile._id)) {
      return res.status(403).json({ error: 'This patient record is assigned to another doctor.' });
    }

    // Only validate the location against the census directory when it actually changed, so
    // existing records (e.g. legacy village codes) can still have other fields edited.
    const sameText = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
    const locationChanged =
      (update.district !== undefined && !sameText(update.district, assignedPatient.district)) ||
      (update.village !== undefined && !sameText(update.village, assignedPatient.village)) ||
      (update.villageCode !== undefined && !sameText(update.villageCode, assignedPatient.villageCode));

    if (locationChanged) {
      const districtName = update.district || assignedPatient.district;
      const villageName = update.village || assignedPatient.village;
      const district = districtsData.find(item =>
        item.districtId.toLowerCase() === String(districtName).toLowerCase() ||
        item.districtName.toLowerCase() === String(districtName).toLowerCase()
      );
      const village = district?.villages.find(item =>
        item.name.toLowerCase() === String(villageName).toLowerCase() &&
        (!update.villageCode || item.villageCode === update.villageCode)
      );
      if (!district || !village) {
        return res.status(400).json({ error: 'Choose a village that belongs to the selected district.' });
      }
      update.district = district.districtId;
      update.village = village.name;
      update.villageCode = village.villageCode;
    }

    // Local (no-database) mode: apply the edit to the server's in-memory store.
    if (!isConnected) {
      const stored = memoryStore.patients.find(item => String(item._id) === String(assignedPatient._id));
      if (!stored) return res.status(404).json({ error: 'Patient record not found.' });
      const currentVersion = Number.isInteger(stored.version) ? stored.version : 1;
      if (currentVersion !== expectedVersion) {
        return res.status(409).json({
          error: 'The patient record changed on the server. Your local edit has been preserved for review.',
          patient: stored
        });
      }
      Object.assign(stored, update, { version: currentVersion + 1 });
      return res.json({ patient: stored, durable: true });
    }

    const versionCondition = expectedVersion === 1
      ? { $or: [{ version: 1 }, { version: { $exists: false } }] }
      : { version: expectedVersion };
    const patient = await PatientProfile.findOneAndUpdate(
      { _id: req.params.id, assignedDoctorId: req.doctorProfile._id, ...versionCondition },
      { $set: update, $inc: { version: 1 } },
      { new: true, runValidators: true }
    );

    if (!patient) {
      const currentPatient = await PatientProfile.findById(req.params.id);
      if (!currentPatient) return res.status(404).json({ error: 'Patient record not found.' });
      return res.status(409).json({
        error: 'The patient record changed on the server. Your local edit has been preserved for review.',
        patient: currentPatient
      });
    }

    return res.json({ patient, durable: true });
  } catch (err) {
    console.error('Update patient record error:', err);
    return res.status(500).json({ error: 'Failed to update patient record.' });
  }
});

// 1. GET patients list with filtering by district, village, search, and risk tier
// PROTECTED: Only verified doctors can browse rural circuit patients!
router.get('/', authenticate, requireVerifiedDoctor, async (req, res) => {
  try {
    const { district, village, search, riskTier } = req.query;
    const { isConnected } = getStatus();

    let patients = [];

    if (isConnected) {
      const query = { assignedDoctorId: req.doctorProfile._id };
      if (district && district !== 'all') query.district = district;
      if (village && village !== 'all') query.village = village;
      if (riskTier && riskTier !== 'all') query.riskTier = riskTier;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { patientId: { $regex: search, $options: 'i' } }
        ];
      }
      patients = await PatientProfile.find(query).sort({ riskScore: -1 });
    } else {
      patients = memoryStore.patients.filter(p => {
        if (String(p.assignedDoctorId || '') !== String(req.doctorProfile._id)) return false;
        if (district && district !== 'all' && p.district.toLowerCase() !== district.toLowerCase()) return false;
        if (village && village !== 'all' && p.village.toLowerCase() !== village.toLowerCase()) return false;
        if (riskTier && riskTier !== 'all' && p.riskTier !== riskTier) return false;
        if (search) {
          const s = search.toLowerCase();
          return p.name.toLowerCase().includes(s) || p.patientId.toLowerCase().includes(s);
        }
        return true;
      });
      patients.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
    }

    res.json(patients);
  } catch (err) {
    console.error('Fetch patients error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient registry.' });
  }
});

// 2. GET patient full detail (Profile + Timeline + Visits + Observations)
// PROTECTED: Requires verified doctor OR the patient themselves viewing their own record!
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { isConnected } = getStatus();
    const patientId = req.params.id;

    let patient = null;
    let visits = [];
    let observations = [];
    let followups = [];

    if (isConnected) {
      if (!mongoose.isValidObjectId(patientId)) {
        return res.status(404).json({ error: 'Patient record not found.' });
      }
      patient = await PatientProfile.findById(patientId);
      if (patient) {
        visits = await Visit.find({ patientId: patient._id }).sort({ date: -1 });
        observations = await Observation.find({ patientId: patient._id }).sort({ recordedAt: 1 });
        followups = await FollowUp.find({ patientId: patient._id }).sort({ dueDate: 1 });
      }
    } else {
      patient = await findPatient(patientId);
      if (patient) {
        visits = memoryStore.visits.filter(v => String(v.patientId) === String(patient._id));
        observations = memoryStore.observations.filter(o => String(o.patientId) === String(patient._id));
        followups = memoryStore.followups.filter(f => String(f.patientId) === String(patient._id));
      }
    }

    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found.' });
    }

    if (!await authorizePatientAccess(req, patient)) {
      return res.status(403).json({
        error: 'Access denied. Doctors can only view records assigned to them; patients can only view their own records.'
      });
    }

    res.json({
      patient,
      visits,
      observations,
      followups
    });
  } catch (err) {
    console.error('Fetch patient detail error:', err);
    res.status(500).json({ error: 'Failed to fetch patient detail.' });
  }
});

// 3. POST new reading / observation (e.g. Health worker reading, doctor observation, or patient check-in)
router.post('/:id/observations', authenticate, async (req, res) => {
  try {
    const { isConnected } = getStatus();
    const patientId = req.params.id;
    const { type, value, unit, source, notes, recordedAt } = req.body;

    if (!type || value === undefined) {
      return res.status(400).json({ error: 'Observation type and value are required.' });
    }

    const patient = await findPatient(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient record not found.' });
    if (!await authorizePatientAccess(req, patient)) {
      return res.status(403).json({ error: 'Access denied. You cannot update this patient record.' });
    }

    const observationId = mongoose.isValidObjectId(req.body._id)
      ? new mongoose.Types.ObjectId(req.body._id)
      : new mongoose.Types.ObjectId();
    const observationTime = recordedAt ? new Date(recordedAt) : new Date();
    if (Number.isNaN(observationTime.getTime())) {
      return res.status(400).json({ error: 'Observation timestamp is invalid.' });
    }

    // Plausibility check (from blueprint 10.6: reject implausible values like BP 1400)
    const numVal = Number(value);
    if (type.includes('bp') && (numVal < 40 || numVal > 300)) {
      return res.status(400).json({ error: `Plausibility check failed: BP value ${numVal} mmHg is outside physiological range (40 - 300).` });
    }
    if (type.includes('glucose') && (numVal < 20 || numVal > 800)) {
      return res.status(400).json({ error: `Plausibility check failed: Glucose value ${numVal} mg/dL is outside physiological range (20 - 800).` });
    }

    const newObs = {
      _id: observationId,
      patientId: new mongoose.Types.ObjectId(patientId),
      type,
      value: numVal,
      unit: unit || (type.includes('bp') ? 'mmHg' : type.includes('glucose') ? 'mg/dL' : 'kg'),
      source: source || (req.user.role === 'patient' ? 'patient_checkin' : 'doctor_visit'),
      notes: notes || '',
      recordedAt: observationTime
    };

    let updatedPatient = patient;
    if (isConnected) {
      const existingObservation = await Observation.findById(observationId);
      if (!existingObservation) await Observation.create(newObs);
      // Update patient latest vitals
      const updateField = {};
      if (type === 'bp_systolic') updateField['latestVitals.systolicBP'] = numVal;
      if (type === 'bp_diastolic') updateField['latestVitals.diastolicBP'] = numVal;
      if (type === 'blood_glucose') updateField['latestVitals.bloodGlucose'] = numVal;
      if (type === 'weight') updateField['latestVitals.weightKg'] = numVal;
      if (type === 'heart_rate') updateField['latestVitals.heartRate'] = numVal;

      updatedPatient = await PatientProfile.findOneAndUpdate(
        {
          _id: patientId,
          $or: [
            { 'latestVitals.recordedAt': { $lte: observationTime } },
            { 'latestVitals.recordedAt': { $exists: false } }
          ]
        },
        { $set: { ...updateField, 'latestVitals.recordedAt': observationTime } },
        { new: true }
      ) || await PatientProfile.findById(patientId);
    } else {
      const existingObservation = memoryStore.observations.find(item =>
        String(item._id) === String(observationId)
      );
      if (!existingObservation) memoryStore.observations.push(newObs);
      const patient = memoryStore.patients.find(p => String(p._id) === String(patientId));
      if (patient && (!patient.latestVitals?.recordedAt ||
        new Date(patient.latestVitals.recordedAt) <= observationTime)) {
        if (!patient.latestVitals) patient.latestVitals = {};
        if (type === 'bp_systolic') patient.latestVitals.systolicBP = numVal;
        if (type === 'bp_diastolic') patient.latestVitals.diastolicBP = numVal;
        if (type === 'blood_glucose') patient.latestVitals.bloodGlucose = numVal;
        if (type === 'weight') patient.latestVitals.weightKg = numVal;
        if (type === 'heart_rate') patient.latestVitals.heartRate = numVal;
        patient.latestVitals.recordedAt = observationTime;
      }
      updatedPatient = patient;
    }

    res.status(201).json({
      message: 'Observation recorded successfully.',
      observation: newObs,
      patient: updatedPatient,
      durable: isConnected
    });
  } catch (err) {
    console.error('Add observation error:', err);
    res.status(500).json({ error: 'Failed to record observation.' });
  }
});

// 4. POST record a new consultation visit
router.post('/:id/visits', authenticate, requireVerifiedDoctor, async (req, res) => {
  try {
    const { isConnected } = getStatus();
    const patientId = req.params.id;
    const {
      symptoms,
      systolicBP,
      diastolicBP,
      bloodGlucose,
      heartRate,
      weightKg,
      doctorNotes,
      voiceNoteTranscript,
      prescriptions,
      clinicalPlan,
      village,
      district,
      nextFollowUpDays
    } = req.body;

    if (!Array.isArray(prescriptions) || prescriptions.some(prescription =>
      !prescription || [
        'medicine',
        'dosage',
        'frequency',
        'purpose',
        'instructions'
      ].some(field => typeof prescription[field] !== 'string' || !prescription[field].trim())
    )) {
      return res.status(400).json({
        error: 'Each prescribed medicine needs its name, dose, schedule, purpose, and directions.'
      });
    }

    const newVisit = {
      _id: new mongoose.Types.ObjectId(),
      patientId: new mongoose.Types.ObjectId(patientId),
      doctorId: req.doctorProfile?._id,
      doctorName: req.doctorProfile?.name || req.user.name,
      village: village || 'Angara',
      district: district || 'ranchi',
      date: new Date(),
      symptoms: Array.isArray(symptoms) ? symptoms : (symptoms ? [symptoms] : []),
      vitals: {
        systolicBP: Number(systolicBP) || 120,
        diastolicBP: Number(diastolicBP) || 80,
        bloodGlucose: Number(bloodGlucose) || 110,
        heartRate: Number(heartRate) || 72,
        weightKg: Number(weightKg) || 60
      },
      doctorNotes: doctorNotes || '',
      voiceNoteTranscript: voiceNoteTranscript || '',
      prescriptions: prescriptions.map(prescription => ({
        medicine: prescription.medicine.trim(),
        dosage: prescription.dosage.trim(),
        frequency: prescription.frequency.trim(),
        purpose: prescription.purpose.trim(),
        instructions: prescription.instructions.trim()
      })),
      clinicalPlan: clinicalPlan || '',
      source: 'doctor_visit',
      isOfflineSynced: true
    };

    const patient = await findPatient(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient record not found.' });
    if (String(patient.assignedDoctorId || '') !== String(req.doctorProfile._id)) {
      return res.status(403).json({ error: 'This patient record is assigned to another doctor.' });
    }

    // Also record discrete observations
    const newObservations = [
      {
        _id: new mongoose.Types.ObjectId(),
        patientId: new mongoose.Types.ObjectId(patientId),
        type: 'bp_systolic',
        value: Number(systolicBP) || 120,
        unit: 'mmHg',
        source: 'doctor_visit',
        recordedAt: new Date()
      },
      {
        _id: new mongoose.Types.ObjectId(),
        patientId: new mongoose.Types.ObjectId(patientId),
        type: 'bp_diastolic',
        value: Number(diastolicBP) || 80,
        unit: 'mmHg',
        source: 'doctor_visit',
        recordedAt: new Date()
      }
    ];

    if (bloodGlucose) {
      newObservations.push({
        _id: new mongoose.Types.ObjectId(),
        patientId: new mongoose.Types.ObjectId(patientId),
        type: 'blood_glucose',
        value: Number(bloodGlucose),
        unit: 'mg/dL',
        source: 'doctor_visit',
        recordedAt: new Date()
      });
    }

    if (isConnected) {
      await Visit.create(newVisit);
      await Observation.insertMany(newObservations);

      // Update patient profile
      await PatientProfile.findByIdAndUpdate(patientId, {
        $set: {
          latestVitals: {
            systolicBP: Number(systolicBP),
            diastolicBP: Number(diastolicBP),
            bloodGlucose: Number(bloodGlucose) || 110,
            heartRate: Number(heartRate) || 72,
            weightKg: Number(weightKg) || 60,
            recordedAt: new Date()
          }
        }
      });

      // Optional follow-up creation
      if (nextFollowUpDays) {
        await FollowUp.create({
          patientId: new mongoose.Types.ObjectId(patientId),
          patientName: req.body.patientName || 'Patient',
          village: village || 'Angara',
          district: district || 'ranchi',
          dueDate: new Date(Date.now() + Number(nextFollowUpDays) * 86400000),
          reason: `Routine clinical review after ${nextFollowUpDays} days`,
          priority: Number(systolicBP) > 150 ? 'High' : 'Routine',
          status: 'due',
          assignedDoctorId: req.doctorProfile?._id
        });
      }
    } else {
      memoryStore.visits.push(newVisit);
      memoryStore.observations.push(...newObservations);
      const pat = memoryStore.patients.find(p => String(p._id) === String(patientId));
      if (pat) {
        pat.latestVitals = {
          systolicBP: Number(systolicBP),
          diastolicBP: Number(diastolicBP),
          bloodGlucose: Number(bloodGlucose) || 110,
          heartRate: Number(heartRate) || 72,
          weightKg: Number(weightKg) || 60,
          recordedAt: new Date()
        };
      }
    }

    res.status(201).json({
      message: 'Consultation visit successfully recorded.',
      visit: newVisit
    });
  } catch (err) {
    console.error('Record visit error:', err);
    res.status(500).json({ error: 'Failed to record consultation visit.' });
  }
});

module.exports = router;
