// src/App.jsx mein update karein
import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast'; // 1. Import Toaster
import Login from './components/Login';
import SalespersonForm from './components/SalespersonForm';
import AccountantPanel from './components/AccountantPanel';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);

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
    <div className="min-h-screen bg-[var(--color-background)] font-[var(--font-body)] text-[var(--color-body)]">
      {/* 2. Add Toaster here */}
      <Toaster position="top-right" reverseOrder={false} />

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