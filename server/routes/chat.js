const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const { authenticate } = require('../middleware/auth');
const { getStatus, memoryStore } = require('../db');
const { findPatient, authorizePatientAccess } = require('../middleware/patientAccess');

const getConversationPatient = async (conversationId) => {
  const match = /^conv_([a-f\d]{24})_/i.exec(conversationId);
  return match ? findPatient(match[1]) : null;
};

const authorizeConversation = async (req, conversationId, patient) => {
  if (!patient || !await authorizePatientAccess(req, patient)) return false;
  const ownerId = req.user.role === 'doctor'
    ? req.doctorProfile._id
    : patient.assignedDoctorId || 'doc';
  return conversationId === `conv_${patient._id}_${ownerId}`;
};

/**
 * Intelligent Rule + Natural Clinical AI Triager for Patient Symptoms
 */
function analyzeSymptomsWithAI(text, patientVitals) {
  const lower = (text || '').toLowerCase();
  const symptomsDetected = [];
  let urgency = 'Normal';
  let guidance = '';

  // Red-flag emergency indicators
  if (
    lower.includes('chest pain') ||
    lower.includes('heart pain') ||
    lower.includes('difficulty breathing') ||
    lower.includes('shortness of breath') ||
    lower.includes('severe dizziness') ||
    lower.includes('fainted') ||
    lower.includes('unconscious') ||
    lower.includes('paralysis') ||
    lower.includes('stroke') ||
    lower.includes('vision loss')
  ) {
    urgency = 'Emergency';
    symptomsDetected.push('Acute Red-Flag Symptoms');
    guidance = 'CRITICAL ALERT: Your described symptoms suggest immediate emergency attention is required. Please head to the nearest Community Health Centre (CHC) or call 108 emergency ambulance service immediately while your doctor is notified.';
  } else if (
    lower.includes('headache') ||
    lower.includes('swelling') ||
    lower.includes('blurred') ||
    lower.includes('nausea') ||
    lower.includes('vomit') ||
    lower.includes('high fever') ||
    lower.includes('shivering') ||
    lower.includes('sugar') ||
    lower.includes('blood pressure')
  ) {
    urgency = 'Urgent';
    if (lower.includes('headache')) symptomsDetected.push('Persistent Headache');
    if (lower.includes('swelling')) symptomsDetected.push('Pedal / Facial Edema');
    if (lower.includes('blurred')) symptomsDetected.push('Visual Disturbances');
    if (lower.includes('fever')) symptomsDetected.push('Elevated Temperature');

    guidance = 'CLINICAL ADVISORY: Symptoms noted. For hypertension/diabetes patients, please check your BP and blood sugar immediately. Sit comfortably in a cool, quiet room. Take your prescribed morning medication if not yet taken today. Your doctor has received this priority notification.';
  } else if (
    lower.includes('tired') ||
    lower.includes('fatigue') ||
    lower.includes('medicine') ||
    lower.includes('dose') ||
    lower.includes('diet') ||
    lower.includes('pain')
  ) {
    urgency = 'Advisory';
    if (lower.includes('fatigue') || lower.includes('tired')) symptomsDetected.push('Fatigue');
    if (lower.includes('pain')) symptomsDetected.push('General Body Ache');

    guidance = 'CareRoute AI Health Assistant: We have recorded your symptoms for your assigned traveling doctor. Stay well hydrated, avoid high salt/processed foods, and keep resting. Your doctor will review this and respond with personalized guidance.';
  } else {
    urgency = 'Normal';
    guidance = 'CareRoute AI: Message forwarded to your doctor. You can track your vitals check-in under the "Vitals" tab while waiting for Dr. Ravi.';
  }

  return { urgency, symptomsDetected, guidance };
}

// 1. GET chat history for a conversation
router.get('/history/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { isConnected } = getStatus();
    const patient = await getConversationPatient(conversationId);
    if (!await authorizeConversation(req, conversationId, patient)) {
      return res.status(403).json({ error: 'Access denied. This conversation is not assigned to your account.' });
    }

    let messages = [];
    if (isConnected) {
      messages = await ChatMessage.find({ conversationId }).sort({ createdAt: 1 });
    } else {
      messages = memoryStore.chatMessages.filter(m => m.conversationId === conversationId);
      messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    res.json(messages);
  } catch (err) {
    console.error('Chat history error:', err);
    res.status(500).json({ error: 'Failed to retrieve conversation history.' });
  }
});

