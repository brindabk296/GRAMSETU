const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PatientProfile',
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  village: {
    type: String,
    required: true
  },
  district: {
    type: String,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Routine'],
    default: 'Routine'
  },
  status: {
    type: String,
    enum: ['due', 'overdue', 'escalated', 'completed', 'missed'],
    default: 'due'
  },
  assignedDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DoctorProfile'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const FollowUp = mongoose.model('FollowUp', followUpSchema);
module.exports = FollowUp;
