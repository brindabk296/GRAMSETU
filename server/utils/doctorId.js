const { randomBytes } = require('crypto');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const { getStatus, memoryStore } = require('../db');

// Generates a unique, hard-to-guess doctor ID such as CRD-3F9A1C07B2.
const createDoctorId = async () => {
  const { isConnected } = getStatus();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const doctorId = `CRD-${randomBytes(5).toString('hex').toUpperCase()}`;
    const exists = isConnected
      ? await User.exists({ doctorId })
      : memoryStore.users.some(user => user.doctorId === doctorId);
    if (!exists) return doctorId;
  }
  throw new Error('Could not generate a unique doctor ID. Please try again.');
};

// Gives every existing doctor account an ID (older accounts were created before IDs existed)
// and keeps the DoctorProfile copy in sync. Safe to run on every start-up.
const backfillDoctorIds = async () => {
  const { isConnected } = getStatus();
  let assigned = 0;

  if (isConnected) {
    const doctors = await User.find({
      role: 'doctor',
      $or: [{ doctorId: { $exists: false } }, { doctorId: null }, { doctorId: '' }]
    });
    for (const doctor of doctors) {
      const doctorId = await createDoctorId();
      await User.updateOne({ _id: doctor._id }, { $set: { doctorId } });
      await DoctorProfile.updateOne({ userId: doctor._id }, { $set: { doctorId } });
      assigned += 1;
      console.log(`[Doctor IDs] Assigned ${doctorId} to ${doctor.email}`);
    }
    const profiles = await DoctorProfile.find({ $or: [{ doctorId: { $exists: false } }, { doctorId: null }, { doctorId: '' }] });
    for (const profile of profiles) {
      const owner = await User.findById(profile.userId);
      if (owner?.doctorId) await DoctorProfile.updateOne({ _id: profile._id }, { $set: { doctorId: owner.doctorId } });
    }
  } else {
    for (const doctor of memoryStore.users.filter(user => user.role === 'doctor' && !user.doctorId)) {
      doctor.doctorId = await createDoctorId();
      assigned += 1;
    }
    for (const profile of memoryStore.doctors.filter(item => !item.doctorId)) {
      const owner = memoryStore.users.find(user => String(user._id) === String(profile.userId));
      if (owner?.doctorId) profile.doctorId = owner.doctorId;
    }
  }
  return assigned;
};

module.exports = { createDoctorId, backfillDoctorIds };
