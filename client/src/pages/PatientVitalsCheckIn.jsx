import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recordPatientObservation, syncPendingPatientRecords } from '../services/patientRecords';
import {
  HeartPulse,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  HelpCircle
} from 'lucide-react';

export default function PatientVitalsCheckIn() {
  const { user, profile, token } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    systolicBP: 138,
    diastolicBP: 88,
    bloodGlucose: 140,
    heartRate: 76,
    weightKg: 62,
    symptoms: '',
    notes: 'Home BP monitor check after morning walk'
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleOfflineAwareSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (!profile?._id) throw new Error('Your patient record is not available.');
      const readings = [
        { type: 'bp_systolic', value: form.systolicBP, unit: 'mmHg', notes: form.notes },
        { type: 'bp_diastolic', value: form.diastolicBP, unit: 'mmHg' },
        { type: 'blood_glucose', value: form.bloodGlucose, unit: 'mg/dL' },
        { type: 'heart_rate', value: form.heartRate, unit: 'bpm' },
        { type: 'weight', value: form.weightKg, unit: 'kg' }
      ];
      for (const reading of readings) {
        if (reading.value === '' || reading.value === undefined || reading.value === null) continue;
        await recordPatientObservation(profile?._id, {
          ...reading,
          value: Number(reading.value),
          source: 'patient_checkin'
        }, token, {
          role: user?.role,
          userId: user?.id || user?._id
        }, { sync: false });
      }
      // Readings are saved on the device first; one sync pass then sends them all.
      await syncPendingPatientRecords(token).catch(error => {
        console.error('Patient record synchronization failed:', error);
      });
      setSuccess(true);
      setTimeout(() => navigate('/patient/dashboard'), 1500);
    } catch (error) {
      alert(error.message || 'Error recording check-in readings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        <Link
          to="/patient/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Health Dashboard</span>
        </Link>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">
                Between-Visits Vitals Check-in
              </h1>
              <p className="text-xs text-slate-500">
                Blueprint M11: Remote Monitoring & Longitudinal Health Tracking
              </p>
            </div>
          </div>

          {success && (
            <div className="p-4 bg-teal-50 border border-teal-200 text-teal-900 rounded-2xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
              <span>
                {navigator.onLine
                  ? 'Vitals saved. Updating your longitudinal trend forecast...'
                  : 'Vitals saved on this device and will sync when connectivity returns.'}
              </span>
            </div>
          )}

          <form onSubmit={handleOfflineAwareSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Systolic Blood Pressure (mmHg) *
                </label>
                <input
                  type="number"
                  required
                  value={form.systolicBP}
                  onChange={(e) => setForm({ ...form, systolicBP: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Diastolic Blood Pressure (mmHg)
                </label>
                <input
                  type="number"
                  value={form.diastolicBP}
                  onChange={(e) => setForm({ ...form, diastolicBP: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Blood Sugar / Glucose (mg/dL)
                </label>
                <input
                  type="number"
                  value={form.bloodGlucose}
                  onChange={(e) => setForm({ ...form, bloodGlucose: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  value={form.heartRate}
                  onChange={(e) => setForm({ ...form, heartRate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-800 text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Any physical symptoms or discomfort?
              </label>
              <input
                type="text"
                value={form.symptoms}
                onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                placeholder="e.g. Mild headache, tired legs, or normal"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contextual Note
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Syncing Reading to Doctor Timeline...' : 'Submit Vitals to Doctor'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
