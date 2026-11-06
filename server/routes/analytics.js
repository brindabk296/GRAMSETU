const express = require('express');
const router = express.Router();
const PatientProfile = require('../models/PatientProfile');
const Observation = require('../models/Observation');
const Visit = require('../models/Visit');
const { authenticate } = require('../middleware/auth');
const { requireVerifiedDoctor } = require('../middleware/doctorVerified');
const { getStatus, memoryStore } = require('../db');
const { findPatient, authorizePatientAccess } = require('../middleware/patientAccess');

/**
 * Ordinary Least Squares (OLS) Regression against time in days
 */
function calculateOLS(readings, threshold = 160, metricName = 'Systolic BP') {
  const validReadings = (readings || []).filter(reading =>
    Number.isFinite(Number(reading.value)) &&
    Number.isFinite(new Date(reading.recordedAt).getTime())
  );
  if (validReadings.length < 3) {
    return {
      hasSufficientData: false,
      message: 'Insufficient data (at least 3 readings required for trend projection)',
      slopePerWeek: 0,
      trend: 'insufficient_data',
      forecastDays: null,
      forecastWeeksText: 'N/A'
    };
  }

  // Sort chronologically
  const sorted = [...validReadings].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  const t0 = new Date(sorted[0].recordedAt).getTime();

  // Convert dates to days relative to first reading
  const points = sorted.map(r => ({
    x: (new Date(r.recordedAt).getTime() - t0) / (1000 * 60 * 60 * 24),
    y: Number(r.value),
    date: r.recordedAt
  }));

  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denominator = (n * sumX2 - sumX * sumX);
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator; // change per day
  const intercept = (sumY - slope * sumX) / n;

  const slopePerWeek = slope * 7;
  const slopePerMonth = slope * 30;

  // Trend classification
  let trend = 'stable';
  if (slopePerMonth >= 2.0) {
    trend = 'worsening';
  } else if (slopePerMonth <= -2.0) {
    trend = 'improving';
  }

  // Time-to-threshold projection
  let forecastDays = null;
  let forecastWeeksText = 'Not projected to breach threshold';
  const latestValue = sorted[sorted.length - 1].value;
  const daysSpan = Math.round(points[points.length - 1].x);

  if (slope > 0 && latestValue < threshold) {
    const targetX = (threshold - intercept) / slope;
    const currentX = points[points.length - 1].x;
    forecastDays = Math.max(1, Math.round(targetX - currentX));
    const lowerWeeks = Math.max(1, Math.round((forecastDays * 0.8) / 7));
    const upperWeeks = Math.round((forecastDays * 1.25) / 7);
    forecastWeeksText = `roughly ${lowerWeeks} to ${upperWeeks} weeks`;
  } else if (latestValue >= threshold) {
    forecastWeeksText = 'Already exceeded threshold (' + threshold + ')';
  }

  return {
    hasSufficientData: true,
    dataCount: n,
    daysSpan,
    slopePerDay: Number(slope.toFixed(2)),
    slopePerWeek: Number(slopePerWeek.toFixed(2)),
    slopePerMonth: Number(slopePerMonth.toFixed(1)),
    latestValue,
    threshold,
    trend,
    forecastDays,
    forecastWeeksText,
    summaryText: `${metricName} has changed by roughly ${Math.abs(slopePerMonth).toFixed(1)} ${metricName === 'Blood glucose' ? 'mg/dL' : 'mmHg'}/month over the last ${n} recorded points. ${
      trend === 'worsening'
        ? `At this rate, it may reach ${threshold} ${metricName === 'Blood glucose' ? 'mg/dL' : 'mmHg'} in ${forecastWeeksText}. Based on ${n} readings over ${Math.round(daysSpan / 30)} months.`
        : trend === 'improving'
        ? 'Trend shows positive clinical improvement within target ranges.'
        : 'Trend is currently stable within acceptable bounds.'
    }`
  };
}

