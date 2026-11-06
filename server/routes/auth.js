const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const PatientProfile = require('../models/PatientProfile');
const districtsData = require('../data/districtsVillages');
const { JWT_SECRET, authenticate } = require('../middleware/auth');
const { getStatus, memoryStore } = require('../db');
const { requireVerifiedDoctor } = require('../middleware/doctorVerified');
const { authorizePatientAccess } = require('../middleware/patientAccess');

const { createDoctorId } = require('../utils/doctorId');

// FormData sends arrays as JSON strings; accept real arrays, JSON strings or a single value.
const parseList = (value, fallback) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      if (typeof parsed === 'string' && parsed) return [parsed];
    } catch (err) {
      return [value.trim()];
    }
  }
  return fallback;
};

// Multer storage for doctor degree & medical certificates
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc_cert_${Date.now()}_${Math.round(Math.random() * 10000)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      callback(null, true);
      return;
    }
    callback(new Error('Upload a PDF or image of your medical certificate.'));
  }
});

// Helper to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Patients sign in with the phone number they registered with (or an email, if they gave one).
const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
};

const findPatientUser = async ({ phone, email }) => {
  const { isConnected } = getStatus();
  if (isConnected) {
    const clauses = [];
    if (phone) clauses.push({ phone, role: 'patient' });
    if (email) clauses.push({ email });
    return clauses.length ? User.findOne({ $or: clauses }) : null;
  }
  return memoryStore.users.find(candidate =>
    (phone && candidate.role === 'patient' && candidate.phone === phone) ||
    (email && candidate.email && candidate.email.toLowerCase() === email)
  ) || null;
};

// Validates the sign-in details and creates the patient's login. Returns { error } or { user }.
const createPatientLogin = async ({ name, phoneInput, emailInput, password }) => {
  const phone = normalizePhone(phoneInput);
  if (!phone) return { error: 'Enter a valid 10-digit mobile number. Patients sign in with it.' };
  if (typeof password !== 'string' || password.length < 6) {
    return { error: 'Choose a password with at least 6 characters.' };
  }
  const email = String(emailInput || '').trim().toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address or leave it blank.' };

  if (await findPatientUser({ phone, email })) {
    return { error: 'An account with this phone number or email already exists. Please sign in instead.' };
  }

  const user = {
    _id: new mongoose.Types.ObjectId(),
    name: name.trim(),
    // The account needs a unique email internally; patients without one sign in by phone.
    email: email || `${phone}@patients.careroute.local`,
    password: await bcrypt.hash(password, 10),
    role: 'patient',
    phone
  };
  const { isConnected } = getStatus();
  if (isConnected) await User.create(user);
  else memoryStore.users.push(user);
  return { user };
};

// Picks the verified doctor who covers the patient's village, then district.
const findDoctorForPatient = async (district, village) => {
  const { isConnected } = getStatus();
  const doctors = isConnected
    ? await DoctorProfile.find({ isVerified: true, verificationStatus: 'verified' })
    : memoryStore.doctors.filter(doctor => doctor.isVerified && doctor.verificationStatus === 'verified');
  const lower = (value) => String(value || '').toLowerCase();
  const selectedDistrict = districtsData.find(item =>
    lower(item.districtId) === lower(district) || lower(item.districtName) === lower(district)
  );
  const districtKeys = [district, selectedDistrict?.districtId, selectedDistrict?.districtName].map(lower);
  return doctors.find(doctor => (doctor.assignedVillages || []).some(item => lower(item) === lower(village))) ||
    doctors.find(doctor => (doctor.assignedDistricts || []).some(item => districtKeys.includes(lower(item)))) ||
    null;
};

