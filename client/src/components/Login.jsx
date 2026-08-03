import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { loginUser } from '../api/api';
import logoImage from '../Assets/logo.png'; 

const Login = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState({ userId: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  // 🌟 Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); 
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // 🖱️ Mouse Parallax Position State
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      // Normalize mouse position between -1 and 1
      const x = (e.clientX / innerWidth - 0.5) * 20;
      const y = (e.clientY / innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const API_BASE = import.meta.env.PROD
    ? "https://crinza-saleshub.onrender.com"
    : "http://localhost:5000";

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await loginUser(credentials);

      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('userId', data.userId);
      
      toast.success(`Welcome back, ${data.userId}!`);
      onLoginSuccess(data.token, data.role, data.userId);
    } catch (err) {
      toast.error(
        err.response?.data?.message || 
        'Server connection error. Check if Backend is running!'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error('Please enter your Employee ID or Registered Email!');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');

      toast.success(data.message || 'OTP sent to your registered email!');
      setForgotStep(2);
    } catch (err) {
      toast.error(err.message || 'Error sending OTP');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword.trim()) {
      toast.error('Please enter both OTP and new password!');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long!');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), otp: otp.trim(), newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Password reset failed');

      toast.success(data.message || 'Password updated successfully!');
      setShowForgotModal(false);
      setForgotStep(1);
      setIdentifier('');
      setOtp('');
      setNewPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--color-background)] transition-colors duration-300 relative overflow-hidden">
      
      {/* 🌟 Interactive Mouse-Tracking Background Glow Blobs */}
      <div 
        className="absolute w-96 h-96 bg-[var(--color-primary)]/15 rounded-full blur-3xl pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: `translate(${mousePos.x * 1.5}px, ${mousePos.y * 1.5}px)`,
          top: '10%',
          left: '15%'
        }}
      ></div>
      <div 
        className="absolute w-96 h-96 bg-[var(--color-primary)]/10 rounded-full blur-3xl pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: `translate(${-mousePos.x * 1.5}px, ${-mousePos.y * 1.5}px)`,
          bottom: '10%',
          right: '15%'
        }}
      ></div>

      <div className="max-w-md w-full bg-[var(--color-card)] rounded-3xl shadow-2xl p-8 sm:p-10 border border-[var(--color-border)] backdrop-blur-xl space-y-6 relative z-10 transition-all duration-300 animate-fadeIn">
        
        {/* Header / Logo Section */}
        <div className="text-center flex flex-col items-center space-y-3">
          {!imgError ? (
            <div className="p-3.5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm mb-1 transform hover:scale-105 transition-transform duration-200">
              <img 
                src={logoImage} 
                alt="Crinza Logo" 
                className="h-12 sm:h-14 w-auto object-contain"
                onError={() => setImgError(true)}
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-black text-xl mb-1 border border-[var(--color-primary)]/20 shadow-sm">
              C
            </div>
          )}
          
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-heading)] tracking-tight">
              Welcome to Crinza
            </h1>
            <p className="text-[var(--color-body)] text-xs sm:text-sm font-medium">
              Sign in to access your Invoice & Sales Portal
            </p>
          </div>
        </div>

        {/* Form Section with smooth swap transitions */}
        <div className="transition-all duration-300 ease-in-out">
          {!showForgotModal ? (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fadeIn">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">
                  User ID
                </label>
                <input
                  type="text"
                  name="userId"
                  required
                  value={credentials.userId}
                  onChange={handleChange}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl px-4 py-3.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200 shadow-sm font-medium"
                  placeholder="e.g. BOSS101, EMP101"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    value={credentials.password}
                    onChange={handleChange}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl px-4 py-3.5 pr-14 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200 shadow-sm font-medium"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-body)] hover:text-[var(--color-heading)] text-xs font-semibold cursor-pointer px-1 py-0.5 rounded transition-colors"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-3.5 rounded-2xl transition-all duration-200 cursor-pointer disabled:opacity-50 shadow-lg shadow-[var(--color-primary)]/20 flex items-center justify-center text-xs sm:text-sm active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Authenticating...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-center pb-3 border-b border-[var(--color-border)]">
                <h2 className="text-sm font-bold text-[var(--color-heading)]">Reset Your Password</h2>
                <p className="text-[11px] text-[var(--color-body)] mt-0.5 font-medium">
                  {forgotStep === 1 ? 'Enter your Employee ID or Registered Email' : 'Enter the OTP received on your registered email'}
                </p>
              </div>

              {forgotStep === 1 ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">
                      Employee ID or Email *
                    </label>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] font-medium"
                      placeholder="e.g. EMP101 or email@crinza.com"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowForgotModal(false); setForgotStep(1); }}
                      className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] font-semibold py-3 rounded-2xl text-xs cursor-pointer hover:bg-[var(--color-border)]/30 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 bg-[var(--color-primary)] text-white font-semibold py-3 rounded-2xl text-xs cursor-pointer disabled:opacity-50 shadow-md transition-all active:scale-[0.98]"
                    >
                      {forgotLoading ? 'Sending...' : 'Send OTP'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-heading)]">Enter 6-Digit OTP *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-xl px-3 py-3 text-xs font-mono tracking-widest text-center font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                      placeholder="123456"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-heading)]">New Password (Min 6 chars) *</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-xl px-3 py-3 pr-14 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-body)] hover:text-[var(--color-heading)] text-[11px] font-semibold cursor-pointer"
                      >
                        {showNewPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] font-semibold py-3 rounded-2xl text-xs cursor-pointer hover:bg-[var(--color-border)]/30 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 bg-[var(--color-primary)] text-white font-semibold py-3 rounded-2xl text-xs cursor-pointer disabled:opacity-50 shadow-md transition-all active:scale-[0.98]"
                    >
                      {forgotLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Login;