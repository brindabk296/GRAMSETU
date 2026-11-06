import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Stethoscope, User, Lock, Mail, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';

export default function Login() {
  const [role, setRole] = useState('doctor'); // 'doctor' | 'patient'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveredId, setRecoveredId] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleRoleSwitch = (selectedRole) => {
    setRole(selectedRole);
    setError('');
    setIdentifier('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (role === 'doctor' && identifier.includes('@')) {
      setError('Doctors sign in with their unique Doctor ID (e.g. CRD-1A2B3C4D5E), not an email address.');
      return;
    }
    setLoading(true);

    try {
      const data = await login(identifier.trim(), password, role);
      if (data.user.role === 'doctor') {
        navigate('/doctor/dashboard');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverId = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveredId('');
    setRecoveryLoading(true);
    try {
      const res = await fetch('/api/auth/doctor/recover-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail, password: recoveryPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not recover your Doctor ID.');
      setRecoveredId(data.doctorId);
      setIdentifier(data.doctorId);
      setPassword(recoveryPassword);
    } catch (err) {
      setRecoveryError(err.message);
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-200">
            {role === 'doctor' ? <Stethoscope className="w-7 h-7" /> : <User className="w-7 h-7" />}
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('portalTitle')}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('portalDescription')}
          </p>
        </div>

        {/* Role Toggle Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => handleRoleSwitch('doctor')}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              role === 'doctor'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>{t('signInDoctor')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleSwitch('patient')}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              role === 'patient'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{t('signInPatient')}</span>
          </button>
        </div>

        {/* Error alert */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              {role === 'doctor'
                ? <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                : <Mail className="w-3.5 h-3.5 text-slate-400" />}
              <span>{role === 'doctor' ? 'Doctor ID' : 'Phone number or email'}</span>
            </label>
            <input
              type="text"
              autoComplete={role === 'doctor' ? 'username' : 'tel'}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={role === 'doctor' ? 'e.g. CRD-12AB34CD56' : 'e.g. 9771234091 or name@example.com'}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('password')}</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>{t('authenticating')}</span>
            ) : (
              <>
                <span>{role === 'doctor' ? t('signInAsDoctor') : t('signInAsPatient')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Doctor ID recovery (doctors only) */}
        {role === 'doctor' && (
          <div className="text-center text-xs">
            <button
              type="button"
              onClick={() => { setShowRecovery(v => !v); setRecoveryError(''); setRecoveredId(''); }}
              className="inline-flex items-center gap-1.5 font-bold text-slate-600 hover:text-emerald-700 hover:underline"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Recover my Doctor ID
            </button>
            {showRecovery && (
              <form onSubmit={handleRecoverId} className="mt-3 space-y-2 text-left p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] text-slate-500">Enter the email and password you registered with to see your Doctor ID.</p>
                <input
                  type="email"
                  required
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="Registered email"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
                <input
                  type="password"
                  required
                  value={recoveryPassword}
                  onChange={(e) => setRecoveryPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
                {recoveryError && <p className="text-[11px] font-semibold text-rose-700">{recoveryError}</p>}
                {recoveredId && (
                  <p className="text-[11px] text-emerald-800">
                    Your Doctor ID: <span className="font-mono font-bold text-sm">{recoveredId}</span> (filled in above)
                  </p>
                )}
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {recoveryLoading ? 'Checking…' : 'Show my Doctor ID'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Registration Links */}
        <div className="text-center text-xs text-slate-500 pt-1">
          {role === 'doctor' ? (
            <span>
              {t('newDoctor')}{' '}
              <Link to="/register/doctor" className="font-bold text-emerald-600 hover:underline">
                {t('registerDoctorCredentials')}
              </Link>
            </span>
          ) : (
            <span>
              {t('patientRegisterPrompt')}{' '}
              <Link to="/register/patient" className="font-bold text-teal-600 hover:underline">
                {t('patientRegisterAction')}
              </Link>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
