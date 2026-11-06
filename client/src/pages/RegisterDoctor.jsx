import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DistrictVillageSelector from '../components/DistrictVillageSelector';
import {
  Stethoscope,
  ShieldCheck,
  FileCheck,
  Upload,
  AlertCircle,
  Building2,
  GraduationCap,
  Calendar,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2
} from 'lucide-react';

export default function RegisterDoctor() {
  const { registerDoctor } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    specialization: 'Family Medicine & Chronic Care',
    medicalRegistrationNumber: '',
    stateMedicalCouncil: 'Jharkhand State Medical Council',
    degree: 'MBBS',
    college: '',
    yearOfPassing: 2018,
    experienceYears: 6,
    assignedDistricts: ['ranchi'],
    assignedVillages: ['Angara', 'Bundu']
  });

  const [selectedDistrict, setSelectedDistrict] = useState('ranchi');
  const [selectedVillage, setSelectedVillage] = useState('Angara');
  const [certFile, setCertFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredDoctorId, setRegisteredDoctorId] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.password || !formData.medicalRegistrationNumber || !formData.college || !certFile) {
      setError('Please fill in all mandatory fields and upload your medical council certificate or degree document.');
      return;
    }

    setLoading(true);

    try {
      const dataPayload = new FormData();
      Object.keys(formData).forEach(key => {
        if (Array.isArray(formData[key])) {
          dataPayload.append(key, JSON.stringify(formData[key]));
        } else {
          dataPayload.append(key, formData[key]);
        }
      });

      // Update primary district & village
      dataPayload.set('assignedDistricts', JSON.stringify([selectedDistrict]));
      dataPayload.set('assignedVillages', JSON.stringify([selectedVillage]));

      if (certFile) {
        dataPayload.append('certificate', certFile);
      }

      const registration = await registerDoctor(dataPayload);
      setRegisteredDoctorId(registration.user.doctorId);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-200">
            <Stethoscope className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Field Doctor Registration & Credential Verification
          </h2>
        </div>

        {/* Anti-Scam Notice Card */}
        <div className="mb-6 p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-emerald-950">National Medical Commission (NMC) Verification Protocol</div>
            <div className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
              Your State Council Registration Number, accredited degree, and certificate document are cross-checked before full clinical clearance is granted.
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {registeredDoctorId ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h3 className="mt-3 text-lg font-extrabold text-emerald-950">Registration complete</h3>
            <p className="mt-2 text-sm text-emerald-900">
              Save this unique Doctor ID. Use it with your password the next time you sign in.
            </p>
            <p className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-3 font-mono text-lg font-bold tracking-wider text-slate-900">
              {registeredDoctorId}
            </p>
            <button
              type="button"
              onClick={() => navigate('/doctor/dashboard')}
              className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800"
            >
              Continue to Doctor Dashboard
            </button>
          </div>
        ) : (
          <>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
              <User className="w-3.5 h-3.5" />
              <span>1. Clinician Personal Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Doctor Full Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Dr. Ravi Kumar"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98351 22410"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="doctor@careroute.org"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Medical Credentials & Certificates */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>2. Medical Education & Council Registration</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Medical Council Reg. Number *
                </label>
                <input
                  type="text"
                  name="medicalRegistrationNumber"
                  required
                  value={formData.medicalRegistrationNumber}
                  onChange={handleChange}
                  placeholder="e.g. NMC-JH-2016-44821"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Cross-checked via State / NMC digital index</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State Medical Council *</label>
                <select
                  name="stateMedicalCouncil"
                  value={formData.stateMedicalCouncil}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Jharkhand State Medical Council">Jharkhand State Medical Council</option>
                  <option value="Bihar Council of Medical Registration">Bihar Council of Medical Registration</option>
                  <option value="West Bengal Medical Council">West Bengal Medical Council</option>
                  <option value="Delhi Medical Council">Delhi Medical Council</option>
                  <option value="National Medical Commission">National Medical Commission (NMC)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Medical Degree / Qualification *</label>
                <input
                  type="text"
                  name="degree"
                  required
                  value={formData.degree}
                  onChange={handleChange}
                  placeholder="e.g. MBBS, MD (Community Medicine)"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Medical College / University *</label>
                <input
                  type="text"
                  name="college"
                  required
                  value={formData.college}
                  onChange={handleChange}
                  placeholder="e.g. RIMS, Ranchi / AIIMS"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Year of Passing</label>
                <input
                  type="number"
                  name="yearOfPassing"
                  value={formData.yearOfPassing}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Experience (Years)</label>
                <input
                  type="number"
                  name="experienceYears"
                  value={formData.experienceYears}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Certificate Upload Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Upload Medical Council Certificate / Degree PDF *</span>
              </label>
              <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors">
                <input
                  type="file"
                  id="certUpload"
                  name="certificate"
                  accept="application/pdf,image/*"
                  className="sr-only"
                  required
                  onChange={(e) => setCertFile(e.target.files[0])}
                />
                <label htmlFor="certUpload" className="cursor-pointer text-xs font-semibold text-slate-600">
                  <Upload className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                  {certFile ? (
                    <span className="text-emerald-700 font-bold">{certFile.name}</span>
                  ) : (
                    <span>Click to attach a required Medical Certificate (PDF / JPG)</span>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Circuit Assigned District & Village */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>3. Primary Rural District & Village Circuit</span>
            </h3>

            <DistrictVillageSelector
              selectedDistrict={selectedDistrict}
              onDistrictChange={setSelectedDistrict}
              selectedVillage={selectedVillage}
              onVillageChange={setSelectedVillage}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span>Verifying Credentials & Registering...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Submit Doctor Registration & Verify License</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-emerald-600 hover:underline">
            Sign In to Doctor Dashboard
          </Link>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
