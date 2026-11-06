const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const PatientProfile = require('../models/PatientProfile');
const Visit = require('../models/Visit');
const Observation = require('../models/Observation');
const FollowUp = require('../models/FollowUp');
const ChatMessage = require('../models/ChatMessage');
const { getStatus, memoryStore } = require('../db');

const seedAllData = async () => {
  const { isConnected } = getStatus();
  console.log(`[Seed Engine] Seeding CareRoute AI database (Connected to Mongo Atlas: ${isConnected})...`);

  const passwordHash = await bcrypt.hash('doctor123', 10);
  const patientPasswordHash = await bcrypt.hash('patient123', 10);

  // 1. Doctors
  const verifiedDoctorUser = {
    _id: new mongoose.Types.ObjectId(),
    doctorId: 'CRD-RAVI-0001',
    name: 'Dr. Ravi Kumar',
    email: 'doctor@careroute.org',
    password: passwordHash,
    role: 'doctor',
    phone: '+91 98351 22410',
    createdAt: new Date('2025-01-10')
  };

  const unverifiedDoctorUser = {
    _id: new mongoose.Types.ObjectId(),
    doctorId: 'CRD-SHARMA-0001',
    name: 'Dr. R. Sharma (Under Verification)',
    email: 'unverified.doc@careroute.org',
    password: passwordHash,
    role: 'doctor',
    phone: '+91 94311 00293',
    createdAt: new Date('2026-02-01')
  };

  const verifiedDocProfile = {
    _id: new mongoose.Types.ObjectId(),
    userId: verifiedDoctorUser._id,
    doctorId: verifiedDoctorUser.doctorId,
    name: verifiedDoctorUser.name,
    specialization: 'Family Medicine & Chronic Disease Management',
    medicalRegistrationNumber: 'NMC-JH-2016-44821',
    stateMedicalCouncil: 'Jharkhand State Medical Council (Verified & Active)',
    degree: 'MBBS, MD (Community Medicine)',
    college: 'Rajendra Institute of Medical Sciences (RIMS), Ranchi',
    yearOfPassing: 2016,
    experienceYears: 10,
    assignedDistricts: ['ranchi', 'khunti'],
    assignedVillages: ['Angara', 'Bundu', 'Burmu', 'Kanke', 'Ormanjhi', 'Ratu'],
    currentVillage: 'Angara',
    certificateFile: 'rims_medical_council_license_44821.pdf',
    verificationStatus: 'verified',
    isVerified: true,
    verificationNotes: 'NMC registration checked against digital national registry. State council active license verified.'
  };

  const unverifiedDocProfile = {
    _id: new mongoose.Types.ObjectId(),
    userId: unverifiedDoctorUser._id,
    doctorId: unverifiedDoctorUser.doctorId,
    name: unverifiedDoctorUser.name,
    specialization: 'General Practitioner',
    medicalRegistrationNumber: 'PENDING-REG-2026-99',
    stateMedicalCouncil: 'Jharkhand State Medical Council (Application Under Review)',
    degree: 'MBBS (Provisional)',
    college: 'Private Medical Institute',
    yearOfPassing: 2024,
    experienceYears: 1,
    assignedDistricts: ['ranchi'],
    assignedVillages: ['Angara'],
    currentVillage: 'Angara',
    certificateFile: 'provisional_certificate_pending.pdf',
    verificationStatus: 'pending',
    isVerified: false,
    verificationNotes: 'Pending council background verification and notarized certificate review.'
  };

  // 2. Patients
  const patientUsers = [
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Lakshmi Devi',
      email: 'lakshmi@ruralcare.in',
      password: patientPasswordHash,
      role: 'patient',
      phone: '+91 97712 34091'
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Ramu Soren',
      email: 'ramu@ruralcare.in',
      password: patientPasswordHash,
      role: 'patient',
      phone: '+91 98354 88201'
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Sita Munda',
      email: 'patient@ruralcare.in',
      password: patientPasswordHash,
      role: 'patient',
      phone: '+91 94318 76543'
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Birsa Oraon',
      email: 'birsa@ruralcare.in',
      password: patientPasswordHash,
      role: 'patient',
      phone: '+91 91234 56789'
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Anita Kumari',
      email: 'anita@ruralcare.in',
      password: patientPasswordHash,
      role: 'patient',
      phone: '+91 99341 12345'
    }
  ];

  const patientProfiles = [
    {
      _id: new mongoose.Types.ObjectId(),
      userId: patientUsers[0]._id,
      patientId: 'PT-RNC-001',
      name: 'Lakshmi Devi',
      age: 58,
      sex: 'Female',
      district: 'ranchi',
      village: 'Angara',
      villageCode: 'ANG-01',
      contactPhone: patientUsers[0].phone,
      conditions: [
        { name: 'Essential Hypertension', onsetDate: '2022-04-12', status: 'active' },
        { name: 'Type 2 Diabetes Mellitus', onsetDate: '2023-08-10', status: 'active' }
      ],
      allergies: ['Sulfa Drugs'],
      currentMedications: [
        { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily (morning)', purpose: 'Lowers high blood pressure and helps protect the heart.', instructions: 'Take one tablet every morning at the same time. Do not stop it suddenly even if you feel well. Tell your doctor about ankle swelling or dizziness.', startDate: '2024-01-10' },
        { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily with meals', purpose: 'Controls blood sugar in type 2 diabetes.', instructions: 'Take with or right after meals to avoid stomach upset. Do not skip meals. Tell your doctor about persistent vomiting or diarrhoea.', startDate: '2024-01-10' }
      ],
      latestVitals: {
        systolicBP: 154,
        diastolicBP: 96,
        bloodGlucose: 168,
        heartRate: 78,
        weightKg: 64,
        recordedAt: new Date(Date.now() - 3 * 86400000)
      },
      riskTier: 'High',
      riskScore: 78,
      riskFactors: [
        'Worsening systolic BP slope (+4.2 mmHg/month)',
        'Forecast proximity to Stage-2 threshold (160 mmHg) in 6-8 weeks',
        'Dual chronic burden (Hypertension + T2DM)'
      ],
      consentGiven: true,
      assignedDoctorId: verifiedDocProfile._id
    },
    {
      _id: new mongoose.Types.ObjectId(),
      userId: patientUsers[1]._id,
      patientId: 'PT-RNC-002',
      name: 'Ramu Soren',
      age: 62,
      sex: 'Male',
      district: 'ranchi',
      village: 'Bundu',
      villageCode: 'BUN-02',
      contactPhone: patientUsers[1].phone,
      conditions: [
        { name: 'Type 2 Diabetes Mellitus', onsetDate: '2021-03-15', status: 'active' },
        { name: 'Peripheral Neuropathy', onsetDate: '2024-02-18', status: 'active' }
      ],
      allergies: ['Penicillin'],
      currentMedications: [
        { name: 'Metformin', dosage: '850mg', frequency: 'Twice daily', purpose: 'Controls blood sugar in type 2 diabetes.', instructions: 'Take with or right after meals to avoid stomach upset. Do not skip meals. Tell your doctor about persistent vomiting or diarrhoea.', startDate: '2023-05-10' },
        { name: 'Glimepiride', dosage: '2mg', frequency: 'Once daily before breakfast', purpose: 'Helps the body release insulin to lower blood sugar in type 2 diabetes.', instructions: 'Take with or just before breakfast. Do not skip meals. Keep a sweet with you in case of shakiness, sweating or sudden weakness.', startDate: '2023-05-10' }
      ],
      latestVitals: {
        systolicBP: 138,
        diastolicBP: 88,
        bloodGlucose: 242,
        heartRate: 82,
        weightKg: 59,
        recordedAt: new Date(Date.now() - 2 * 86400000)
      },
      riskTier: 'Critical',
      riskScore: 91,
      riskFactors: [
        'High fasting blood glucose (242 mg/dL)',
        'Reported medication adherence gap (missed 8 doses in 2 weeks)',
        'Symptoms of tingling/burning in soles'
      ],
      consentGiven: true,
      assignedDoctorId: verifiedDocProfile._id
    },
    {
      _id: new mongoose.Types.ObjectId(),
      userId: patientUsers[2]._id,
      patientId: 'PT-RNC-003',
      name: 'Sita Munda',
      age: 45,
      sex: 'Female',
      district: 'ranchi',
      village: 'Burmu',
      villageCode: 'BUR-03',
      contactPhone: patientUsers[2].phone,
      conditions: [
        { name: 'Stage 1 Hypertension', onsetDate: '2024-06-05', status: 'active' }
      ],
      allergies: [],
      currentMedications: [
        { name: 'Telmisartan', dosage: '40mg', frequency: 'Once daily', startDate: '2024-06-10' }
      ],
      latestVitals: {
        systolicBP: 128,
        diastolicBP: 82,
        bloodGlucose: 104,
        heartRate: 72,
        weightKg: 55,
        recordedAt: new Date(Date.now() - 5 * 86400000)
      },
      riskTier: 'Routine',
      riskScore: 22,
      riskFactors: [
        'Stable blood pressure within target range',
        'Good medication adherence reported'
      ],
      consentGiven: true,
      assignedDoctorId: verifiedDocProfile._id
    },
    {
      _id: new mongoose.Types.ObjectId(),
      userId: patientUsers[3]._id,
      patientId: 'PT-RNC-004',
      name: 'Birsa Oraon',
      age: 52,
      sex: 'Male',
      district: 'ranchi',
      village: 'Ormanjhi',
      villageCode: 'ORM-05',
      contactPhone: patientUsers[3].phone,
      conditions: [
        { name: 'Hypertension', onsetDate: '2023-11-20', status: 'active' }
      ],
      allergies: ['NSAIDs / Ibuprofen'],
      currentMedications: [
        { name: 'Amlodipine', dosage: '5mg', frequency: 'Daily morning', purpose: 'Lowers high blood pressure and helps protect the heart.', instructions: 'Take one tablet every morning at the same time. Do not stop it suddenly even if you feel well. Tell your doctor about ankle swelling or dizziness.', startDate: '2023-11-25' }
      ],
      latestVitals: {
        systolicBP: 168,
        diastolicBP: 104,
        bloodGlucose: 140,
        heartRate: 90,
        weightKg: 72,
        recordedAt: new Date(Date.now() - 1 * 86400000)
      },
      riskTier: 'Critical',
      riskScore: 88,
      riskFactors: [
        'Crisis-range Blood Pressure (168/104 mmHg)',
        'Reported persistent severe morning headache & dizziness',
        'Urgent medication dosage titration recommended'
      ],
      consentGiven: true,
      assignedDoctorId: verifiedDocProfile._id
    },
    {
      _id: new mongoose.Types.ObjectId(),
      userId: patientUsers[4]._id,
      patientId: 'PT-RNC-005',
      name: 'Anita Kumari',
      age: 34,
      sex: 'Female',
      district: 'ranchi',
      village: 'Kanke',
      villageCode: 'KAN-04',
      contactPhone: patientUsers[4].phone,
      conditions: [
        { name: 'Gestational Glucose Monitoring', onsetDate: '2026-01-15', status: 'active' }
      ],
      allergies: [],
      currentMedications: [
        { name: 'Folic Acid & Iron', dosage: '1 Tab', frequency: 'Daily', startDate: '2026-01-15' }
      ],
      latestVitals: {
        systolicBP: 118,
        diastolicBP: 76,
        bloodGlucose: 112,
        heartRate: 74,
        weightKg: 58,
        recordedAt: new Date()
      },
      riskTier: 'Moderate',
      riskScore: 40,
      riskFactors: [
        'Baseline monitoring (only 2 visits recorded - Insufficient data for slope projection)',
        'Regular prenatal vitals review required'
      ],
      consentGiven: true,
      assignedDoctorId: verifiedDocProfile._id
    }
  ];

  // 3. Historical Observations for Trend & Forecast (especially for Lakshmi Devi to show the 5-point worsening trend)
  const lakshmiId = patientProfiles[0]._id;
  const observations = [
    // Lakshmi Devi - 5 readings over 4 months showing gradual systolic climb (138 -> 142 -> 146 -> 150 -> 154)
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_systolic',
      value: 138,
      unit: 'mmHg',
      source: 'doctor_visit',
      recordedAt: new Date(Date.now() - 120 * 86400000)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_diastolic',
      value: 86,
      unit: 'mmHg',
      source: 'doctor_visit',
      recordedAt: new Date(Date.now() - 120 * 86400000)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'blood_glucose',
      value: 142,
      unit: 'mg/dL',
      source: 'doctor_visit',
      recordedAt: new Date(Date.now() - 120 * 86400000)
    },

    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_systolic',
      value: 142,
      unit: 'mmHg',
      source: 'health_worker',
      recordedAt: new Date(Date.now() - 90 * 86400000)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_diastolic',
      value: 88,
      unit: 'mmHg',
      source: 'health_worker',
      recordedAt: new Date(Date.now() - 90 * 86400000)
    },

    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_systolic',
      value: 146,
      unit: 'mmHg',
      source: 'doctor_visit',
      recordedAt: new Date(Date.now() - 60 * 86400000)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_diastolic',
      value: 92,
      unit: 'mmHg',
      source: 'doctor_visit',
      recordedAt: new Date(Date.now() - 60 * 86400000)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'blood_glucose',
      value: 154,
      unit: 'mg/dL',
      source: 'doctor_visit',
      recordedAt: new Date(Date.now() - 60 * 86400000)
    },

    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_systolic',
      value: 150,
      unit: 'mmHg',
      source: 'health_worker',
      recordedAt: new Date(Date.now() - 30 * 86400000)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_diastolic',
      value: 94,
      unit: 'mmHg',
      source: 'health_worker',
      recordedAt: new Date(Date.now() - 30 * 86400000)
    },

    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_systolic',
      value: 154,
      unit: 'mmHg',
      source: 'doctor_visit',
      recordedAt: new Date(Date.now() - 3 * 86400000)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'bp_diastolic',
      value: 96,
      unit: 'mmHg',
      source: 'doctor_visit',
      recordedAt: new Date(Date.now() - 3 * 86400000)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      type: 'blood_glucose',
      value: 168,
      unit: 'mg/dL',
      source: 'doctor_visit',
      recordedAt: new Date(Date.now() - 3 * 86400000)
    }
  ];

  // 4. Visits
  const visits = [
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      doctorId: verifiedDocProfile._id,
      doctorName: 'Dr. Ravi Kumar',
      village: 'Angara',
      district: 'ranchi',
      date: new Date(Date.now() - 60 * 86400000),
      symptoms: ['Occasional morning dizziness', 'Mild headache'],
      vitals: { systolicBP: 146, diastolicBP: 92, bloodGlucose: 154, heartRate: 76, weightKg: 64.5 },
      doctorNotes: 'BP showing slight upward climb despite Amlodipine 5mg. Advised reduced salt in diet.',
      clinicalPlan: 'Continue Amlodipine 5mg, recheck in 30 days. Health worker Sunita to check BP every fortnight.',
      source: 'doctor_visit'
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      doctorId: verifiedDocProfile._id,
      doctorName: 'Dr. Ravi Kumar',
      village: 'Angara',
      district: 'ranchi',
      date: new Date(Date.now() - 3 * 86400000),
      symptoms: ['Mild fatigue after walking', 'Heaviness in forehead'],
      vitals: { systolicBP: 154, diastolicBP: 96, bloodGlucose: 168, heartRate: 78, weightKg: 64 },
      doctorNotes: 'Systolic BP persistent above 150. Forecast suggests threshold of 160 mmHg may be crossed within 6 weeks. Discussed titrating Amlodipine to 10mg or adding Telmisartan.',
      clinicalPlan: 'Scheduled follow-up for medication titration. ASHA worker to monitor home adherence.',
      source: 'doctor_visit'
    }
  ];

  // 5. FollowUps
  const followups = [
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: lakshmiId,
      patientName: 'Lakshmi Devi',
      village: 'Angara',
      district: 'ranchi',
      dueDate: new Date(Date.now() + 4 * 86400000),
      reason: 'BP & Glucose Titration Review',
      priority: 'High',
      status: 'due',
      assignedDoctorId: verifiedDocProfile._id
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: patientProfiles[1]._id,
      patientName: 'Ramu Soren',
      village: 'Bundu',
      district: 'ranchi',
      dueDate: new Date(Date.now() - 2 * 86400000),
      reason: 'Uncontrolled Fasting Hyperglycemia & Foot Check',
      priority: 'Critical',
      status: 'overdue',
      assignedDoctorId: verifiedDocProfile._id
    },
    {
      _id: new mongoose.Types.ObjectId(),
      patientId: patientProfiles[3]._id,
      patientName: 'Birsa Oraon',
      village: 'Ormanjhi',
      district: 'ranchi',
      dueDate: new Date(Date.now() + 1 * 86400000),
      reason: 'Hypertensive Crisis Followup (BP 168/104)',
      priority: 'Critical',
      status: 'escalated',
      assignedDoctorId: verifiedDocProfile._id
    }
  ];

  // 6. Real-time Chat Messages
  const conversationId = `conv_${lakshmiId}_${verifiedDocProfile._id}`;
  const chatMessages = [
    {
      _id: new mongoose.Types.ObjectId(),
      senderId: patientUsers[0]._id,
      senderRole: 'patient',
      senderName: 'Lakshmi Devi',
      recipientId: verifiedDoctorUser._id,
      recipientRole: 'doctor',
      conversationId,
      message: 'Namaste Doctor Sahab, I am feeling mild headache and heaviness in my head since yesterday morning.',
      healthContext: { symptoms: ['headache', 'heaviness'], urgencyLevel: 'Advisory' },
      isAiGenerated: false,
      createdAt: new Date(Date.now() - 3600000 * 5)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      senderId: verifiedDoctorUser._id,
      senderRole: 'ai_assistant',
      senderName: 'CareRoute AI Health Guard',
      recipientId: patientUsers[0]._id,
      recipientRole: 'patient',
      conversationId,
      message: 'AI Triaging Note: Patient reported headache. Last recorded BP is 154/96 mmHg (High). Recommended: Rest in quiet area, avoid salt, do not skip today’s Amlodipine dose, and monitor for visual blurriness or chest tightness.',
      healthContext: { symptoms: ['headache'], urgencyLevel: 'Advisory' },
      isAiGenerated: true,
      createdAt: new Date(Date.now() - 3600000 * 4.9)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      senderId: verifiedDoctorUser._id,
      senderRole: 'doctor',
      senderName: 'Dr. Ravi Kumar (Verified)',
      recipientId: patientUsers[0]._id,
      recipientRole: 'patient',
      conversationId,
      message: 'Namaste Lakshmi Ji, I saw your latest reading from Sunita. Your blood pressure has crept up to 154/96. Please make sure you take your morning Amlodipine 5mg on time. I am visiting Angara village clinic on Thursday, please come for a quick checkup.',
      healthContext: { symptoms: [], urgencyLevel: 'Normal' },
      isAiGenerated: false,
      createdAt: new Date(Date.now() - 3600000 * 4)
    },
    {
      _id: new mongoose.Types.ObjectId(),
      senderId: patientUsers[0]._id,
      senderRole: 'patient',
      senderName: 'Lakshmi Devi',
      recipientId: verifiedDoctorUser._id,
      recipientRole: 'doctor',
      conversationId,
      message: 'Thank you Doctor Sahab! I took the medicine and will see you at the Angara clinic on Thursday.',
      healthContext: { symptoms: [], urgencyLevel: 'Normal' },
      isAiGenerated: false,
      createdAt: new Date(Date.now() - 3600000 * 2)
    }
  ];

  if (isConnected) {
    try {
      await User.deleteMany({});
      await DoctorProfile.deleteMany({});
      await PatientProfile.deleteMany({});
      await Visit.deleteMany({});
      await Observation.deleteMany({});
      await FollowUp.deleteMany({});
      await ChatMessage.deleteMany({});

      await User.insertMany([verifiedDoctorUser, unverifiedDoctorUser, ...patientUsers]);
      await DoctorProfile.insertMany([verifiedDocProfile, unverifiedDocProfile]);
      await PatientProfile.insertMany(patientProfiles);
      await Observation.insertMany(observations);
      await Visit.insertMany(visits);
      await FollowUp.insertMany(followups);
      await ChatMessage.insertMany(chatMessages);
      console.log('>>> [Seed Engine] MongoDB Atlas successfully populated with CareRoute AI synthetic clinical data! <<<');
    } catch (err) {
      console.error('Error writing seed to MongoDB Atlas:', err.message);
    }
  }

  // Populate memory fallback store as well
  memoryStore.users = [verifiedDoctorUser, unverifiedDoctorUser, ...patientUsers];
  memoryStore.doctors = [verifiedDocProfile, unverifiedDocProfile];
  memoryStore.patients = patientProfiles;
  memoryStore.observations = observations;
  memoryStore.visits = visits;
  memoryStore.followups = followups;
  memoryStore.chatMessages = chatMessages;

  console.log(`[Seed Engine] Ready: ${patientProfiles.length} rural patients, 2 doctor profiles (1 verified, 1 unverified test account), ${observations.length} time-series vitals.`);
};

module.exports = { seedAllData };
