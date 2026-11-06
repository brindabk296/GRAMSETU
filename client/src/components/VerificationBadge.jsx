import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Award, CheckCircle2 } from 'lucide-react';

export default function VerificationBadge({
  isVerified,
  status = 'pending',
  regNumber = '',
  council = '',
  degree = '',
  compact = false,
  showDetails = false
}) {
  const verified = isVerified || status === 'verified';

  if (compact) {
    return verified ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>Verified Doctor</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
        <span>Verification Pending</span>
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl p-4 border transition-all ${
        verified
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-300'
          : 'bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border-amber-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              verified ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-amber-500 text-white shadow-md shadow-amber-200'
            }`}
          >
            {verified ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                {verified ? 'Accredited & Verified Clinical Practitioner' : 'Medical License Verification Required'}
              </h4>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {verified ? 'Anti-Scam Checked' : 'Access Restricted'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {verified
                ? 'Identity, Medical Degree & State Council Registration verified against NMC registry.'
                : 'Anti-scam restriction active: Unverified accounts are strictly blocked from patient medical records.'}
            </p>
          </div>
        </div>
      </div>

      {(showDetails || regNumber) && (
        <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {regNumber && (
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Reg. Number (NMC)</span>
              <span className="font-mono font-bold text-slate-800">{regNumber}</span>
            </div>
          )}
          {degree && (
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Accredited Degree</span>
              <span className="font-semibold text-slate-800">{degree}</span>
            </div>
          )}
          {council && (
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Medical Council</span>
              <span className="font-medium text-slate-700 truncate block">{council}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
