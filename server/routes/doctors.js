const express = require('express');
const router = express.Router();
const DoctorProfile = require('../models/DoctorProfile');
const PatientProfile = require('../models/PatientProfile');
const FollowUp = require('../models/FollowUp');
const { authenticate } = require('../middleware/auth');
const { getStatus, memoryStore } = require('../db');

// 1. GET Public Verified Doctor Directory (Anti-scam registry for patients to check credentials)
router.get('/directory', async (req, res) => {
  try {
    const { isConnected } = getStatus();
    let doctors = [];

    if (isConnected) {
      doctors = await DoctorProfile.find().select('-__v');
    } else {
      doctors = memoryStore.doctors;
    }

    // Filter or highlight verified status
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve doctor directory.' });
  }
});

// 2. GET Doctor Dashboard summary for a selected village
router.get('/dashboard-summary', authenticate, async (req, res) => {
  try {
    const { isConnected } = getStatus();
    const { village = 'Angara', district = 'ranchi' } = req.query;

    let docProfile = null;
    let patients = [];
    let followups = [];

    if (isConnected) {
      docProfile = await DoctorProfile.findOne({ userId: req.user.id });
      patients = await PatientProfile.find({ village });
      followups = await FollowUp.find({ village });
    } else {
      docProfile = memoryStore.doctors.find(d => String(d.userId) === String(req.user.id));
      patients = memoryStore.patients.filter(p => p.village.toLowerCase() === village.toLowerCase());
      followups = memoryStore.followups.filter(f => f.village.toLowerCase() === village.toLowerCase());
    }

    const priorityQueue = {
      critical: patients.filter(p => p.riskTier === 'Critical'),
      high: patients.filter(p => p.riskTier === 'High'),
      moderate: patients.filter(p => p.riskTier === 'Moderate'),
      routine: patients.filter(p => p.riskTier === 'Routine')
    };

    const overdueFollowups = followups.filter(f => f.status === 'overdue' || new Date(f.dueDate) < new Date());

    res.json({
      doctor: docProfile,
      currentVillage: village,
      currentDistrict: district,
      totalPatientsInVillage: patients.length,
      priorityQueue,
      overdueFollowups,
      isVerified: docProfile ? docProfile.isVerified : false,
      verificationStatus: docProfile ? docProfile.verificationStatus : 'unverified'
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to load doctor dashboard summary.' });
  }
});

module.exports = router;