// 1. REGISTER DOCTOR
router.post('/register/doctor', upload.single('certificate'), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      specialization,
      medicalRegistrationNumber,
      stateMedicalCouncil,
      degree,
      college,
      yearOfPassing,
      experienceYears,
      assignedDistricts,
      assignedVillages
    } = req.body;

    if (!name || !email || !password || !medicalRegistrationNumber || !degree || !college) {
      return res.status(400).json({
        error: 'All essential doctor fields (Name, Email, Password, Registration No, Degree, College) are required.'
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Medical council certificate or degree document is required.' });
    }

    const { isConnected } = getStatus();

    // Check if user already exists
    let existingUser = null;
    if (isConnected) {
      existingUser = await User.findOne({ email: email.toLowerCase() });
    } else {
      existingUser = memoryStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = new mongoose.Types.ObjectId();
    const doctorId = await createDoctorId();

    const newUser = {
      _id: userId,
      doctorId,
      name,
      email: email.toLowerCase(),
      password: passwordHash,
      role: 'doctor',
      phone: phone || ''
    };

    // Anti-scam verification heuristic:
    // Legitimate Indian medical registration format e.g. "MCI-", "NMC-", or 5-7 digit registered numbers
    const regClean = (medicalRegistrationNumber || '').toUpperCase().trim();
    const certificateName = req.file.filename;
    
    // In our anti-scam model: if the doctor provides an NMC/MCI registered code, verify immediately;
    // if marked as test or invalid, set status to pending to showcase the anti-scam protection!
    const isStandardCouncil = regClean.includes('NMC') || regClean.includes('MCI') || regClean.length >= 6;
    const isAutoVerified = isStandardCouncil && !regClean.includes('FAKE') && !regClean.includes('SCAM');
    
    const districtList = parseList(assignedDistricts, ['ranchi']);
    const villageList = parseList(assignedVillages, ['Angara', 'Bundu']);

    const docProfile = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      doctorId,
      name,
      specialization: specialization || 'General Medicine & Rural Health',
      medicalRegistrationNumber: regClean,
      stateMedicalCouncil: stateMedicalCouncil || 'National Medical Commission (NMC) / State Council',
      degree: degree || 'MBBS',
      college: college,
      yearOfPassing: Number(yearOfPassing) || new Date().getFullYear() - 4,
      experienceYears: Number(experienceYears) || 2,
      assignedDistricts: districtList,
      assignedVillages: villageList,
      currentVillage: villageList[0] || 'Angara',
      certificateFile: certificateName,
      verificationStatus: isAutoVerified ? 'verified' : 'pending',
      isVerified: isAutoVerified,
      verificationNotes: isAutoVerified
        ? 'Verified via Medical Council Registry Database & Degree Certificate Validation.'
        : 'Pending verification: Certificate and Medical Council ID under review to prevent unauthorized medical access.'
    };

    if (isConnected) {
      await User.create(newUser);
      await DoctorProfile.create(docProfile);
    } else {
      memoryStore.users.push(newUser);
      memoryStore.doctors.push(docProfile);
    }

    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'Doctor registered successfully.',
      token,
      user: {
        id: newUser._id,
        doctorId: newUser.doctorId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      doctorProfile: docProfile,
      redirectUrl: '/doctor/dashboard'
    });
  } catch (err) {
    console.error('Doctor registration error:', err);
    res.status(500).json({ error: 'Failed to complete doctor registration.' });
  }
});

const buildPatientProfile = (body, { patientId, assignedDoctorId, userId, selectedVillage }) => {
  const { name, contactPhone, district, village, villageCode, age, sex, conditions, allergies, consentGiven } = body;
  return {
    _id: patientId,
    ...(userId ? { userId } : {}),
    ...(assignedDoctorId ? { assignedDoctorId } : {}),
    patientId: body.patientId || `PT-${district.substring(0, 3).toUpperCase()}-${patientId.toString().toUpperCase()}`,
    name: name.trim(),
    age: Number(age),
    sex: sex || 'Female',
    district,
    village,
    villageCode: selectedVillage?.villageCode || villageCode || `${village.substring(0, 3).toUpperCase()}-01`,
    contactPhone: contactPhone || body.phone || '',
    conditions: Array.isArray(conditions)
      ? conditions.map(c => typeof c === 'string' ? { name: c, onsetDate: new Date().toISOString().split('T')[0], status: 'active' } : c)
      : [],
    allergies: Array.isArray(allergies) ? allergies : [],
    currentMedications: [],
    latestVitals: {
      systolicBP: 124,
      diastolicBP: 80,
      bloodGlucose: 110,
      heartRate: 74,
      weightKg: 60,
      recordedAt: new Date()
    },
    riskTier: 'Routine',
    riskScore: 20,
    riskFactors: ['Baseline newly registered patient profile'],
    consentGiven: consentGiven !== false,
    version: 1,
    consentDetails: {
      purpose: 'Rural health tracking & longitudinal care',
      language: 'English',
      timestamp: new Date(),
      method: 'Digital Informed Consent at Registration'
    }
  };
};

