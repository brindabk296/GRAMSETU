import React, { createContext, useContext, useState, useEffect } from 'react';
import { getPatientSyncStatus, syncPendingPatientRecords } from '../services/patientRecords';

const AuthContext = createContext(null);

const cacheSession = (user, profile) => {
  if (user) localStorage.setItem('careroute_user', JSON.stringify(user));
  else localStorage.removeItem('careroute_user');
  if (profile) localStorage.setItem('careroute_profile', JSON.stringify(profile));
  else localStorage.removeItem('careroute_profile');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('careroute_token') || null);
  const [loading, setLoading] = useState(true);

  // Fetch current user on load if token exists
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setProfile(data.profile);
          cacheSession(data.user, data.profile);
        } else {
          // Token invalid
          localStorage.removeItem('careroute_token');
          localStorage.removeItem('careroute_user');
          localStorage.removeItem('careroute_profile');
          setToken(null);
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        try {
          setUser(JSON.parse(localStorage.getItem('careroute_user') || 'null'));
          setProfile(JSON.parse(localStorage.getItem('careroute_profile') || 'null'));
        } catch (cacheError) {
          console.error('Error restoring cached session:', cacheError);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const synchronizeRecords = async (force = false) => {
      if (!navigator.onLine) return;
      try {
        const status = await getPatientSyncStatus();
        if (status.pendingCount > 0 &&
          (force || !status.isSyncing)) {
          await syncPendingPatientRecords(token);
        }
      } catch (err) {
        console.error('Patient record synchronization failed:', err);
      }
    };
    const synchronizeWhenVisible = () => {
      if (document.visibilityState === 'visible') synchronizeRecords(true);
    };
    const retryInterval = window.setInterval(synchronizeRecords, 15000);

    const synchronizeOnReconnect = () => synchronizeRecords(true);
    window.addEventListener('online', synchronizeOnReconnect);
    window.addEventListener('focus', synchronizeOnReconnect);
    document.addEventListener('visibilitychange', synchronizeWhenVisible);
    if (navigator.onLine) synchronizeRecords(true);
    return () => {
      window.clearInterval(retryInterval);
      window.removeEventListener('online', synchronizeOnReconnect);
      window.removeEventListener('focus', synchronizeOnReconnect);
      document.removeEventListener('visibilitychange', synchronizeWhenVisible);
    };
  }, [token]);

  const login = async (identifier, password, expectedRole = null) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, expectedRole })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to authenticate.');
    }

    localStorage.setItem('careroute_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setProfile(data.profile);
    cacheSession(data.user, data.profile);
    return data;
  };

  const registerDoctor = async (formData) => {
    // If formData is FormData instance (with file) or raw JSON
    const isFormDataObj = formData instanceof FormData;
    const res = await fetch('/api/auth/register/doctor', {
      method: 'POST',
      headers: isFormDataObj ? {} : { 'Content-Type': 'application/json' },
      body: isFormDataObj ? formData : JSON.stringify(formData)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Doctor registration failed.');
    }

    localStorage.setItem('careroute_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setProfile(data.doctorProfile);
    cacheSession(data.user, data.doctorProfile);
    return data;
  };

  const registerPatientAccount = async (formData) => {
    const res = await fetch('/api/auth/register/patient-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Patient registration failed.');
    }

    localStorage.setItem('careroute_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setProfile(data.profile);
    cacheSession(data.user, data.profile);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('careroute_token');
    localStorage.removeItem('careroute_user');
    localStorage.removeItem('careroute_profile');
    setToken(null);
    setUser(null);
    setProfile(null);
  };

  const toggleDoctorVerification = async (newStatus) => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/doctor/verify-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.doctorProfile);
        cacheSession(user, data.doctorProfile);
      }
    } catch (err) {
      console.error('Failed to toggle verification:', err);
    }
  };

  const isVerifiedDoctor = user?.role === 'doctor' && (profile?.isVerified === true || profile?.verificationStatus === 'verified');

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        loading,
        login,
        registerDoctor,
        registerPatientAccount,
        logout,
        toggleDoctorVerification,
        isVerifiedDoctor,
        refreshProfile: async () => {
          if (!token) return;
          const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setProfile(data.profile);
            cacheSession(data.user, data.profile);
          }
        }
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
