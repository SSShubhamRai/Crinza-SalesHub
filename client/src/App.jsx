// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import SalespersonForm from './components/SalespersonForm';
import AccountantPanel from './components/AccountantPanel';
import AdminDashboard from './components/admin/AdminDashboard'; // 👈 Updated path for modularized Admin Dashboard

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  
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
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

      {!token ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : role === 'boss' || role === 'admin' ? (
        <AdminDashboard userId={userId} onLogout={handleLogout} />
      ) : role === 'accountant' ? (
        <AccountantPanel userId={userId} onLogout={handleLogout} />
      ) : (
        <SalespersonForm userId={userId} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;