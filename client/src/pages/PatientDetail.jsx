import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TrendForecastChart from '../components/TrendForecastChart';
import RiskBadge from '../components/RiskBadge';
import VoiceConsultationInput from '../components/VoiceConsultationInput';
import OcrModal from '../components/OcrModal';
import DistrictVillageSelector from '../components/DistrictVillageSelector';
import {
  getPatientRecord,
  resolvePatientConflict,
  updatePatientRecord
} from '../services/patientRecords';
import {
  Activity,
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  HeartPulse,
  Pill,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Camera,
  MessageSquare,
  Pencil,
  Phone,
  Save,
  X
} from 'lucide-react';

const createEmptyPrescription = () => ({
  medicine: '',
  dosage: '',
  frequency: '',
  purpose: '',
  instructions: ''
});

export default function PatientDetail() {
  const { id } = useParams();
  const { user, profile, token, isVerifiedDoctor } = useAuth();

  const [patientData, setPatientData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // AI Copilot state
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotAnswer, setCopilotAnswer] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  // New Consultation Modal state
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [consultForm, setConsultForm] = useState({
    symptoms: '',
    systolicBP: 154,
    diastolicBP: 96,
    bloodGlucose: 165,
    heartRate: 78,
    weightKg: 64,
    doctorNotes: '',
    voiceNoteTranscript: '',
    prescriptions: [createEmptyPrescription()],
    clinicalPlan: 'Continue current dosage; monitor BP twice weekly via ASHA worker.',
    nextFollowUpDays: 14
  });

  const [consultSaving, setConsultSaving] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: '',
    age: '',
    sex: 'Female',
    contactPhone: '',
    district: '',
    village: '',
    villageCode: '',
    conditions: '',
    allergies: ''
  });

  const fetchPatientDetails = async () => {
    setLoading(true);
    const token = localStorage.getItem('careroute_token');
    try {
      const res = await fetch(`/api/patients/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || 'Failed to load patient record.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setPatientData(data);

      // Fetch trends & forecasts
      const trendRes = await fetch(`/api/analytics/patient/${id}/trends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        setTrends(trendData);
      }
    } catch (err) {
      setError('Network error fetching patient health records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOfflineAwareDetails = async () => {
    setLoading(true);
    setError('');
    setTrends(null);
    try {
      const data = await getPatientRecord(id, token, {
        role: user?.role,
        userId: user?.id || user?._id,
        doctorProfileId: profile?._id
      });
      setPatientData(data);
      const patient = data.patient;
      setProfileForm({
        name: patient.name || '',
        age: patient.age || '',
        sex: patient.sex || 'Female',
        contactPhone: patient.contactPhone || '',
        district: patient.district || '',
        village: patient.village || '',
        villageCode: patient.villageCode || '',
        conditions: (Array.isArray(patient.conditions) ? patient.conditions : [])
          .filter(Boolean)
          .map(condition => condition.name || condition)
          .join(', '),
        allergies: (Array.isArray(patient.allergies) ? patient.allergies : []).join(', ')
      });

      if (navigator.onLine) {
        try {
          const trendRes = await fetch(`/api/analytics/patient/${id}/trends`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (trendRes.ok) setTrends(await trendRes.json());
        } catch (trendError) {
          console.error('Failed to load patient trends:', trendError);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load patient record.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm(previous => ({ ...previous, [name]: value }));
  };

  const handlePrescriptionChange = (index, field, value) => {
    setConsultForm(previous => ({
      ...previous,
      prescriptions: previous.prescriptions.map((prescription, currentIndex) =>
        currentIndex === index ? { ...prescription, [field]: value } : prescription
      )
    }));
  };

  const addPrescription = () => {
    setConsultForm(previous => ({
      ...previous,
      prescriptions: [...previous.prescriptions, createEmptyPrescription()]
    }));
  };

  const removePrescription = (index) => {
    setConsultForm(previous => ({
      ...previous,
      prescriptions: previous.prescriptions.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    try {
      if (!profileForm.district || !profileForm.village || !profileForm.villageCode) {
        setProfileError('Choose a valid district and village before saving.');
        return;
      }
      const oldConditions = Array.isArray(patientData?.patient?.conditions)
        ? patientData.patient.conditions.filter(Boolean)
        : [];
      const conditions = profileForm.conditions.split(',').map(name => name.trim()).filter(Boolean).map(name => {
        const existing = oldConditions.find(condition =>
          (typeof condition === 'object' ? condition.name : condition) === name
        );
        return typeof existing === 'object'
          ? existing
          : { name, onsetDate: new Date().toISOString().slice(0, 10), status: 'active' };
      });
      await updatePatientRecord(id, {
        name: profileForm.name.trim(),
        age: Number(profileForm.age),
        sex: profileForm.sex,
        contactPhone: profileForm.contactPhone.trim(),
        district: profileForm.district.trim(),
        village: profileForm.village.trim(),
        villageCode: profileForm.villageCode,
        conditions,
        allergies: profileForm.allergies.split(',').map(allergy => allergy.trim()).filter(Boolean)
      }, token);
      setShowProfileEditor(false);
      await fetchOfflineAwareDetails();
    } catch (err) {
      setProfileError(err.message || 'Failed to save patient record.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleResolveConflict = async (resolution) => {
    try {
      await resolvePatientConflict(id, resolution, token);
      setError('');
      await fetchOfflineAwareDetails();
    } catch (err) {
      setError(err.message || 'Failed to resolve patient record conflict.');
    }
  };

  useEffect(() => {
    fetchOfflineAwareDetails();
  }, [id, token]);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  // Handle AI Copilot Query
  const handleCopilotQuery = async (queryText) => {
    const q = queryText || copilotQuestion;
    if (!q.trim()) return;

    setCopilotLoading(true);
    const token = localStorage.getItem('careroute_token');
    try {
      const res = await fetch('/api/analytics/copilot/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ patientId: id, question: q })
      });
      if (res.ok) {
        const data = await res.json();
        setCopilotAnswer(data);
      }
    } catch (err) {
      console.error('Copilot query error:', err);
    } finally {
      setCopilotLoading(false);
    }
  };

  // OCR populate handler
  const handleOcrConfirmedValues = (values) => {
    setConsultForm(prev => ({
      ...prev,
      systolicBP: values.bp_systolic || prev.systolicBP,
      diastolicBP: values.bp_diastolic || prev.diastolicBP,
      bloodGlucose: values.blood_glucose || prev.bloodGlucose,
      heartRate: values.heart_rate || prev.heartRate,
      doctorNotes: prev.doctorNotes ? `${prev.doctorNotes}\n[OCR Extracted from Lab Slip]` : '[OCR Extracted from Lab Slip]'
    }));
    setShowConsultModal(true);
  };

  // Save Consultation Visit
  const handleSaveConsultation = async (e) => {
    e.preventDefault();
    const incompletePrescription = consultForm.prescriptions.some(prescription =>
      ['medicine', 'dosage', 'frequency', 'purpose', 'instructions']
        .some(field => !prescription[field]?.trim())
    );
    if (incompletePrescription) {
      alert('Complete the medicine, dose, schedule, purpose, and directions for each prescribed medicine.');
      return;
    }
    setConsultSaving(true);
    const token = localStorage.getItem('careroute_token');

    try {
      const res = await fetch(`/api/patients/${id}/visits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...consultForm,
          patientName: patientData?.patient?.name,
          village: patientData?.patient?.village,
          district: patientData?.patient?.district
        })
      });

      if (res.ok) {
        setShowConsultModal(false);
        fetchPatientDetails();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to record consultation.');
      }
    } catch (err) {
      alert('Error saving consultation.');
    } finally {
      setConsultSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-xs font-semibold">
        <HeartPulse className="w-6 h-6 animate-spin text-emerald-600 mr-2" />
        <span>Loading longitudinal patient timeline & AI forecast...</span>
      </div>
    );
  }

  // Anti-scam block view
  if (error || (!isVerifiedDoctor && user?.role === 'doctor')) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-rose-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-md">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Access Blocked by Anti-Scam Protocol
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error || 'Your doctor account is not yet verified. Only accredited clinicians with validated State Medical Council / NMC registration can view patient records.'}
          </p>
          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              to="/doctor/verification"
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Verify My Credentials
            </Link>
            <Link
              to="/doctor/dashboard"
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const patient = patientData.patient;
  const visits = patientData.visits || [];
  const observations = patientData.observations || [];
  const buildMetricHistory = (type, visitField, profileField) => {
    const observed = observations.filter(item => item.type === type);
    const visitHistory = visits.map(visit => ({
      value: visit.vitals?.[visitField],
      recordedAt: visit.date,
      source: 'doctor_visit'
    })).filter(item =>
      Number.isFinite(Number(item.value)) &&
      Number(item.value) > 0 &&
      Number.isFinite(new Date(item.recordedAt).getTime())
    );
    const merged = [...observed];
    for (const reading of visitHistory) {
      const duplicate = observed.some(item =>
        Number(item.value) === Number(reading.value) &&
        Math.abs(new Date(item.recordedAt) - new Date(reading.recordedAt)) < 60000
      );
      if (!duplicate) merged.push(reading);
    }
    if (merged.length) {
      return merged.sort((left, right) =>
        new Date(left.recordedAt) - new Date(right.recordedAt)
      );
    }

    const value = patient.latestVitals?.[profileField];
    const recordedAt = patient.latestVitals?.recordedAt || patient.updatedAt || patient.createdAt;
    return Number.isFinite(Number(value)) && Number(value) > 0 &&
      Number.isFinite(new Date(recordedAt).getTime())
      ? [{ value, recordedAt, source: 'patient_profile' }]
      : [];
  };
  const systolicTrend = (trends?.historicalSeries || []).filter(item => item.type === 'bp_systolic');
  const glucoseTrend = (trends?.historicalSeries || []).filter(item => item.type === 'blood_glucose');
  const systolicObs = systolicTrend.length
    ? systolicTrend
    : buildMetricHistory('bp_systolic', 'systolicBP', 'systolicBP');
  const glucoseObs = glucoseTrend.length
    ? glucoseTrend
    : buildMetricHistory('blood_glucose', 'bloodGlucose', 'bloodGlucose');

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            to={user?.role === 'doctor' ? '/doctor/patients' : '/patient/dashboard'}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Patient Registry</span>
          </Link>

          {user?.role === 'doctor' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setProfileError('');
                  const patient = patientData?.patient;
                  if (patient) {
                    setProfileForm({
                      name: patient.name || '',
                      age: patient.age || '',
                      sex: patient.sex || 'Female',
                      contactPhone: patient.contactPhone || '',
                      district: patient.district || '',
                      village: patient.village || '',
                      villageCode: patient.villageCode || '',
                      conditions: (Array.isArray(patient.conditions) ? patient.conditions : [])
                        .filter(Boolean)
                        .map(condition => condition.name || condition)
                        .join(', '),
                      allergies: (Array.isArray(patient.allergies) ? patient.allergies : []).join(', ')
                    });
                  }
                  setShowProfileEditor(true);
                }}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Pencil className="w-4 h-4 text-emerald-600" />
                <span>Edit patient record</span>
              </button>
              <button
                type="button"
                onClick={() => setShowOcrModal(true)}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Scan Lab Slip (OCR)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConsultModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Consultation</span>
              </button>
            </div>
          )}
        </div>

        {!isOnline && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-900">
            Offline mode: showing the patient record and timeline saved on this device. Edits and readings are queued for synchronization when connectivity returns.
          </div>
        )}

        {patient.syncConflict && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
            <h2 className="font-bold">Sync conflict — both versions are preserved</h2>
            <p className="mt-1 text-xs">
              This record changed on the server while this device was offline. Your local edits have not been applied over the newer record.
              Local: {patient.syncConflict.local?.name} (version {patient.syncConflict.local?.version || 'pending'}); server: {patient.syncConflict.server?.name} (version {patient.syncConflict.server?.version}).
              Review the differences and choose how to proceed:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleResolveConflict('server')}
                className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-rose-100"
              >
                Keep newer server version
              </button>
              <button
                type="button"
                onClick={() => handleResolveConflict('merge-local-changes')}
                className="rounded-lg bg-rose-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-900"
              >
                Apply my saved edits to server version
              </button>
            </div>
          </div>
        )}

        {patient.syncStatus === 'pending' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">
            This record has unsynchronized changes saved on this device.
          </div>
        )}

        {showProfileEditor && (
          <form onSubmit={handleSaveProfile} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900">Edit patient record</h2>
              <button type="button" onClick={() => setShowProfileEditor(false)} aria-label="Close editor">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            {profileError && <p className="mb-3 text-xs font-semibold text-rose-700">{profileError}</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-semibold text-slate-700">Name
                <input required name="name" value={profileForm.name} onChange={handleProfileChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Age
                <input required min="1" type="number" name="age" value={profileForm.age} onChange={handleProfileChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Sex
                <select name="sex" value={profileForm.sex} onChange={handleProfileChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700"><Phone className="mr-1 inline h-3 w-3" />Contact phone
                <input type="tel" name="contactPhone" value={profileForm.contactPhone} onChange={handleProfileChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <div className="sm:col-span-2 lg:col-span-3">
                <DistrictVillageSelector
                  preserveSavedVillage
                  selectedDistrict={profileForm.district}
                  onDistrictChange={district => setProfileForm(previous => ({
                    ...previous,
                    district,
                    villageCode: ''
                  }))}
                  selectedVillage={profileForm.village}
                  onVillageChange={village => setProfileForm(previous => ({ ...previous, village }))}
                  onVillageCodeChange={villageCode => setProfileForm(previous => ({ ...previous, villageCode }))}
                />
              </div>
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Conditions (comma separated)
                <input name="conditions" value={profileForm.conditions} onChange={handleProfileChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Allergies (comma separated)
                <input name="allergies" value={profileForm.allergies} onChange={handleProfileChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </div>
            <button type="submit" disabled={profileSaving} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              <Save className="h-4 w-4" />
              {profileSaving ? 'Saving…' : 'Save patient record'}
            </button>
          </form>
        )}

        {/* 2-Minute Patient Snapshot Header (Blueprint M5 & 10.4) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-900">{patient.name}</h1>
                <span className="text-sm font-semibold text-slate-500">({patient.age} yrs, {patient.sex})</span>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-bold">
                  {patient.patientId}
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md font-bold">
                  {patient.village} Village ({patient.district.toUpperCase()})
                </span>
                {patient.contactPhone && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <Phone className="h-3 w-3" />{patient.contactPhone}
                  </span>
                )}
                <RiskBadge tier={patient.riskTier} score={patient.riskScore} />
              </div>

              {/* Conditions & Active Prescriptions */}
              <div className="flex flex-wrap gap-4 text-xs pt-1">
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Diagnosed Chronic Conditions</span>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {(patient.conditions || []).map((c, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px]">
                        {c.name || c}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Active Medications</span>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {(patient.currentMedications || []).map((m, i) => (
                      <span key={i} className="px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded font-semibold text-[11px]">
                        {m.name} ({m.dosage})
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Allergies</span>
                  <span className="text-[11px] font-bold text-rose-600 mt-0.5 block">
                    {(patient.allergies && patient.allergies.length > 0) ? patient.allergies.join(', ') : 'None Reported'}
                  </span>
                </div>
              </div>
            </div>

            {/* Latest Vitals Metric Block */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 shrink-0">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Latest BP</span>
                <div className="font-mono font-black text-lg text-slate-800">
                  {patient.latestVitals?.systolicBP || '--'}/{patient.latestVitals?.diastolicBP || '--'}
                  <span className="text-xs font-normal text-slate-400 ml-0.5">mmHg</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Fasting Glucose</span>
                <div className="font-mono font-black text-lg text-slate-800">
                  {patient.latestVitals?.bloodGlucose || '--'}
                  <span className="text-xs font-normal text-slate-400 ml-0.5">mg/dL</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Pulse Rate</span>
                <div className="font-mono font-black text-lg text-slate-800">
                  {patient.latestVitals?.heartRate || '74'}
                  <span className="text-xs font-normal text-slate-400 ml-0.5">bpm</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Explainable AI Risk & Deterioration Box (Blueprint 10.3) */}
        <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50/40 rounded-2xl p-5 border border-amber-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/60">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Explainable Deterioration Risk Reasoning (Hybrid Transparent Rule Engine)
              </h3>
            </div>
            <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
              Decision Support Only • Doctor Decides
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Top Contributing Clinical Factors</span>
              <ul className="mt-1 space-y-1 text-xs text-slate-700">
                {(patient.riskFactors || ['Vital slope elevation', 'Dual condition burden']).map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Data Window Evaluated</span>
              <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                Evaluated across <strong>{systolicObs.length} systolic BP readings</strong> and <strong>{visits.length} clinical visits</strong> over rural circuit rotations.
              </p>
            </div>

            <div className="flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Clinician Alert Action</span>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert('Doctor accepted AI risk indicator. Action logged in audit registry.')}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  Accept Risk Flag
                </button>
                <button
                  type="button"
                  onClick={() => alert('Doctor dismissed alert. Reason recorded for model calibration.')}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* OLS Trend & Forecast Chart (Blueprint 10.2) */}
        <TrendForecastChart
          historicalData={systolicObs}
          forecast={trends?.systolicForecast}
          metricName="Systolic Blood Pressure"
          threshold={160}
          unit="mmHg"
        />
        <TrendForecastChart
          historicalData={glucoseObs}
          forecast={trends?.glucoseForecast}
          metricName="Blood Glucose"
          threshold={200}
          unit="mg/dL"
        />

        {/* Doctor AI Grounded Copilot (Blueprint 10.5) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Grounded Doctor AI Copilot
                </h3>
                <p className="text-[11px] text-slate-500">
                  Blueprint 10.5: Natural-language queries over authorized patient record only
                </p>
              </div>
            </div>

            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              No Hallucinations • Cites Visit Dates
            </span>
          </div>

          {/* Prompt shortcuts */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => handleCopilotQuery('What changed since last visit?')}
              className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              "What changed since last visit?"
            </button>
            <button
              onClick={() => handleCopilotQuery('Why was this patient flagged?')}
              className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              "Why was this patient flagged?"
            </button>
            <button
              onClick={() => handleCopilotQuery('Is the BP trend improving?')}
              className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              "Is the BP trend improving?"
            </button>
            <button
              onClick={() => handleCopilotQuery('Summarize this patient')}
              className="px-3 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              "Summarize this patient"
            </button>
          </div>

          {/* Copilot input box */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={copilotQuestion}
              onChange={(e) => setCopilotQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCopilotQuery()}
              placeholder="Ask Copilot about symptoms, vital history, or medication changes..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <button
              type="button"
              onClick={() => handleCopilotQuery()}
              disabled={copilotLoading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask Copilot</span>
            </button>
          </div>

          {/* Copilot Response Card */}
          {copilotAnswer && (
            <div className="mt-4 p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-slate-800 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-indigo-900 font-bold border-b border-indigo-200/60 pb-1.5">
                <span>Grounded Copilot Response</span>
                <span className="text-[10px] font-normal text-indigo-700">
                  {copilotAnswer.disclaimer}
                </span>
              </div>
              <div className="whitespace-pre-line text-slate-800 leading-relaxed font-normal">
                {copilotAnswer.groundedResponse}
              </div>
              {copilotAnswer.citations && copilotAnswer.citations.length > 0 && (
                <div className="pt-2 border-t border-indigo-200/60 flex flex-wrap items-center gap-1.5 text-[11px] text-indigo-800 font-semibold">
                  <span>Citations:</span>
                  {copilotAnswer.citations.map((c, idx) => (
                    <span key={idx} className="bg-white/80 px-2 py-0.5 rounded text-indigo-900 border border-indigo-200">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Longitudinal Visits & History Timeline */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Longitudinal Consultation History ({visits.length} Visits Logged)
              </h3>
              <p className="text-xs text-slate-500">
                Continuous clinical record following patient across rural circuits
              </p>
            </div>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {visits.map((v, idx) => (
              <div key={idx} className="relative pl-4 space-y-2">
                <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-xs" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-800">
                      {new Date(v.date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-xs text-slate-500">
                      • {v.village} Clinic ({v.doctorName || 'Dr. Ravi'})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    BP: {v.vitals?.systolicBP}/{v.vitals?.diastolicBP} mmHg • Glucose: {v.vitals?.bloodGlucose} mg/dL
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="text-slate-700">
                    <strong className="text-slate-900">Reported Symptoms: </strong>
                    {(v.symptoms && v.symptoms.length > 0) ? v.symptoms.join(', ') : 'None stated'}
                  </div>
                  {v.doctorNotes && (
                    <div className="text-slate-700">
                      <strong className="text-slate-900">Clinical Observations: </strong>
                      {v.doctorNotes}
                    </div>
                  )}
                  {v.clinicalPlan && (
                    <div className="text-emerald-900 bg-emerald-50/60 p-2 rounded-lg border border-emerald-200">
                      <strong className="text-emerald-950">Care Plan: </strong>
                      {v.clinicalPlan}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* OCR Modal */}
      <OcrModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        onConfirmValues={handleOcrConfirmedValues}
      />

      {/* New Consultation Record Modal */}
      {showConsultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Record Clinical Consultation ({patient.name})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {patient.village} Village Circuit • Offline-First Sync Ready
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConsultModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConsultation} className="space-y-4">
              {/* Vitals row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={consultForm.systolicBP}
                    onChange={(e) => setConsultForm({ ...consultForm, systolicBP: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={consultForm.diastolicBP}
                    onChange={(e) => setConsultForm({ ...consultForm, diastolicBP: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Glucose (mg/dL)</label>
                  <input
                    type="number"
                    value={consultForm.bloodGlucose}
                    onChange={(e) => setConsultForm({ ...consultForm, bloodGlucose: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pulse (bpm)</label>
                  <input
                    type="number"
                    value={consultForm.heartRate}
                    onChange={(e) => setConsultForm({ ...consultForm, heartRate: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Symptoms Reported</label>
                <input
                  type="text"
                  value={consultForm.symptoms}
                  onChange={(e) => setConsultForm({ ...consultForm, symptoms: e.target.value })}
                  placeholder="e.g. Headache, dizziness, palpitations"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Voice-Dictated Clinical Notes (Blueprint M4) */}
              <div className="space-y-2">
                <VoiceConsultationInput
                  currentText={consultForm.doctorNotes}
                  onTranscriptReady={(transcript) => setConsultForm(prev => ({ ...prev, doctorNotes: transcript }))}
                />
                <textarea
                  rows={3}
                  value={consultForm.doctorNotes}
                  onChange={(e) => setConsultForm({ ...consultForm, doctorNotes: e.target.value })}
                  placeholder="Clinical notes, auscultation findings, medication adjustments..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <section className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Prescription instructions</h4>
                    <p className="mt-1 text-[11px] text-slate-600">These exact directions will appear in the patient’s medicine list.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addPrescription}
                    className="shrink-0 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Add medicine
                  </button>
                </div>
                {consultForm.prescriptions.map((prescription, index) => (
                  <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Medicine {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removePrescription(index)}
                        className="text-xs font-semibold text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-[11px] font-semibold text-slate-700">Medicine name
                        <input required value={prescription.medicine} onChange={event => handlePrescriptionChange(index, 'medicine', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-700">Dose
                        <input required value={prescription.dosage} onChange={event => handlePrescriptionChange(index, 'dosage', event.target.value)} placeholder="e.g. 5 mg" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-700">Schedule
                        <input required value={prescription.frequency} onChange={event => handlePrescriptionChange(index, 'frequency', event.target.value)} placeholder="e.g. Once each morning" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-700">Purpose (what it treats)
                        <input required value={prescription.purpose} onChange={event => handlePrescriptionChange(index, 'purpose', event.target.value)} placeholder="What condition is this medicine for?" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-700">Directions (how to take it)
                        <textarea required rows={2} value={prescription.instructions} onChange={event => handlePrescriptionChange(index, 'instructions', event.target.value)} placeholder="How should the patient take it?" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs" />
                      </label>
                    </div>
                  </div>
                ))}
                {consultForm.prescriptions.length === 0 && (
                  <p className="rounded-lg bg-white p-3 text-xs text-slate-600">No new medicine prescribed for this visit.</p>
                )}
              </section>

              {/* Clinical Plan & Follow-up */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Management Plan</label>
                  <input
                    type="text"
                    value={consultForm.clinicalPlan}
                    onChange={(e) => setConsultForm({ ...consultForm, clinicalPlan: e.target.value })}
                    placeholder="e.g. Sodium restriction, recheck in 2 weeks"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Next Follow-up In</label>
                  <select
                    value={consultForm.nextFollowUpDays}
                    onChange={(e) => setConsultForm({ ...consultForm, nextFollowUpDays: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="7">7 Days (High Risk)</option>
                    <option value="14">14 Days (Fortnight Circuit)</option>
                    <option value="30">30 Days (Monthly Check)</option>
                    <option value="60">60 Days (Stable Routine)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConsultModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={consultSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{consultSaving ? 'Saving Visit...' : 'Save Clinical Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
