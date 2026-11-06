const DoctorProfile = require('../models/DoctorProfile');
const { getStatus, memoryStore } = require('../db');

/**
 * Anti-Scam Doctor Verification Guard:
 * Restricts unverified or fraudulent doctors from viewing, reading, or modifying patient records.
 * Protects patients under healthcare compliance & India DPDP Act 2023.
 */
const requireVerifiedDoctor = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({
        error: 'Access restricted: Only licensed clinical doctors are authorized.'
      });
    }

    const { isConnected } = getStatus();
    let docProfile = null;

    if (isConnected) {
      docProfile = await DoctorProfile.findOne({ userId: req.user.id });
    } else {
      docProfile = memoryStore.doctors.find(d => String(d.userId) === String(req.user.id));
    }

    if (!docProfile) {
      return res.status(403).json({
        error: 'Doctor profile not found. Please complete your registration and submit qualification certificates.',
        needsVerification: true
      });
    }

    if (!docProfile.isVerified || docProfile.verificationStatus !== 'verified') {
      return res.status(403).json({
        error: 'ACCESS BLOCKED (ANTI-SCAM PROTECTION): Your medical credentials and degree certificates are currently pending verification. Unverified accounts cannot access patient medical records.',
        status: docProfile.verificationStatus || 'pending',
        needsVerification: true,
        reason: 'Under medical safety protocol, only verified clinical practitioners with accredited Medical Council registration numbers and verified degree certificates are granted access to patient health timelines.'
      });
    }

    req.doctorProfile = docProfile;
    next();
  } catch (err) {
    console.error('Doctor verification check error:', err);
    return res.status(500).json({ error: 'Failed to verify doctor license status.' });
  }
};

module.exports = {
  requireVerifiedDoctor
};
