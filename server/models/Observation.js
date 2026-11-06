const mongoose = require('mongoose');

const observationSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PatientProfile',
    required: true
  },
  type: {
    type: String,
    enum: ['bp_systolic', 'bp_diastolic', 'blood_glucose', 'weight', 'heart_rate', 'medication_adherence'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    enum: ['doctor_visit', 'health_worker', 'patient_checkin', 'ocr_report'],
    default: 'doctor_visit'
  },
  recordedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
});

const Observation = mongoose.model('Observation', observationSchema);
module.exports = Observation;
