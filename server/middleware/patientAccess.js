const mongoose = require('mongoose');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const { getStatus, memoryStore } = require('../db');

const findPatient = async (patientId) => {
  const { isConnected } = getStatus();
  if (isConnected) {
    if (!mongoose.isValidObjectId(patientId)) return null;
    return PatientProfile.findById(patientId);
  }
  return memoryStore.patients.find(patient =>
    String(patient._id) === String(patientId) || patient.patientId === patientId
  ) || null;
};

const authorizePatientAccess = async (req, patient) => {
  if (!patient || !req.user) return false;
  if (req.user.role === 'patient') {
    return String(patient.userId) === String(req.user.id);
  }
  if (req.user.role !== 'doctor') return false;

  const { isConnected } = getStatus();
  const doctorProfile = isConnected
    ? await DoctorProfile.findOne({ userId: req.user.id })
    : memoryStore.doctors.find(doctor => String(doctor.userId) === String(req.user.id));

  if (!doctorProfile || !doctorProfile.isVerified || doctorProfile.verificationStatus !== 'verified') {
    return false;
  }
  if (String(patient.assignedDoctorId || '') !== String(doctorProfile._id)) {
    return false;
  }

  req.doctorProfile = doctorProfile;
  return true;
};

module.exports = { findPatient, authorizePatientAccess };
