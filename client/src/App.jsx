import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import RegisterDoctor from './pages/RegisterDoctor';
import RegisterPatient from './pages/RegisterPatient';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorPatients from './pages/DoctorPatients';
import PatientDetail from './pages/PatientDetail';
import DoctorChat from './pages/DoctorChat';
import DoctorVerification from './pages/DoctorVerification';
import PatientDashboard from './pages/PatientDashboard';
import PatientChat from './pages/PatientChat';
import PatientVitalsCheckIn from './pages/PatientVitalsCheckIn';
import DoctorDirectory from './pages/DoctorDirectory';

// Protected Route Guard for Doctor
const DoctorRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Verifying session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'doctor') return <Navigate to="/patient/dashboard" replace />;
  return children;
};

// Protected Route Guard for Patient
const PatientRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Verifying session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'patient') return <Navigate to="/doctor/dashboard" replace />;
  return children;
};

function AppRoutes() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register/doctor" element={<RegisterDoctor />} />
          <Route path="/register/patient" element={<RegisterPatient />} />
          <Route path="/doctors" element={<DoctorDirectory />} />

          {/* Doctor Protected Routes */}
          <Route
            path="/doctor/dashboard"
            element={
              <DoctorRoute>
                <DoctorDashboard />
              </DoctorRoute>
            }
          />
          <Route
            path="/doctor/patients"
            element={
              <DoctorRoute>
                <DoctorPatients />
              </DoctorRoute>
            }
          />
          <Route
            path="/doctor/patient/:id"
            element={
              <DoctorRoute>
                <PatientDetail />
              </DoctorRoute>
            }
          />
          <Route
            path="/doctor/chat"
            element={
              <DoctorRoute>
                <DoctorChat />
              </DoctorRoute>
            }
          />
          <Route
            path="/doctor/verification"
            element={
              <DoctorRoute>
                <DoctorVerification />
              </DoctorRoute>
            }
          />

          {/* Patient Protected Routes */}
          <Route
            path="/patient/dashboard"
            element={
              <PatientRoute>
                <PatientDashboard />
              </PatientRoute>
            }
          />
          <Route
            path="/patient/vitals"
            element={
              <PatientRoute>
                <PatientVitalsCheckIn />
              </PatientRoute>
            }
          />
          <Route
            path="/patient/chat"
            element={
              <PatientRoute>
                <PatientChat />
              </PatientRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
