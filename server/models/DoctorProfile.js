const mongoose = require('mongoose');

const doctorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorId: {
    type: String,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  specialization: {
    type: String,
    required: true,
    default: 'General Medicine & Rural Health'
  },
  medicalRegistrationNumber: {
    type: String,
    required: true,
    trim: true
  },
  stateMedicalCouncil: {
    type: String,
    required: true,
    default: 'National Medical Commission (NMC) / State Council'
  },
  degree: {
    type: String,
    required: true,
    default: 'MBBS'
  },
  college: {
    type: String,
    required: true
  },
  yearOfPassing: {
    type: Number,
    required: true
  },
  experienceYears: {
    type: Number,
    default: 5
  },
  assignedDistricts: [{
    type: String
  }],
  assignedVillages: [{
    type: String
  }],
  currentVillage: {
    type: String,
    default: 'Angara'
  },
  certificateFile: {
    type: String,
    default: 'doctor_license_verified.pdf'
  },
  verificationStatus: {
    type: String,
    enum: ['verified', 'pending', 'rejected', 'unverified'],
    default: 'pending'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationNotes: {
    type: String,
    default: 'Medical credentials cross-checked against council registry database.'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);
module.exports = DoctorProfile;