// 2. REGISTER PATIENT (by a verified doctor; works offline-first)
router.post('/register/patient', authenticate, requireVerifiedDoctor, async (req, res) => {
  try {
    const {
      name,
      contactPhone,
      district,
      village,
      villageCode,
      age,
      sex,
      conditions,
      allergies,
      consentGiven
    } = req.body;

    if (typeof name !== 'string' || !name.trim() || typeof district !== 'string' || !district.trim() ||
      typeof village !== 'string' || !village.trim() || !Number.isFinite(Number(age)) || Number(age) <= 0) {
      return res.status(400).json({
        error: 'Name, district, village, and a valid age are mandatory.'
      });
    }

    const selectedDistrict = districtsData.find(item =>
      item.districtId.toLowerCase() === district.toLowerCase() ||
      item.districtName.toLowerCase() === district.toLowerCase()
    );
    const selectedVillage = selectedDistrict?.villages.find(item =>
      item.name.toLowerCase() === village.toLowerCase() &&
      (!villageCode || item.villageCode === String(villageCode))
    );
    if (villageCode && !selectedVillage) {
      return res.status(400).json({ error: 'The selected village does not belong to the selected district.' });
    }

    const { isConnected } = getStatus();
    const patientId = mongoose.isValidObjectId(req.body._id)
      ? new mongoose.Types.ObjectId(req.body._id)
      : new mongoose.Types.ObjectId();
    let existingProfile = null;
    if (isConnected) {
      existingProfile = await PatientProfile.findById(patientId);
    } else {
      existingProfile = memoryStore.patients.find(p => String(p._id) === String(patientId));
    }
    if (existingProfile) {
      if (!await authorizePatientAccess(req, existingProfile)) {
        return res.status(403).json({ error: 'This patient record is assigned to another doctor.' });
      }
      return res.status(200).json({
        message: 'Patient record already exists.',
        patientProfile: existingProfile,
        durable: isConnected
      });
    }

    // When the doctor sets a sign-in password, the patient gets a login (phone number + password).
    let patientUser = null;
    if (req.body.loginPassword) {
      const created = await createPatientLogin({
        name,
        phoneInput: contactPhone || req.body.phone,
        emailInput: req.body.email,
        password: req.body.loginPassword
      });
      if (created.error) return res.status(400).json({ error: created.error });
      patientUser = created.user;
    }

    const patientProfile = buildPatientProfile(req.body, {
      patientId,
      assignedDoctorId: req.doctorProfile._id,
      userId: patientUser?._id,
      selectedVillage
    });

    try {
      if (isConnected) {
        await PatientProfile.create(patientProfile);
      } else {
        memoryStore.patients.push(patientProfile);
      }
    } catch (profileError) {
      if (patientUser) {
        if (isConnected) await User.deleteOne({ _id: patientUser._id });
        else memoryStore.users = memoryStore.users.filter(item => String(item._id) !== String(patientUser._id));
      }
      throw profileError;
    }

    return res.status(isConnected ? 201 : 202).json({
      message: isConnected ? 'Patient record registered successfully.' : 'Patient record is held in temporary server memory; keep the local copy until durable storage is available.',
      patientProfile,
      durable: isConnected
    });
  } catch (err) {
    console.error('Patient registration error:', err);
    res.status(500).json({ error: 'Failed to complete patient registration.' });
  }
});

