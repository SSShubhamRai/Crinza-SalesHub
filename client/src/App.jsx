
import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications'; // 👈 Push notifications plugin import kiya gaya
import axios from 'axios'; // Backend par token bhejne ke liye

import Login from './components/Login';
import SalespersonForm from './components/SalespersonForm';
import TelecallerForm from './components/TelecallerForm'; 
import TechnicalDashboard from './components/TechnicalDashboard';
import AccountantPanel from './components/accountant/AccountantPanel';
import AdminDashboard from './components/admin/AdminDashboard';
import HrPortal from './components/HrPortal';

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // API Base URL config
  const API_BASE = import.meta.env.PROD
    ? 'https://crinza-saleshub.onrender.com'
    : 'http://localhost:5000';

  // 🌟 Global Dark / Light Theme State Management
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;

    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  // Restore logged-in session
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedRole = localStorage.getItem('role');
    const savedUserId = localStorage.getItem('userId');

    if (savedToken && savedRole) {
      setToken(savedToken);
      setRole(savedRole);
      setUserId(savedUserId || 'User');
    }
  }, []);

  // 🌟 Capacitor Push Notifications Setup (Jab user logged in ho)
  useEffect(() => {
    if (!token) return;

    // Push notification permissions request karein aur listeners setup karein
    const setupPushNotifications = async () => {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notification permission not granted!');
        return;
      }

      // FCM registration
      await PushNotifications.register();

      // Jab token successfully mil jaye
      PushNotifications.addListener('registration', async (fcmToken) => {
        console.log('FCM Token received: ', fcmToken.value);
        try {
          // Token ko apne backend par save karwayein taaki notifications target ki ja sakein
          await axios.put(
            `${API_BASE}/api/auth/update-fcm-token`, // Ensure your backend has this route, or save it accordingly
            { fcmToken: fcmToken.value },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err) {
          console.error('Failed to sync FCM token to backend:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on push registration: ', JSON.stringify(error));
      });

      // App jab foreground mein ho tab notification receive ho
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received in foreground: ', JSON.stringify(notification));
      });

      // Jab user notification par click kare
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed: ', JSON.stringify(notification));
        // Aap yahan data ke mutabiq navigation handle kar sakte hain
      });
    };

    setupPushNotifications();

    // Cleanup listeners on unmount / logout
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [token, API_BASE]);

  // 🌟 Capacitor Hardware Back Button Handler
  useEffect(() => {
    const handleBackButton = CapacitorApp.addListener(
      'backButton',
      ({ canGoBack }) => {
        if (!token || location.pathname === '/') {
          CapacitorApp.exitApp();
        } else if (canGoBack) {
          navigate(-1);
        } else {
          CapacitorApp.exitApp();
        }
      }
    );

    return () => {
      handleBackButton.then((listener) => listener.remove());
    };
  }, [token, location, navigate]);

  const handleLoginSuccess = (newToken, newRole, newUserId) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('role', newRole);
    localStorage.setItem('userId', newUserId);

    setToken(newToken);
    setRole(newRole);
    setUserId(newUserId);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');

    setToken(null);
    setRole(null);
    setUserId(null);
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] font-[var(--font-body)] text-[var(--color-body)] transition-colors duration-300 relative">

      {/* Toast Notifications */}
      <Toaster position="top-right" reverseOrder={false} />

      {/* 🌟 Global Floating Theme Toggle Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3.5 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-heading)] shadow-xl cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center text-base"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

     {!token ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : role === 'boss' || role === 'admin' ? (
        <AdminDashboard
          userId={userId}
          onLogout={handleLogout}
        />
      ) : role === 'hr' ? (
        <HrPortal
          userId={userId}
          username={userId}
          onLogout={handleLogout}
        />
      ) : role === 'accountant' ? (
        <AccountantPanel
          userId={userId}
          onLogout={handleLogout}
        />
      ) : role === 'technical' ? (
        <TechnicalDashboard
          userId={userId}
          onLogout={handleLogout}
          API_BASE={API_BASE}
        />
      ) : role === 'telecaller' ? (
        <TelecallerForm
          userId={userId}
          username={userId}
          onLogout={handleLogout}
        />
      ) : (
        <SalespersonForm
          userId={userId}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;