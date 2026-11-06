import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import DistrictVillageSelector from '../components/DistrictVillageSelector';
import RiskBadge from '../components/RiskBadge';
import VerificationBadge from '../components/VerificationBadge';
import {
  Users,
  AlertTriangle,
  Clock,
  Calendar,
  MapPin,
  ChevronRight,
  Stethoscope,
  Activity,
  HeartPulse,
  Search,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';

export default function DoctorDashboard() {
  const { user, profile, isVerifiedDoctor, toggleDoctorVerification } = useAuth();
  const { t } = useLanguage();

  const [selectedDistrict, setSelectedDistrict] = useState('ranchi');
  const [selectedVillage, setSelectedVillage] = useState('Angara');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'followups'

  const fetchSummary = async (dist, vill) => {
    setLoading(true);
    const token = localStorage.getItem('careroute_token');
    try {
      const res = await fetch(`/api/doctors/dashboard-summary?district=${dist}&village=${vill}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(selectedDistrict, selectedVillage);
  }, [selectedDistrict, selectedVillage]);

  const priorityQueue = dashboardData?.priorityQueue || {
    critical: [],
    high: [],
    moderate: [],
    routine: []
  };
  const doctorName = (user?.name || 'Ravi Kumar')
    .replace(/^(?:Dr\.?\s*)+/i, '')
    .replace(/\s*\(Under Verification\)\s*$/i, '')
    .trim();

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Anti-Scam Verification Guard Banner */}
        {!isVerifiedDoctor && (
          <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">Anti-Scam Doctor Protection Active</h3>
                <p className="text-xs text-white/90 mt-0.5 max-w-2xl">
                  Your medical credentials and council registration are under review. Full patient medical charts and sensitive clinical notes are protected until credentials are verified.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/doctor/verification"
                className="px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors shadow-sm"
              >
                Upload Certificates
              </Link>
              <button
                onClick={() => toggleDoctorVerification('verified')}
                className="px-4 py-2 bg-slate-900 text-emerald-400 rounded-xl text-xs font-bold hover:bg-black transition-colors border border-emerald-500/50"
                title="Instant evaluation simulator for hackathon judges"
              >
                Verify Now (Demo)
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Header & Location Switcher */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900">
                Dr. {doctorName}
              </h1>
              <VerificationBadge isVerified={isVerifiedDoctor} compact={true} />
            </div>
          </div>

          {/* Interactive District & Village Cascader */}
          <div className="max-w-xl w-full">
            <DistrictVillageSelector
              selectedDistrict={selectedDistrict}
              onDistrictChange={setSelectedDistrict}
              selectedVillage={selectedVillage}
              onVillageChange={setSelectedVillage}
            />
          </div>
        </div>

        {/* Village Circuit Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Village Registry
              </span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">
                {dashboardData?.totalPatientsInVillage || 0}
              </span>
              <span className="text-[10px] text-slate-500">{selectedVillage} Sub-Center</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs flex items-center justify-between bg-rose-50/20">
            <div>
              <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block">
                Critical Deterioration
              </span>
              <span className="text-2xl font-black text-rose-600 mt-1 block">
                {priorityQueue.critical.length}
              </span>
              <span className="text-[10px] text-rose-600/80">Immediate attention</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between bg-amber-50/20">
            <div>
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                High Priority (Worsening)
              </span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {priorityQueue.high.length}
              </span>
              <span className="text-[10px] text-amber-600/80">Steep OLS trend</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Overdue Follow-ups
              </span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">
                {dashboardData?.overdueFollowups?.length || 0}
              </span>
              <span className="text-[10px] text-slate-500">Missed clinical reviews</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Priority Queue Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span>Today's Village Patient Queue ({selectedVillage})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sorted by Explainable Deterioration Risk: Critical &rarr; High &rarr; Moderate &rarr; Routine
              </p>
            </div>

            <Link
              to="/doctor/patients"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>View All Rural Circuits Registry</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Patient Cards in Priority Queue */}
          <div className="divide-y divide-slate-100">
            {[...priorityQueue.critical, ...priorityQueue.high, ...priorityQueue.moderate, ...priorityQueue.routine].length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No patients logged for {selectedVillage} yet. Switch villages using the dropdown above or register a new patient.
              </div>
            ) : (
              [...priorityQueue.critical, ...priorityQueue.high, ...priorityQueue.moderate, ...priorityQueue.routine].map((patient) => (
                <div
                  key={patient._id}
                  className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{patient.name}</span>
                      <span className="text-xs text-slate-500 font-medium">({patient.age}y, {patient.sex})</span>
                      <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {patient.patientId}
                      </span>
                      <RiskBadge tier={patient.riskTier} score={patient.riskScore} compact={true} />
                    </div>

                    {/* Conditions and Key Risk Factor */}
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">Conditions:</span>
                      {(patient.conditions || []).map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-700">
                          {c.name || c}
                        </span>
                      ))}
                    </div>

                    {patient.riskFactors && patient.riskFactors.length > 0 && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span className="font-semibold text-rose-700">Primary AI Risk Flag:</span>
                        <span>{patient.riskFactors[0]}</span>
                      </div>
                    )}
                  </div>

                  {/* Vitals Snapshot */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Latest BP</span>
                      <span className="font-mono font-extrabold text-sm text-slate-800">
                        {patient.latestVitals?.systolicBP || '--'}/{patient.latestVitals?.diastolicBP || '--'}
                        <span className="text-[10px] text-slate-400 font-normal ml-0.5">mmHg</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Glucose</span>
                      <span className="font-mono font-extrabold text-sm text-slate-800">
                        {patient.latestVitals?.bloodGlucose || '--'}
                        <span className="text-[10px] text-slate-400 font-normal ml-0.5">mg/dL</span>
                      </span>
                    </div>

                    <Link
                      to={`/doctor/patient/${patient._id}`}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all shrink-0"
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>Examine / Timeline</span>
                    </Link>
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