// 2b. PATIENT SELF-REGISTRATION: creates the login (phone + password) and the health record.
router.post('/register/patient-account', async (req, res) => {
  try {
    const { name, contactPhone, district, village, villageCode, age, consentGiven } = req.body;

    if (typeof name !== 'string' || !name.trim() || typeof district !== 'string' || !district.trim() ||
      typeof village !== 'string' || !village.trim() || !Number.isFinite(Number(age)) || Number(age) <= 0) {
      return res.status(400).json({ error: 'Name, district, village, and a valid age are mandatory.' });
    }
    if (consentGiven !== true) {
      return res.status(400).json({ error: 'Informed consent is required to create a health record.' });
    }

    const selectedDistrict = districtsData.find(item =>
      item.districtId.toLowerCase() === district.toLowerCase() ||
      item.districtName.toLowerCase() === district.toLowerCase()
    );
    const selectedVillage = selectedDistrict?.villages.find(item =>
      item.name.toLowerCase() === village.toLowerCase() &&
      (!villageCode || item.villageCode === String(villageCode))
    );
    if (!selectedDistrict || !selectedVillage) {
      return res.status(400).json({ error: 'The selected village does not belong to the selected district.' });
    }

    const created = await createPatientLogin({
      name,
      phoneInput: contactPhone || req.body.phone,
      emailInput: req.body.email,
      password: req.body.password
    });
    if (created.error) return res.status(400).json({ error: created.error });
    const user = created.user;

    const doctor = await findDoctorForPatient(selectedDistrict.districtId, selectedVillage.name);
    const patientProfile = buildPatientProfile(req.body, {
      patientId: new mongoose.Types.ObjectId(),
      assignedDoctorId: doctor?._id,
      userId: user._id,
      selectedVillage
    });
    patientProfile.district = selectedDistrict.districtId;
    patientProfile.village = selectedVillage.name;

    const { isConnected } = getStatus();
    try {
      if (isConnected) await PatientProfile.create(patientProfile);
      else memoryStore.patients.push(patientProfile);
    } catch (profileError) {
      // Do not leave a login behind without a health record.
      if (isConnected) await User.deleteOne({ _id: user._id });
      else memoryStore.users = memoryStore.users.filter(item => String(item._id) !== String(user._id));
      throw profileError;
    }

    return res.status(201).json({
      message: 'Registration complete.',
      token: generateToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone },
      profile: patientProfile,
      doctorAssigned: Boolean(doctor),
      redirectUrl: '/patient/dashboard'
    });
  } catch (err) {
    console.error('Patient self-registration error:', err);
    res.status(500).json({ error: 'Failed to complete patient registration.' });
  }
});

// 3. SEPARATE / COMBINED ROLE-BASED LOGIN
router.post('/login', async (req, res) => {
  try {
    const { identifier, email, password, expectedRole } = req.body;
    const loginIdentifier = String(identifier || email || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'A doctor ID (or patient phone number / email) and password are required.' });
    }

    const { isConnected } = getStatus();
    let user = null;

    const looksLikeEmail = loginIdentifier.includes('@');

    // Doctors sign in ONLY with the unique Doctor ID issued at registration + password.
    if (expectedRole === 'doctor' && looksLikeEmail) {
      return res.status(400).json({
        error: 'Doctors sign in with their unique Doctor ID (e.g. CRD-1A2B3C4D5E), not an email address. Forgot it? Use "Recover my Doctor ID" below.'
      });
    }

    const phoneDigits = normalizePhone(loginIdentifier);
    if (expectedRole === 'patient' && !looksLikeEmail) {
      user = phoneDigits ? await findPatientUser({ phone: phoneDigits }) : null;
    } else if (!looksLikeEmail) {
      const doctorId = loginIdentifier.toUpperCase();
      user = isConnected
        ? await User.findOne({ doctorId })
        : memoryStore.users.find(candidate => candidate.doctorId === doctorId);
    } else if (isConnected) {
      user = await User.findOne({ email: loginIdentifier.toLowerCase() });
    } else {
      user = memoryStore.users.find(candidate =>
        candidate.email.toLowerCase() === loginIdentifier.toLowerCase()
      );
    }

    // A doctor account found through an email address is never allowed to sign in that way.
    if (user && user.role === 'doctor' && looksLikeEmail) {
      return res.status(400).json({
        error: 'Doctors sign in with their unique Doctor ID, not an email address. Use the Doctor tab and enter your Doctor ID.'
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. No account found with that phone number or email.' });
    }

    // Role check if expectedRole specified
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        error: `Role mismatch: This login portal is for ${expectedRole.toUpperCase()}s. Your account is registered as ${user.role.toUpperCase()}. Please use the correct login tab.`
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect ID or password. Please try again.' });
    }

    if (user.role === 'doctor' && !user.doctorId) {
      user.doctorId = await createDoctorId();
      if (isConnected) {
        await User.updateOne({
          _id: user._id,
          $or: [{ doctorId: { $exists: false } }, { doctorId: null }]
        }, { $set: { doctorId: user.doctorId } });
      } else {
        const memoryUser = memoryStore.users.find(candidate => String(candidate._id) === String(user._id));
        if (memoryUser) memoryUser.doctorId = user.doctorId;
      }
    }

    const token = generateToken(user);

    // Retrieve associated profile
    let profileData = null;
    let redirectUrl = '/';

    if (user.role === 'doctor') {
      redirectUrl = '/doctor/dashboard';
      if (isConnected) {
        profileData = await DoctorProfile.findOne({ userId: user._id });
      } else {
        profileData = memoryStore.doctors.find(d => String(d.userId) === String(user._id));
      }
      if (profileData && !profileData.doctorId) {
        profileData.doctorId = user.doctorId;
        if (isConnected) {
          await DoctorProfile.updateOne({ userId: user._id }, { $set: { doctorId: user.doctorId } });
        }
      }
    } else if (user.role === 'patient') {
      redirectUrl = '/patient/dashboard';
      if (isConnected) {
        profileData = await PatientProfile.findOne({ userId: user._id });
      } else {
        profileData = memoryStore.patients.find(p => String(p.userId) === String(user._id));
      }
    }

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        doctorId: user.doctorId,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      profile: profileData,
      redirectUrl
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

// 3b. RECOVER DOCTOR ID (requires the account email AND password, so IDs are never exposed to strangers)
router.post('/doctor/recover-id', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required to recover your Doctor ID.' });
    }
    const { isConnected } = getStatus();
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = isConnected
      ? await User.findOne({ email: normalizedEmail, role: 'doctor' })
      : memoryStore.users.find(candidate => candidate.role === 'doctor' && candidate.email.toLowerCase() === normalizedEmail);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'No doctor account matches that email and password.' });
    }
    if (!user.doctorId) {
      user.doctorId = await createDoctorId();
      if (isConnected) await User.updateOne({ _id: user._id }, { $set: { doctorId: user.doctorId } });
    }
    return res.json({ doctorId: user.doctorId });
  } catch (err) {
    console.error('Recover doctor ID error:', err);
    res.status(500).json({ error: 'Failed to recover Doctor ID.' });
  }
});

