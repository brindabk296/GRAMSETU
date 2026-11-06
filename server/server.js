require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const { connectDB } = require('./db');
const { seedAllData } = require('./data/seedData');
const { backfillDoctorIds } = require('./utils/doctorId');
const { JWT_SECRET } = require('./middleware/auth');
const { findPatient, authorizePatientAccess } = require('./middleware/patientAccess');

const authRoutes = require('./routes/auth');
const locationsRoutes = require('./routes/locations');
const patientsRoutes = require('./routes/patients');
const doctorsRoutes = require('./routes/doctors');
const analyticsRoutes = require('./routes/analytics');
const chatRoutes = require('./routes/chat');
const ocrRoutes = require('./routes/ocr');

const app = express();
const server = http.createServer(app);

// Socket.io for Real-Time Doctor <-> Patient Healthcare Chat
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required.'));
  try {
    socket.data.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    next(new Error('Invalid or expired session.'));
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ocr', ocrRoutes);

// System health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'CareRoute AI v2',
    problemStatementId: 'DL-SJBIT-HK26-SSF010',
    timestamp: new Date(),
    architecture: 'Offline-First React PWA + Node/Express + MongoDB Atlas'
  });
});

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log('>>> [Socket.io] Real-time client connected:', socket.id);

  socket.on('join_conversation', async (conversationId) => {
    const match = typeof conversationId === 'string' && /^conv_([a-f\d]{24})_/i.exec(conversationId);
    const patient = match && await findPatient(match[1]);
    const request = { user: socket.data.user };
    const authorized = patient && await authorizePatientAccess(request, patient);
    const ownerId = request.user.role === 'doctor'
      ? request.doctorProfile?._id
      : patient?.assignedDoctorId || 'doc';
    if (!authorized || conversationId !== `conv_${patient._id}_${ownerId}`) {
      socket.emit('access_denied', { error: 'Access denied to this conversation.' });
      return;
    }
    socket.join(conversationId);
    console.log(`[Socket.io] Client ${socket.id} joined an authorized conversation.`);
  });

  socket.on('leave_conversation', (conversationId) => {
    socket.leave(conversationId);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Serve frontend in production if built
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('CareRoute AI API Server running. Start Vite dev server for frontend.');
    }
  });
});

const PORT = process.env.PORT || 5000;

// Start Server and connect database
async function startServer() {
  await connectDB();
  await seedAllData();
  try {
    const assigned = await backfillDoctorIds();
    if (assigned > 0) console.log(`[Doctor IDs] Assigned IDs to ${assigned} existing doctor account(s).`);
  } catch (err) {
    console.error('[Doctor IDs] Backfill failed:', err.message);
  }

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  CareRoute AI v2 Platform Server Running!`);
    console.log(`  Port: http://localhost:${PORT}`);
    console.log(`  Mode: Full Rural Circuit Longitudinal Care with AI`);
    console.log(`  Database: MongoDB Atlas (Fallback Memory Active if needed)`);
    console.log(`=======================================================`);
  });
}

startServer();
