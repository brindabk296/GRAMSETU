import React, { useState, useEffect } from 'react';
import VerificationBadge from '../components/VerificationBadge';
import {
  ShieldCheck,
  Search,
  GraduationCap,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  MapPin
} from 'lucide-react';

export default function DoctorDirectory() {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/doctors/directory')
      .then(res => res.json())
      .then(data => {
        setDoctors(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load doctor directory:', err);
        setLoading(false);
      });
  }, []);

  const filteredDoctors = doctors.filter(doc => {
    const q = search.toLowerCase();
    return (
      (doc.name || '').toLowerCase().includes(q) ||
      (doc.medicalRegistrationNumber || '').toLowerCase().includes(q) ||
      (doc.specialization || '').toLowerCase().includes(q) ||
      (doc.college || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Anti-Scam Clinical Practitioner Registry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Verified Medical Doctor Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Inspect doctor qualifications, medical council registration licenses, and certificate status to ensure you receive care only from genuine accredited physicians.
            </p>
          </div>

          <div className="w-full md:w-72">
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search Registry</span>
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, NMC number, degree..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Doctor Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-2 p-12 text-center text-xs text-slate-400 animate-pulse">
              Querying verified clinical registry...
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="col-span-2 p-12 text-center text-xs text-slate-400">
              No medical practitioners found matching search query.
            </div>
          ) : (
            filteredDoctors.map((doc) => {
              const verified = doc.isVerified || doc.verificationStatus === 'verified';
              return (
                <div
                  key={doc._id}
                  className={`bg-white rounded-3xl p-6 border shadow-sm transition-all hover:shadow-md ${
                    verified ? 'border-emerald-200' : 'border-amber-200 bg-amber-50/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-base ${
                          verified ? 'bg-emerald-600 shadow-md shadow-emerald-200' : 'bg-amber-500 shadow-md shadow-amber-200'
                        }`}
                      >
                        {doc.name ? doc.name.charAt(0) : 'D'}
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">{doc.name}</h3>
                        <p className="text-xs text-slate-500">{doc.specialization}</p>
                      </div>
                    </div>

                    <VerificationBadge isVerified={verified} compact={true} />
                  </div>

                  {/* Qualifications & Council Data */}
                  <div className="grid grid-cols-2 gap-3 py-4 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Medical Degree</span>
                      <span className="font-semibold text-slate-800 mt-0.5 block">{doc.degree || 'MBBS'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Reg. Number (NMC)</span>
                      <span className="font-mono font-bold text-slate-900 mt-0.5 block">{doc.medicalRegistrationNumber}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Medical College</span>
                      <span className="font-medium text-slate-700 mt-0.5 block truncate">{doc.college || 'RIMS Ranchi'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Circuit Villages</span>
                      <span className="font-medium text-slate-700 mt-0.5 block truncate">
                        {(doc.assignedVillages || ['Angara', 'Bundu']).join(', ')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 truncate max-w-[200px]">
                      Council: {doc.stateMedicalCouncil}
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded ${
                        verified ? 'text-emerald-800 bg-emerald-100' : 'text-amber-800 bg-amber-100'
                      }`}
                    >
                      {verified ? 'Official Council Verified' : 'Pending Verification'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
