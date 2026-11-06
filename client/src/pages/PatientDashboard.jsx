import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import RiskBadge from '../components/RiskBadge';
import TrendForecastChart from '../components/TrendForecastChart';
import { getPatientRecord, recordPatientObservation } from '../services/patientRecords';
import { buildMedicineList } from '../utils/medicineInfo';
import {
  Heart,
  Activity,
  MessageSquare,
  Plus,
  ShieldCheck,
  Calendar,
  Pill,
  Clock,
  ArrowRight,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Stethoscope
} from 'lucide-react';

export default function PatientDashboard() {
  const { user, profile, token } = useAuth();
  const { t } = useLanguage();

  const [patientRecord, setPatientRecord] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // Self check-in form
  const [checkInForm, setCheckInForm] = useState({
    type: 'bp_systolic',
    value: 140,
    bloodGlucose: 130,
    diastolicBP: 90,
    notes: 'Home check-in with digital monitor'
  });
  const [checkInSaving, setCheckInSaving] = useState(false);

  const fetchOfflineAwareData = async () => {
    setLoading(true);
    try {
      if (!profile?._id) return;
      const data = await getPatientRecord(profile._id, token, {
        role: user?.role,
        userId: user?.id || user?._id
      });
      setPatientRecord(data);
      if (navigator.onLine) {
        const response = await fetch(`/api/analytics/patient/${profile._id}/trends`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) setTrends(await response.json());
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineAwareCheckIn = async (event) => {
    event.preventDefault();
    setCheckInSaving(true);
    try {
      const readings = [
        { type: 'bp_systolic', value: checkInForm.value, unit: 'mmHg', notes: checkInForm.notes },
        { type: 'bp_diastolic', value: checkInForm.diastolicBP, unit: 'mmHg' },
        { type: 'blood_glucose', value: checkInForm.bloodGlucose, unit: 'mg/dL' }
      ];
      for (const reading of readings) {
        await recordPatientObservation(profile._id, {
          ...reading,
          value: Number(reading.value),
          source: 'patient_checkin'
        }, token, {
          role: user?.role,
          userId: user?.id || user?._id
        });
      }
      setShowCheckInModal(false);
      await fetchOfflineAwareData();
    } catch (error) {
      alert(error.message || 'Failed to save check-in vitals.');
    } finally {
      setCheckInSaving(false);
    }
  };

  const fetchMyData = async () => {
    setLoading(true);
    const token = localStorage.getItem('careroute_token');
    try {
      if (profile?._id) {
        const res = await fetch(`/api/patients/${profile._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPatientRecord(data);
        }

        const trendRes = await fetch(`/api/analytics/patient/${profile._id}/trends`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (trendRes.ok) {
          const trendData = await trendRes.json();
          setTrends(trendData);
        }
      }
    } catch (err) {
      console.error('Error fetching patient data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfflineAwareData();
  }, [profile]);

  const handleSelfCheckIn = async (e) => {
    e.preventDefault();
    setCheckInSaving(true);
    const token = localStorage.getItem('careroute_token');

    try {
      // Record systolic BP
      await fetch(`/api/patients/${profile._id}/observations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'bp_systolic',
          value: checkInForm.value,
          unit: 'mmHg',
          source: 'patient_checkin',
          notes: checkInForm.notes
        })
      });

      // Record diastolic BP
      if (checkInForm.diastolicBP) {
        await fetch(`/api/patients/${profile._id}/observations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            type: 'bp_diastolic',
            value: checkInForm.diastolicBP,
            unit: 'mmHg',
            source: 'patient_checkin'
          })
        });
      }

      // Record glucose if provided
      if (checkInForm.bloodGlucose) {
        await fetch(`/api/patients/${profile._id}/observations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            type: 'blood_glucose',
            value: checkInForm.bloodGlucose,
            unit: 'mg/dL',
            source: 'patient_checkin'
          })
        });
      }

      setShowCheckInModal(false);
      fetchMyData();
    } catch (err) {
      alert('Failed to log check-in vitals.');
    } finally {
      setCheckInSaving(false);
    }
  };

  const patient = patientRecord?.patient || profile;
  const observations = patientRecord?.observations || [];
  const visits = patientRecord?.visits || [];
  const prescriptions = buildMedicineList(patient?.currentMedications || [], visits);
  const systolicObs = observations.filter(o => o.type === 'bp_systolic');

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-teal-800 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-teal-200 text-xs font-semibold backdrop-blur-md">
              <MapPin className="w-3.5 h-3.5" />
              <span>{patient?.village || 'Angara'} Village, {patient?.district?.toUpperCase() || 'RANCHI'} District</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Namaste, {patient?.name || user?.name}!
            </h1>
            <p className="text-xs sm:text-sm text-teal-100 max-w-xl">
              Your longitudinal health journey with visiting field doctor Dr. Ravi Kumar. Track your blood pressure, medicine adherence, and chat with your doctor anytime.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCheckInModal(true)}
              className="px-4 py-2.5 bg-white text-teal-900 rounded-xl text-xs font-bold shadow-md hover:bg-teal-50 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-teal-700" />
              <span>Self Vitals Check-in</span>
            </button>
            <Link
              to="/patient/chat"
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat with Doctor & AI</span>
            </Link>
          </div>
        </div>

        {/* Vitals Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Blood Pressure
            </span>
            <div className="font-mono font-black text-2xl text-slate-800 mt-1">
              {patient?.latestVitals?.systolicBP || 154}/{patient?.latestVitals?.diastolicBP || 96}
              <span className="text-xs font-normal text-slate-400 ml-1">mmHg</span>
            </div>
            <span className="text-[10px] text-amber-600 font-semibold mt-1 block">
              Stage-1 Hypertension Range
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Blood Sugar
            </span>
            <div className="font-mono font-black text-2xl text-slate-800 mt-1">
              {patient?.latestVitals?.bloodGlucose || 168}
              <span className="text-xs font-normal text-slate-400 ml-1">mg/dL</span>
            </div>
            <span className="text-[10px] text-teal-600 font-semibold mt-1 block">
              Fasting Metabolic Record
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Deterioration Tier
            </span>
            <div className="mt-2">
              <RiskBadge tier={patient?.riskTier || 'High'} compact={true} />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Monitored by CareRoute AI
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Assigned Field Doctor
            </span>
            <div className="text-sm font-bold text-slate-800 mt-1 truncate">
              Dr. Ravi Kumar
            </div>
            <Link
              to="/doctors"
              className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-1 mt-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verify NMC License</span>
            </Link>
          </div>
        </div>

        {/* Longitudinal Trend Chart */}
        <TrendForecastChart
          historicalData={systolicObs}
          forecast={trends?.systolicForecast}
          metricName="Systolic Blood Pressure"
          threshold={160}
          unit="mmHg"
        />

        {/* Active Prescriptions & Next Village Clinic */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Pill className="w-5 h-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-800">{t('medicationGuide')}</h3>
            </div>
            <div className="space-y-2">
              {prescriptions.length > 0 ? prescriptions.map((medicine, index) => (
                <div key={`${medicine.medicine}-${index}`} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-900 text-sm block">{medicine.medicine}</span>
                      <span className="mt-1 block text-slate-600">
                        {t('frequency')}: {medicine.frequency || 'As directed by your doctor'}
                      </span>
                    </div>
                    {medicine.dosage && (
                      <span className="shrink-0 px-2.5 py-1 bg-teal-100 text-teal-800 rounded-lg font-bold font-mono">
                        {medicine.dosage}
                      </span>
                    )}
                  </div>
                  <dl className="mt-3 space-y-2">
                    <div>
                      <dt className="font-bold text-slate-700">{t('purpose')}</dt>
                      <dd className="text-slate-600">{medicine.purpose || 'Ask your doctor what this medicine is for.'}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-700">{t('directions')}</dt>
                      <dd className="text-slate-600">{medicine.instructions || 'Take exactly as your doctor or pharmacist told you.'}</dd>
                    </div>
                  </dl>
                </div>
              )) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{t('noPrescriptions')}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-800">Next Village Clinic Date</h3>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2 text-xs">
              <div className="font-bold text-emerald-950 text-sm">
                Thursday Rural Circuit Visit — {patient?.village || 'Angara'} PHC
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Dr. Ravi Kumar will be conducting follow-up blood pressure checks and medicine refills at the Angara Primary Sub-Center from 10:00 AM.
              </p>
              <div className="pt-2">
                <Link
                  to="/patient/chat"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                >
                  <span>Notify doctor about current symptoms beforehand</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Self Check-In Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Between-Visits Vitals Check-in</h3>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOfflineAwareCheckIn} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    required
                    value={checkInForm.value}
                    onChange={(e) => setCheckInForm({ ...checkInForm, value: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={checkInForm.diastolicBP}
                    onChange={(e) => setCheckInForm({ ...checkInForm, diastolicBP: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Blood Sugar (mg/dL)</label>
                <input
                  type="number"
                  value={checkInForm.bloodGlucose}
                  onChange={(e) => setCheckInForm({ ...checkInForm, bloodGlucose: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">How are you feeling today?</label>
                <input
                  type="text"
                  value={checkInForm.notes}
                  onChange={(e) => setCheckInForm({ ...checkInForm, notes: e.target.value })}
                  placeholder="e.g. Took medicine on time, slight headache"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkInSaving}
                  className="px-5 py-2 bg-teal-600 text-white font-bold rounded-xl shadow-sm"
                >
                  {checkInSaving ? 'Logging...' : 'Save Reading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