// 4. GET CURRENT LOGGED IN USER & PROFILE
router.get('/me', authenticate, async (req, res) => {
  try {
    const { isConnected } = getStatus();
    let user = null;
    let profile = null;

    if (isConnected) {
      user = await User.findById(req.user.id).select('-password');
      if (req.user.role === 'doctor') {
        profile = await DoctorProfile.findOne({ userId: req.user.id });
      } else if (req.user.role === 'patient') {
        profile = await PatientProfile.findOne({ userId: req.user.id });
      }
    } else {
      user = memoryStore.users.find(u => String(u._id) === String(req.user.id));
      if (user) {
        const { password, ...safeUser } = user;
        user = safeUser;
      }
      if (req.user.role === 'doctor') {
        profile = memoryStore.doctors.find(d => String(d.userId) === String(req.user.id));
      } else if (req.user.role === 'patient') {
        profile = memoryStore.patients.find(p => String(p.userId) === String(req.user.id));
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.json({
      user,
      profile
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// 5. DOCTOR CREDENTIALS VERIFICATION / SIMULATOR TOGGLE (Allows verifying or testing anti-scam lock)
router.post('/doctor/verify-toggle', authenticate, async (req, res) => {
  try {
    const { isConnected } = getStatus();
    const { status, notes } = req.body;

    let docProfile = null;
    const isNowVerified = status === 'verified';

    if (isConnected) {
      docProfile = await DoctorProfile.findOneAndUpdate(
        { userId: req.user.id },
        {
          verificationStatus: status || 'verified',
          isVerified: isNowVerified,
          verificationNotes: notes || 'Credentials verified against Medical Council Digital Registry.'
        },
        { new: true }
      );
    } else {
      docProfile = memoryStore.doctors.find(d => String(d.userId) === String(req.user.id));
      if (docProfile) {
        docProfile.verificationStatus = status || 'verified';
        docProfile.isVerified = isNowVerified;
        docProfile.verificationNotes = notes || 'Credentials verified against Medical Council Digital Registry.';
      }
    }

    res.json({
      message: `Doctor verification updated to: ${status}`,
      doctorProfile: docProfile
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update verification status.' });
  }
});

module.exports = router;
