import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DistrictVillageSelector from '../components/DistrictVillageSelector';
import RiskBadge from '../components/RiskBadge';
import VerificationBadge from '../components/VerificationBadge';
import { getPatientRecords, preparePatientRecordsForOffline } from '../services/patientRecords';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Stethoscope,
  Activity,
  HeartPulse
} from 'lucide-react';

export default function DoctorPatients() {
  const { isVerifiedDoctor, token, profile } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [district, setDistrict] = useState('ranchi');
  const [village, setVillage] = useState('all');
  const [riskTier, setRiskTier] = useState('all');
  const [search, setSearch] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlinePreparation, setOfflinePreparation] = useState(null);

  const fetchPatients = async () => {
    setLoading(true);
    const token = localStorage.getItem('careroute_token');
    try {
      const q = new URLSearchParams();
      if (district && district !== 'all') q.set('district', district);
      if (village && village !== 'all') q.set('village', village);
      if (riskTier && riskTier !== 'all') q.set('riskTier', riskTier);
      if (search) q.set('search', search);

      const res = await fetch(`/api/patients?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPatients(data);
      } else {
        setPatients([]);
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfflineAwarePatients = async () => {
    setLoading(true);
    try {
      setPatients(await getPatientRecords(
        { district, village, riskTier, search },
        token,
        { role: 'doctor', doctorProfileId: profile?._id }
      ));
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const prepareOfflineRecords = async () => {
    setOfflinePreparation({ status: 'loading', completed: 0, total: patients.length });
    let completedCount = 0;
    try {
      const count = await preparePatientRecordsForOffline(
        patients,
        token,
        { role: 'doctor', doctorProfileId: profile?._id },
        (completed, total) => {
          completedCount = completed;
          setOfflinePreparation({ status: 'loading', completed, total });
        }
      );
      setOfflinePreparation({ status: 'complete', completed: count, total: count });
    } catch (error) {
      console.error('Failed to prepare patient records for offline use:', error);
      setOfflinePreparation({
        status: 'error',
        completed: completedCount,
        total: patients.length,
        message: error.message || 'Could not download all patient records.'
      });
    }
  };

  useEffect(() => {
    setOfflinePreparation(null);
    fetchOfflineAwarePatients();
  }, [district, village, riskTier, search, token]);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    window.addEventListener('patient-records-updated', fetchOfflineAwarePatients);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
      window.removeEventListener('patient-records-updated', fetchOfflineAwarePatients);
    };
  }, [district, village, riskTier, search, token]);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Anti-Scam Protection Warning if Unverified */}
        {!isVerifiedDoctor && (
          <div className="p-6 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 flex items-start gap-4 shadow-sm">
            <ShieldAlert className="w-8 h-8 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-950">
                Access Blocked: Doctor Verification Required
              </h3>
              <p className="text-xs text-rose-800 leading-relaxed max-w-3xl">
                In compliance with medical security guidelines and to protect patient privacy against unverified or scam practitioners, access to the patient medical directory is restricted. Please complete your verification under <strong>Credentials</strong>.
              </p>
              <div className="pt-2">
                <Link
                  to="/doctor/verification"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-rose-800 transition-colors"
                >
                  Verify Medical Degree & Registration
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Page Title & Controls */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Rural Circuit Patient Registry
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-village longitudinal health cohort across primary health centers
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={prepareOfflineRecords}
                disabled={!isOnline || loading || !isVerifiedDoctor || patients.length === 0 || offlinePreparation?.status === 'loading'}
                className="px-4 py-2.5 bg-white border border-emerald-600 text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{offlinePreparation?.status === 'loading'
                  ? `Preparing ${offlinePreparation.completed}/${offlinePreparation.total}…`
                  : 'Prepare for offline use'}</span>
              </button>
              <Link
                to="/register/patient"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Register New Patient</span>
              </Link>
            </div>
          </div>

          {/* Filtering row: Cascading District & Village Selector */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6">
              <DistrictVillageSelector
                selectedDistrict={district}
                onDistrictChange={setDistrict}
                selectedVillage={village}
                onVillageChange={setVillage}
                allowAll={true}
                allLabel="All Villages in District"
              />
            </div>

            {/* Risk Tier Filter */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Filter Risk Tier</span>
              </label>
              <select
                value={riskTier}
                onChange={(e) => setRiskTier(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Risk Tiers</option>
                <option value="Critical">Critical (Immediate Care)</option>
                <option value="High">High (Worsening Trend)</option>
                <option value="Moderate">Moderate</option>
                <option value="Routine">Routine (Stable)</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Search by Name or ID</span>
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. Lakshmi, PT-RNC"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {offlinePreparation && (
              <p className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${
                offlinePreparation.status === 'error' ? 'text-rose-700' : 'text-emerald-800'
              }`}>
                {offlinePreparation.status === 'complete' && <CheckCircle2 className="h-4 w-4" />}
                {offlinePreparation.status === 'complete'
                  ? `${offlinePreparation.completed} patient records and timelines are ready on this device for offline use.`
                  : offlinePreparation.status === 'error'
                    ? `${offlinePreparation.message} ${offlinePreparation.completed} records finished before the failure.`
                    : `Downloading patient records and timelines: ${offlinePreparation.completed}/${offlinePreparation.total}.`}
              </p>
            )}
          </div>
        </div>

        {/* Patient Grid / Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-semibold">
            <span>Showing {patients.length} Registered Patients</span>
            <span>{isOnline ? 'Online' : 'Offline • showing records saved on this device'} · District: {district.toUpperCase()} • Village: {village}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
                Loading longitudinal patient records...
              </div>
            ) : patients.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No patients found matching the selected filter criteria.
              </div>
            ) : (
              patients.map((p) => (
                <div
                  key={p._id}
                  className="p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{p.name}</span>
                      <span className="text-xs text-slate-500">({p.age}y, {p.sex})</span>
                      <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {p.patientId}
                      </span>
                      {p.syncStatus === 'pending' && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          Awaiting sync
                        </span>
                      )}
                      {p.syncStatus === 'conflict' && (
                        <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
                          Sync conflict — review required
                        </span>
                      )}
                      <span className="text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold border border-emerald-200">
                        {p.village} Village
                      </span>
                      <RiskBadge tier={p.riskTier} score={p.riskScore} compact={true} />
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                      {p.contactPhone && (
                        <span className="font-semibold text-slate-700">Contact phone: {p.contactPhone}</span>
                      )}
                      <span className="font-semibold text-slate-700">Diagnoses:</span>
                      {(p.conditions || []).map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-700">
                          {c.name || c}
                        </span>
                      ))}
                      {p.allergies && p.allergies.length > 0 && (
                        <span className="text-[11px] text-rose-700 font-medium ml-2">
                          Allergies: {p.allergies.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vitals & Action */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Latest BP</span>
                      <span className="font-mono font-bold text-sm text-slate-800">
                        {p.latestVitals?.systolicBP || '--'}/{p.latestVitals?.diastolicBP || '--'} mmHg
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Glucose</span>
                      <span className="font-mono font-bold text-sm text-slate-800">
                        {p.latestVitals?.bloodGlucose || '--'} mg/dL
                      </span>
                    </div>

                    {isVerifiedDoctor ? (
                      <Link
                        to={`/doctor/patient/${p._id}`}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all shrink-0"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        <span>Timeline & Consult</span>
                      </Link>
                    ) : (
                      <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold flex items-center gap-1 cursor-not-allowed">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        <span>Verification Locked</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
