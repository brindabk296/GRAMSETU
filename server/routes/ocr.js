const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { requireVerifiedDoctor } = require('../middleware/doctorVerified');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `lab_report_${Date.now()}_${file.originalname}`);
  }
});
const upload = multer({ storage });

// POST upload and run OCR extraction on paper report / lab slip
router.post('/extract', authenticate, requireVerifiedDoctor, upload.single('reportImage'), (req, res) => {
  try {
    const filename = req.file ? req.file.filename : 'simulated_lab_slip.jpg';

    // Simulated OCR extraction engine with confidence scores and validation ranges
    // Matches blueprint 10.6 "Confirm-before-save screen"
    const extractedData = {
      sourceFile: filename,
      extractionTimestamp: new Date(),
      detectedDocumentType: 'Blood Pressure & Metabolic Panel (Rural PHC Lab Slip)',
      extractedFields: [
        {
          name: 'Systolic Blood Pressure',
          type: 'bp_systolic',
          extractedValue: 152,
          unit: 'mmHg',
          confidence: 0.94,
          isPlausible: true,
          normalRange: '90 - 120 mmHg',
          flag: 'High'
        },
        {
          name: 'Diastolic Blood Pressure',
          type: 'bp_diastolic',
          extractedValue: 94,
          unit: 'mmHg',
          confidence: 0.92,
          isPlausible: true,
          normalRange: '60 - 80 mmHg',
          flag: 'High'
        },
        {
          name: 'Fasting Blood Glucose',
          type: 'blood_glucose',
          extractedValue: 164,
          unit: 'mg/dL',
          confidence: 0.89,
          isPlausible: true,
          normalRange: '70 - 99 mg/dL',
          flag: 'High'
        },
        {
          name: 'Pulse / Heart Rate',
          type: 'heart_rate',
          extractedValue: 76,
          unit: 'bpm',
          confidence: 0.96,
          isPlausible: true,
          normalRange: '60 - 100 bpm',
          flag: 'Normal'
        }
      ],
      ocrRawText: `RURAL HEALTH SUB-CENTRE CLINICAL SLIP
Date: 04/11/2026
Vitals Recorded:
BP: 152/94 mmHg (Right Arm, Sitting)
FBS: 164 mg/dL (Glucometer Strip #B42)
Pulse: 76 bpm regular
Medication reported: Amlodipine 5mg OD, Metformin 500mg BD`,
      requiresDoctorConfirmation: true
    };

    res.json(extractedData);
  } catch (err) {
    console.error('OCR Extraction error:', err);
    res.status(500).json({ error: 'Failed to process document OCR.' });
  }
});

module.exports = router;