// 2. POST send chat message (with instant AI Health Guard evaluation)
router.post('/send', authenticate, async (req, res) => {
  try {
    const { conversationId, message, recipientId, recipientRole } = req.body;
    const { isConnected } = getStatus();

    if (!conversationId || !message || !message.trim()) {
      return res.status(400).json({ error: 'Conversation ID and message content are required.' });
    }

    const patient = await getConversationPatient(conversationId);
    if (!await authorizeConversation(req, conversationId, patient)) {
      return res.status(403).json({ error: 'Access denied. This conversation is not assigned to your account.' });
    }

    // User message
    const userMsg = {
      _id: new mongoose.Types.ObjectId(),
      senderId: new mongoose.Types.ObjectId(req.user.id),
      senderRole: req.user.role,
      senderName: req.user.name,
      recipientId: recipientId ? new mongoose.Types.ObjectId(recipientId) : null,
      recipientRole: recipientRole || (req.user.role === 'patient' ? 'doctor' : 'patient'),
      conversationId,
      message: message.trim(),
      healthContext: { symptoms: [], urgencyLevel: 'Normal' },
      isAiGenerated: false,
      createdAt: new Date()
    };

    const messagesToSave = [userMsg];

    // If patient is describing symptoms, generate automatic AI Health Guard triage response
    if (req.user.role === 'patient') {
      const aiAnalysis = analyzeSymptomsWithAI(message);
      userMsg.healthContext.symptoms = aiAnalysis.symptomsDetected;
      userMsg.healthContext.urgencyLevel = aiAnalysis.urgency;

      const aiReply = {
        _id: new mongoose.Types.ObjectId(),
        senderId: new mongoose.Types.ObjectId(req.user.id),
        senderRole: 'ai_assistant',
        senderName: 'CareRoute AI Clinical Guard',
        recipientId: userMsg.senderId,
        recipientRole: 'patient',
        conversationId,
        message: `${aiAnalysis.guidance}`,
        healthContext: {
          symptoms: aiAnalysis.symptomsDetected,
          urgencyLevel: aiAnalysis.urgency
        },
        isAiGenerated: true,
        createdAt: new Date(Date.now() + 600)
      };

      messagesToSave.push(aiReply);
    }

    if (isConnected) {
      await ChatMessage.insertMany(messagesToSave);
    } else {
      memoryStore.chatMessages.push(...messagesToSave);
    }

    // Emit via socket if available
    const io = req.app.get('io');
    if (io) {
      messagesToSave.forEach(msg => {
        io.to(conversationId).emit('new_message', msg);
      });
    }

    res.status(201).json({
      message: 'Message sent successfully.',
      sentMessages: messagesToSave
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// 3. GET list of active conversations for current user
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const { isConnected } = getStatus();
    let conversations = [];

    // Doctor sees all patient conversations in their circuits
    if (req.user.role === 'doctor') {
      let patients = [];
      const docProfile = isConnected
        ? await DoctorProfile.findOne({ userId: req.user.id })
        : memoryStore.doctors.find(doctor => String(doctor.userId) === String(req.user.id));
      if (!docProfile || !docProfile.isVerified || docProfile.verificationStatus !== 'verified') {
        return res.status(403).json({ error: 'Only verified doctors can view patient conversations.' });
      }
      if (isConnected) {
        patients = await PatientProfile.find({ assignedDoctorId: docProfile._id }).limit(20);
      } else {
        patients = memoryStore.patients.filter(patient =>
          String(patient.assignedDoctorId || '') === String(docProfile._id)
        );
      }

      conversations = patients.map(p => ({
        conversationId: `conv_${p._id}_${docProfile._id}`,
        patientId: p._id,
        patientName: p.name,
        village: p.village,
        riskTier: p.riskTier,
        lastMessage: 'Tap to view clinical communication stream',
        updatedAt: p.latestVitals?.recordedAt || p.createdAt
      }));
    } else {
      const patient = isConnected
        ? await PatientProfile.findOne({ userId: req.user.id })
        : memoryStore.patients.find(item => String(item.userId) === String(req.user.id));
      if (!patient) return res.status(404).json({ error: 'Patient record not found.' });
      conversations = [{
        conversationId: `conv_${patient._id}_${patient.assignedDoctorId || 'doc'}`,
        patientId: patient._id,
        doctorName: 'Assigned field doctor',
        status: 'Assigned care team',
        lastMessage: 'Tap to message your assigned doctor or consult CareRoute AI Assistant'
      }];
    }

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load conversations.' });
  }
});

module.exports = router;
