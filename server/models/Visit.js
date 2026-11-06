const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PatientProfile',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DoctorProfile'
  },
  doctorName: {
    type: String,
    default: 'Dr. Ravi (Field Doctor)'
  },
  village: {
    type: String,
    required: true
  },
  district: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  symptoms: [{
    type: String
  }],
  vitals: {
    systolicBP: Number,
    diastolicBP: Number,
    bloodGlucose: Number,
    heartRate: Number,
    weightKg: Number
  },
  doctorNotes: {
    type: String,
    default: ''
  },
  voiceNoteTranscript: {
    type: String,
    default: ''
  },
  prescriptions: [{
    medicine: String,
    dosage: String,
    frequency: String,
    purpose: String,
    instructions: String
  }],
  clinicalPlan: {
    type: String,
    default: ''
  },
  aiSnapshotSummary: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    enum: ['doctor_visit', 'health_worker', 'patient_checkin', 'ocr_report'],
    default: 'doctor_visit'
  },
  isOfflineSynced: {
    type: Boolean,
    default: true
  }
});

const Visit = mongoose.model('Visit', visitSchema);
module.exports = Visit;
