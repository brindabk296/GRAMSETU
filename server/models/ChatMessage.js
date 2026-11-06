const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    enum: ['patient', 'doctor', 'ai_assistant'],
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  recipientRole: {
    type: String,
    enum: ['patient', 'doctor', 'all']
  },
  conversationId: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  healthContext: {
    symptoms: [String],
    vitalsMentioned: [String],
    urgencyLevel: {
      type: String,
      enum: ['Normal', 'Advisory', 'Urgent', 'Emergency'],
      default: 'Normal'
    }
  },
  isAiGenerated: {
    type: Boolean,
    default: false
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
module.exports = ChatMessage;
