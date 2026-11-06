const mongoose = require('mongoose');

const patientProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  patientId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  sex: {
    type: String,
    enum: ['Female', 'Male', 'Other'],
    default: 'Female'
  },
  district: {
    type: String,
    required: true
  },
  village: {
    type: String,
    required: true
  },
  villageCode: {
    type: String,
    default: 'ANG-01'
  },
  contactPhone: {
    type: String,
    default: ''
  },
  conditions: [{
    name: String,
    onsetDate: String,
    status: { type: String, default: 'active' }
  }],
  allergies: [{
    type: String
  }],
  currentMedications: [{
    name: String,
    dosage: String,
    frequency: String,
    purpose: String,
    instructions: String,
    startDate: String
  }],
  latestVitals: {
    systolicBP: Number,
    diastolicBP: Number,
    bloodGlucose: Number,
    heartRate: Number,
    weightKg: Number,
    recordedAt: Date
  },
  riskTier: {
    type: String,
    enum: ['Critical', 'High', 'Moderate', 'Routine'],
    default: 'Routine'
  },
  riskScore: {
    type: Number,
    default: 15
  },
  riskFactors: [{
    type: String
  }],
  consentGiven: {
    type: Boolean,
    default: true
  },
  consentDetails: {
    purpose: { type: String, default: 'Rural Longitudinal Healthcare and Trend Monitoring' },
    language: { type: String, default: 'English' },
    timestamp: { type: Date, default: Date.now },
    method: { type: String, default: 'Digital Informed Consent & Verbal Confirmation' }
  },
  assignedDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DoctorProfile'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1
  }
});

const PatientProfile = mongoose.model('PatientProfile', patientProfileSchema);
module.exports = PatientProfile;
