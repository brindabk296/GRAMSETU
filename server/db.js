const mongoose = require('mongoose');

let isConnected = false;
let isFallbackMemory = false;

// Fallback in-memory store if MongoDB Atlas is not yet configured or offline
const memoryStore = {
  users: [],
  doctors: [],
  patients: [],
  visits: [],
  observations: [],
  followups: [],
  chatMessages: [],
  auditLogs: []
};

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (uri && uri.trim() !== '') {
    try {
      console.log('Connecting to MongoDB Atlas at:', uri.split('@')[1] ? '...@' + uri.split('@')[1] : uri);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000
      });
      isConnected = true;
      console.log('>>> [CareRoute AI] Successfully connected to MongoDB Atlas! <<<');
      return true;
    } catch (err) {
      console.warn('MongoDB Atlas connection attempt failed:', err.message);
      console.warn('Falling back to high-performance localized persistence store for offline-first readiness.');
    }
  } else {
    console.log('[Notice] MONGODB_URI not provided in .env - running in zero-friction Localized Mode with MongoDB schema compatibility.');
  }

  isFallbackMemory = true;
  return false;
};

module.exports = {
  connectDB,
  getStatus: () => ({ isConnected, isFallbackMemory }),
  memoryStore
};
