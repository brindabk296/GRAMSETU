import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

import VerificationBadge from '../components/VerificationBadge';
import {
  Stethoscope,
  Activity,
  ShieldCheck,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  Users,
  CheckCircle2,
  ArrowRight,
  Database,
  Cpu,
  Lock,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function Home() {
  
  const { t } = useLanguage();


  

  // Quick 1-click login helper
  const handleQuickLogin = async (email, password, role) => {
    setDemoLoading(true);
    try {
      const data = await login(email, password, role);
      if (role === 'doctor') {
        navigate('/doctor/dashboard');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
     

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 bg-gradient-to-b from-white via-emerald-50/20 to-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Empowering Traveling Doctors with AI </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {t('homeHeadline')} <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">
                {t('homeSubheadline')}
              </span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed font-normal">
              {t('homeIntro')}
              {' '}{t('homeDetails')}
            </p>

            {/* Role Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto pt-4">
              <Link
                to="/login"
                className="group p-5 rounded-2xl bg-white border-2 border-emerald-500/40 hover:border-emerald-600 shadow-md hover:shadow-xl transition-all text-left flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {t('doctorPortalTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('doctorPortalDescription')}
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-bold text-emerald-700 gap-1">
                  <span>{t('enterWorkspace')}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link
                to="/login"
                className="group p-5 rounded-2xl bg-white border-2 border-teal-500/40 hover:border-teal-600 shadow-md hover:shadow-xl transition-all text-left flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                    {t('patientPortalTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('patientPortalDescription')}
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-bold text-teal-700 gap-1">
                  <span>{t('accessPatientHealth')}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      

   

      

      {/* Footer */}
      <footer className="mt-auto bg-slate-900 text-white text-xs py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-2">
          <div className="font-bold text-emerald-400">GramSetu</div>
         
        </div>
      </footer>
    </div>
  );
}
