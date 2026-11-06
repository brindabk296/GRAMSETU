import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getPatientSyncStatus } from '../services/patientRecords';
import {
  Stethoscope,
  User,
  LogOut,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  Users,
  LayoutDashboard,
  HeartPulse
} from 'lucide-react';

export default function Navbar() {
  const { user, logout, isVerifiedDoctor } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({
    pendingCount: 0,
    conflictCount: 0,
    isSyncing: false,
    isRetrying: false,
    syncError: ''
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    let active = true;
    const refreshSyncStatus = () => {
      setIsOnline(navigator.onLine);
      getPatientSyncStatus()
        .then(status => {
          if (active) setSyncStatus(status);
        })
        .catch(error => console.error('Failed to check patient sync status:', error));
    };

    refreshSyncStatus();
    window.addEventListener('online', refreshSyncStatus);
    window.addEventListener('offline', refreshSyncStatus);
    window.addEventListener('patient-records-updated', refreshSyncStatus);
    return () => {
      active = false;
      window.removeEventListener('online', refreshSyncStatus);
      window.removeEventListener('offline', refreshSyncStatus);
      window.removeEventListener('patient-records-updated', refreshSyncStatus);
    };
  }, []);

  const syncStatusLabel = !isOnline
    ? t('statusOffline')
    : syncStatus.syncError
      ? t('statusSyncError')
      : syncStatus.conflictCount > 0 && syncStatus.pendingCount === 0
        ? t('statusSyncConflict')
        : syncStatus.isSyncing
          ? t('statusSyncing')
          : syncStatus.isRetrying
            ? t('statusRetrying')
            : syncStatus.pendingCount > 0
              ? `${t('statusOnlinePending')} (${syncStatus.pendingCount})`
              : syncStatus.conflictCount > 0
                ? t('statusSyncConflict')
                : t('statusOnlineSynced');
  const syncStatusTitle = syncStatus.syncError ||
    (syncStatus.conflictCount > 0
      ? `${syncStatus.conflictCount} saved change(s) need conflict review.`
      : undefined);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">CareRoute AI</span>
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded tracking-wide">
                v2
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">{t('navSubtitle')}</p>
          </div>
        </Link>

        {/* Center Navigation Links based on Role */}
        <nav className="hidden md:flex items-center gap-1">
          {user?.role === 'doctor' && (
            <>
              <Link
                to="/doctor/dashboard"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive('/doctor/dashboard')
                    ? 'bg-emerald-50 text-emerald-700 font-bold'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{t('navDashboard')}</span>
              </Link>
              <Link
                to="/doctor/patients"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive('/doctor/patients')
                    ? 'bg-emerald-50 text-emerald-700 font-bold'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{t('navPatients')}</span>
              </Link>
              <Link
                to="/doctor/chat"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive('/doctor/chat')
                    ? 'bg-emerald-50 text-emerald-700 font-bold'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t('navChatDoctor')}</span>
              </Link>
              <Link
                to="/doctor/verification"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive('/doctor/verification')
                    ? 'bg-emerald-50 text-emerald-700 font-bold'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
                }`}
              >
                {isVerifiedDoctor ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-500 animate-pulse" />
                )}
                <span>{t('navCredentials')}</span>
              </Link>
            </>
          )}

          {user?.role === 'patient' && (
            <>
              <Link
                to="/patient/dashboard"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive('/patient/dashboard')
                    ? 'bg-emerald-50 text-emerald-700 font-bold'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{t('navMyHealth')}</span>
              </Link>
              <Link
                to="/patient/vitals"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive('/patient/vitals')
                    ? 'bg-emerald-50 text-emerald-700 font-bold'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
                }`}
              >
                <HeartPulse className="w-4 h-4" />
                <span>{t('navVitals')}</span>
              </Link>
              <Link
                to="/patient/chat"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive('/patient/chat')
                    ? 'bg-emerald-50 text-emerald-700 font-bold'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t('navChatPatient')}</span>
              </Link>
              <Link
                to="/doctors"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive('/doctors')
                    ? 'bg-emerald-50 text-emerald-700 font-bold'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t('navDoctors')}</span>
              </Link>
            </>
          )}

          {!user && (
            <>
              <Link
                to="/doctors"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-emerald-700"
              >
                {t('navDirectory')}
              </Link>
            </>
          )}
        </nav>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2.5">
          {/* Offline/Online Status Pill (Blueprint 6.5 & M12) */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200"
            role="status"
            aria-live="polite"
          >
            <Wifi className={`w-3.5 h-3.5 ${
              isOnline && syncStatus.pendingCount === 0 && syncStatus.conflictCount === 0 && !syncStatus.syncError
                ? 'text-emerald-600'
                : 'text-amber-600'
            }`} />
            <span title={syncStatusTitle}>{syncStatusLabel}</span>
          </div>

          {/* User Profile / Auth State */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 pl-2 pr-3 py-1 bg-slate-50 rounded-full border border-slate-200">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    user.role === 'doctor' ? 'bg-emerald-600' : 'bg-teal-600'
                  }`}
                >
                  {user.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1">
                    <span>{user.name}</span>
                    {user.role === 'doctor' && (
                      isVerifiedDoctor ? (
                        <ShieldCheck className="w-3 h-3 text-emerald-600 inline" title="Verified Doctor" />
                      ) : (
                        <ShieldAlert className="w-3 h-3 text-amber-500 inline" title="Verification Pending" />
                      )
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 capitalize">{user.role}</div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-emerald-700 transition-colors"
              >
                {t('login')}
              </Link>
              <Link
                to="/register/doctor"
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
              >
                {t('joinDoctor')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
