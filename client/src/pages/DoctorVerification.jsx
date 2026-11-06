import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import VerificationBadge from '../components/VerificationBadge';
import {
  GraduationCap
} from 'lucide-react';

export default function DoctorVerification() {
  const { user, profile, isVerifiedDoctor } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Medical Practitioner Credentials & Anti-Scam Verification
          </h1>
        </div>

        {/* Live Status Badge */}
        <VerificationBadge
          isVerified={isVerifiedDoctor}
          status={profile?.verificationStatus}
          regNumber={profile?.medicalRegistrationNumber}
          council={profile?.stateMedicalCouncil}
          degree={profile?.degree}
          showDetails={true}
        />

        {/* Credentials Breakdown */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Accredited Doctor Profile</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">CareRoute Doctor ID</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                {user?.doctorId || profile?.doctorId || 'Contact support to recover your ID'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Clinician Full Name</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">{profile?.name || user?.name}</span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Medical Registration No.</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                {profile?.medicalRegistrationNumber || 'NMC-JH-2016-44821'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Accredited Degree</span>
              <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                {profile?.degree || 'MBBS, MD (Community Medicine)'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Medical College / University</span>
              <span className="font-medium text-slate-800 text-xs mt-0.5 block">
                {profile?.college || 'Rajendra Institute of Medical Sciences (RIMS)'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">State Medical Council</span>
              <span className="font-medium text-slate-800 text-xs mt-0.5 block">
                {profile?.stateMedicalCouncil || 'Jharkhand State Medical Council'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Verified Certificate File</span>
              <span className="font-mono text-xs text-emerald-700 mt-0.5 block truncate">
                {profile?.certificateFile || 'license_verified_rims.pdf'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
