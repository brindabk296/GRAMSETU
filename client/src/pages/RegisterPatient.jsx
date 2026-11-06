import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import DistrictVillageSelector from '../components/DistrictVillageSelector';
import { createPatientRecord, getCreateFailure } from '../services/patientRecords';
import {
  Heart,
  ShieldCheck,
  AlertCircle,
  Phone,
  Mail,
  Lock
} from 'lucide-react';

export default function RegisterPatient() {
  const { token, profile, user, isVerifiedDoctor, registerPatientAccount } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: 55,
    sex: 'Female',
    conditions: ['Essential Hypertension'],
    allergies: ''
  });

  const [selectedDistrict, setSelectedDistrict] = useState('ranchi');
  const [selectedVillage, setSelectedVillage] = useState('Angara');
  const [selectedVillageCode, setSelectedVillageCode] = useState('');
  const [consentGiven, setConsentGiven] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleCondition = (condition) => {
    setFormData(prev => {
      const exists = prev.conditions.includes(condition);
      return {
        ...prev,
        conditions: exists
          ? prev.conditions.filter(c => c !== condition)
          : [...prev.conditions, condition]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.age || Number(formData.age) <= 0) {
      setError('Name and a valid age are mandatory.');
      return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Enter a valid 10-digit mobile number. It is used to sign in.');
      return;
    }
    if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      setError('Enter a valid email address or leave it blank.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Choose a password with at least 6 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    if (!consentGiven) {
      setError('Please acknowledge informed healthcare consent under DPDP Act 2023.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        contactPhone: formData.phone,
        age: Number(formData.age),
        sex: formData.sex,
        district: selectedDistrict,
        village: selectedVillage,
        villageCode: selectedVillageCode,
        conditions: formData.conditions,
        allergies: formData.allergies ? formData.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
        consentGiven: true
      };
      const email = formData.email.trim();

      if (user?.role === 'doctor') {
        // A verified doctor registers the patient in the field; this works offline and syncs later.
        if (!isVerifiedDoctor) {
          throw new Error('Only verified doctors can register patients. Complete your credential verification first.');
        }
        const record = await createPatientRecord({
          ...payload,
          assignedDoctorId: profile?._id
        }, token, { loginPassword: formData.password, ...(email ? { email } : {}) });
        const failure = await getCreateFailure(record.id);
        if (failure) throw new Error(failure);
        setRegisteredPatient(record);
      } else {
        // Patients create their own account. This needs an internet connection.
        if (!navigator.onLine) {
          throw new Error('Connect to the internet to create your account.');
        }
        await registerPatientAccount({
          ...payload,
          password: formData.password,
          ...(email ? { email } : {})
        });
        navigate('/patient/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-3 shadow-md shadow-teal-200">
            <Heart className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('registerPatientTitle')}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('registerPatientIntro')}
          </p>
        </div>

        {registeredPatient ? (
          <div className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50 p-5 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-teal-700" />
            <h3 className="text-lg font-bold text-slate-900">{t('savedTitle')}</h3>
            <p className="text-sm text-slate-700">
              {t('recordId')} <strong className="font-mono">{registeredPatient.patient.patientId}</strong>
            </p>
            <p className="text-xs text-slate-700">
              Sign-in for the patient: phone <strong className="font-mono">{formData.phone}</strong> and the password you set.
            </p>
            <p className="text-xs text-slate-600">
              {registeredPatient.syncStatus === 'synced'
                ? t('syncComplete')
                : t('syncPending')}
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
            >
              {t('returnRegistry')}
            </button>
          </div>
        ) : (
        <>
        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Demographics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('fullName')}</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Lakshmi Devi"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('ageLabel')}</label>
              <input
                type="number"
                name="age"
                required
                value={formData.age}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('sexLabel')}</label>
              <select
                name="sex"
                value={formData.sex}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                <span>{t('contactPhone')}</span>
              </label>
              <input
                type="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                autoComplete="tel"
                placeholder="+91 97712 34091"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">This is your sign-in ID.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                <span>Email (optional)</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" />
                <span>Password*</span>
              </label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Lock className="h-3.5 w-3.5" />
                <span>Confirm password*</span>
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Section 2: District & Village Selection */}
          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              {t('villageCircuit')}
            </h3>
            <DistrictVillageSelector
              selectedDistrict={selectedDistrict}
              onDistrictChange={setSelectedDistrict}
              selectedVillage={selectedVillage}
              onVillageChange={setSelectedVillage}
              onVillageCodeChange={setSelectedVillageCode}
            />
          </div>

          {/* Section 3: Chronic Conditions */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('chronicConditions')}
            </label>
            <div className="flex flex-wrap gap-2">
              {['Essential Hypertension', 'Type 2 Diabetes Mellitus', 'Heart Disease', 'Asthma / Respiratory', 'Arthritis'].map((cond) => {
                const selected = formData.conditions.includes(cond);
                return (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => toggleCondition(cond)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      selected
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cond}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Allergies */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('knownAllergies')}</label>
            <input
              type="text"
              name="allergies"
              value={formData.allergies}
              onChange={handleChange}
              placeholder="e.g. Sulfa drugs, Penicillin"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Digital Consent (DPDP Act 2023) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
            <input
              type="checkbox"
              id="consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
            />
            <label htmlFor="consent" className="text-[11px] text-slate-600 leading-normal cursor-pointer">
              <strong className="text-slate-800">{t('consentTitle')}</strong> {t('consentText')}
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>{t('submittingPatient')}</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{t('submitPatient')}</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-teal-600 hover:underline">
            Sign in
          </Link>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