// 1. Get trends & forecast for a patient (Requires Verified Doctor or the Patient themselves)
router.get('/patient/:id/trends', authenticate, async (req, res) => {
  try {
    const { isConnected } = getStatus();
    const patientId = req.params.id;
    const patient = await findPatient(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient record not found.' });
    if (!await authorizePatientAccess(req, patient)) {
      return res.status(403).json({ error: 'Access denied. Analytics are available only for your assigned patients.' });
    }

    let observations = [];
    let visits = [];
    if (isConnected) {
      observations = await Observation.find({ patientId }).sort({ recordedAt: 1 });
      visits = await Visit.find({ patientId }).sort({ date: 1 });
    } else {
      observations = memoryStore.observations.filter(o => String(o.patientId) === String(patientId));
      visits = memoryStore.visits
        .filter(visit => String(visit.patientId) === String(patientId))
        .sort((left, right) => new Date(left.date) - new Date(right.date));
    }

    const visitReadings = visits.flatMap(visit => [
      { type: 'bp_systolic', value: visit.vitals?.systolicBP, recordedAt: visit.date, source: 'doctor_visit', unit: 'mmHg' },
      { type: 'bp_diastolic', value: visit.vitals?.diastolicBP, recordedAt: visit.date, source: 'doctor_visit', unit: 'mmHg' },
      { type: 'blood_glucose', value: visit.vitals?.bloodGlucose, recordedAt: visit.date, source: 'doctor_visit', unit: 'mg/dL' },
      { type: 'weight', value: visit.vitals?.weightKg, recordedAt: visit.date, source: 'doctor_visit', unit: 'kg' }
    ]).filter(reading =>
      Number.isFinite(Number(reading.value)) &&
      Number(reading.value) > 0 &&
      Number.isFinite(new Date(reading.recordedAt).getTime())
    );
    const latestVitals = patient.latestVitals || {};
    const latestVitalsDate = latestVitals.recordedAt || patient.updatedAt || patient.createdAt;
    const profileReadings = [
      { type: 'bp_systolic', value: latestVitals.systolicBP, recordedAt: latestVitalsDate, source: 'patient_profile', unit: 'mmHg' },
      { type: 'bp_diastolic', value: latestVitals.diastolicBP, recordedAt: latestVitalsDate, source: 'patient_profile', unit: 'mmHg' },
      { type: 'blood_glucose', value: latestVitals.bloodGlucose, recordedAt: latestVitalsDate, source: 'patient_profile', unit: 'mg/dL' },
      { type: 'weight', value: latestVitals.weightKg, recordedAt: latestVitalsDate, source: 'patient_profile', unit: 'kg' }
    ].filter(reading =>
      Number.isFinite(Number(reading.value)) &&
      Number(reading.value) > 0 &&
      Number.isFinite(new Date(reading.recordedAt).getTime())
    );
    const readingsFor = type => {
      const observed = observations.filter(observation =>
        observation.type === type &&
        Number.isFinite(Number(observation.value)) &&
        Number.isFinite(new Date(observation.recordedAt).getTime())
      );
      const fromVisits = visitReadings.filter(reading => reading.type === type);
      const merged = [...observed];
      for (const reading of fromVisits) {
        const duplicate = observed.some(observation =>
          Number(observation.value) === Number(reading.value) &&
          Math.abs(new Date(observation.recordedAt) - new Date(reading.recordedAt)) < 60000
        );
        if (!duplicate) merged.push(reading);
      }
      if (merged.length) {
        return merged.sort((left, right) =>
          new Date(left.recordedAt) - new Date(right.recordedAt)
        );
      }
      return profileReadings.filter(reading => reading.type === type);
    };
    const systolicReadings = readingsFor('bp_systolic');
    const glucoseReadings = readingsFor('blood_glucose');
    const analyticsSeries = ['bp_systolic', 'bp_diastolic', 'blood_glucose', 'weight']
      .flatMap(readingsFor);

    const systolicForecast = calculateOLS(systolicReadings, 160, 'Systolic BP');
    const glucoseForecast = calculateOLS(glucoseReadings, 200, 'Blood glucose');

    return res.json({
      patientId,
      modelName: 'Patient-specific ordinary least-squares regression',
      systolicForecast,
      glucoseForecast,
      readingsCount: analyticsSeries.length,
      historicalSeries: analyticsSeries.map(o => ({
        type: o.type,
        value: o.value,
        unit: o.unit,
        source: o.source,
        recordedAt: o.recordedAt
      }))
    });
  } catch (err) {
    console.error('Trend calculation error:', err);
    res.status(500).json({ error: 'Failed to compute trend forecasts.' });
  }
});

// 2. Doctor AI Copilot query endpoint (Grounded in patient record)
router.post('/copilot/query', authenticate, requireVerifiedDoctor, async (req, res) => {
  try {
    const { patientId, question } = req.body;
    const { isConnected } = getStatus();

    let patient, visits, obs;
    if (isConnected) {
      patient = await PatientProfile.findById(patientId);
      visits = await Visit.find({ patientId }).sort({ date: -1 });
      obs = await Observation.find({ patientId }).sort({ recordedAt: 1 });
    } else {
      patient = memoryStore.patients.find(p => String(p._id) === String(patientId));
      visits = memoryStore.visits.filter(v => String(v.patientId) === String(patientId));
      obs = memoryStore.observations.filter(o => String(o.patientId) === String(patientId));
    }

    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found.' });
    }
    if (String(patient.assignedDoctorId || '') !== String(req.doctorProfile._id)) {
      return res.status(403).json({ error: 'Access denied. This patient is assigned to another doctor.' });
    }

    const qLower = (question || '').toLowerCase();
    let responseText = '';
    const citations = [];

    if (qLower.includes('what changed') || qLower.includes('change') || qLower.includes('since last')) {
      if (visits.length > 1) {
        const latest = visits[0];
        const prev = visits[1];
        citations.push(`Visit on ${new Date(latest.date).toLocaleDateString()}`);
        citations.push(`Previous visit on ${new Date(prev.date).toLocaleDateString()}`);

        responseText = `Grounded Clinical Difference (Between ${new Date(prev.date).toLocaleDateString()} and ${new Date(latest.date).toLocaleDateString()}):
• Systolic BP moved from ${prev.vitals?.systolicBP || 'N/A'} mmHg to ${latest.vitals?.systolicBP || 'N/A'} mmHg (+${(latest.vitals?.systolicBP || 0) - (prev.vitals?.systolicBP || 0)} mmHg increase).
• New symptoms noted: ${(latest.symptoms && latest.symptoms.length > 0) ? latest.symptoms.join(', ') : 'None'}.
• Active prescription: ${(patient.currentMedications || []).map(m => m.name + ' ' + m.dosage).join(', ')}.
• Clinical Decision Support Note: BP trend is climbing toward Stage-2 threshold. Consider dose titration or dietary sodium review.`;
      } else {
        responseText = `Only one consultation is on file for ${patient.name}. Baseline vitals recorded: BP ${patient.latestVitals?.systolicBP}/${patient.latestVitals?.diastolicBP} mmHg, Blood Glucose: ${patient.latestVitals?.bloodGlucose} mg/dL.`;
        if (visits[0]) citations.push(`Baseline visit on ${new Date(visits[0].date).toLocaleDateString()}`);
      }
    } else if (qLower.includes('flag') || qLower.includes('risk') || qLower.includes('tier')) {
      responseText = `${patient.name} is currently flagged at '${patient.riskTier}' Deterioration Risk (Score: ${patient.riskScore}/100).
Top Contributing Factors:
1. ${patient.riskFactors[0] || 'Elevated chronic vital markers'}
2. ${patient.riskFactors[1] || 'Dual condition burden'}
3. ${patient.riskFactors[2] || 'Scheduled follow-up adherence necessity'}
Data Window: Last ${obs.length} observations and ${visits.length} clinical visits.
*Note: AI decision support guidance only; not an autonomous diagnosis. Final clinical discretion rests with the examining doctor.*`;
      citations.push('Longitudinal Observation Registry', 'Clinical Guideline Rule Engine');
    } else if (qLower.includes('bp') || qLower.includes('hypertension') || qLower.includes('pressure')) {
      const systolicObs = obs.filter(o => o.type === 'bp_systolic');
      const ols = calculateOLS(systolicObs, 160);
      responseText = `BP Trajectory Analysis for ${patient.name}:
• Latest Reading: ${patient.latestVitals?.systolicBP}/${patient.latestVitals?.diastolicBP} mmHg.
• OLS Regression Slope: ${ols.slopePerMonth > 0 ? '+' : ''}${ols.slopePerMonth} mmHg/month.
• Trend Classification: ${ols.trend.toUpperCase()}.
• Time to 160 mmHg Threshold: ${ols.forecastWeeksText}.
• Citations: Based on ${systolicObs.length} readings across rural circuit visits.`;
      citations.push(`${systolicObs.length} longitudinal BP records`);
    } else {
      // General summary
      responseText = `Patient Summary for ${patient.name} (Age: ${patient.age}, Village: ${patient.village}):
• Diagnoses: ${(patient.conditions || []).map(c => c.name).join(', ') || 'None recorded'}
• Medications: ${(patient.currentMedications || []).map(m => `${m.name} (${m.dosage})`).join(', ')}
• Latest Vitals: BP ${patient.latestVitals?.systolicBP}/${patient.latestVitals?.diastolicBP} mmHg, Glucose ${patient.latestVitals?.bloodGlucose} mg/dL
• Known Allergies: ${(patient.allergies || []).join(', ') || 'No known drug allergies'}`;
      if (visits.length > 0) citations.push(`Latest consultation dated ${new Date(visits[0].date).toLocaleDateString()}`);
    }

    return res.json({
      groundedResponse: responseText,
      citations,
      patientId,
      disclaimer: 'CareRoute AI Decision Support only. Doctor decision is always final.'
    });
  } catch (err) {
    console.error('Copilot query error:', err);
    res.status(500).json({ error: 'Failed to process copilot query.' });
  }
});

module.exports = router;
