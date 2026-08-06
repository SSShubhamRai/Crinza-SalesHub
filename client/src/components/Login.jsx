import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { loginUser } from '../api/api';
import logoImage from '../Assets/logo.png'; 
import { Preferences } from '@capacitor/preferences';
import { io } from 'socket.io-client';

// 🌟 Extracted Forgot Password Sub-Component with Cooldown Timer
const ForgotPasswordModal = ({ API_BASE, onCancel, onSuccess }) => {
  const [forgotStep, setForgotStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

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
      setResendCountdown(60); // 60-second cooldown
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
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
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
            <label htmlFor="identifier" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">
              Employee ID or Email *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-body)] pointer-events-none">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </span>
              <input
                id="identifier"
                type="text"
                required
                autoComplete="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value.trimStart())}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] font-medium"
                placeholder="e.g. EMP101 or email@crinza.com"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
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
            <div className="flex justify-between items-center">
              <label htmlFor="otp" className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-heading)]">Enter 6-Digit OTP *</label>
              <button
                type="button"
                disabled={resendCountdown > 0}
                onClick={handleSendOtp}
                className="text-[10px] font-semibold text-[var(--color-primary)] disabled:text-[var(--color-body)] disabled:opacity-50 hover:underline cursor-pointer"
              >
                {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP'}
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-body)] pointer-events-none">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </span>
              <input
                id="otp"
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.trimStart())}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-xl pl-10 pr-3 py-3 text-xs font-mono tracking-widest text-center font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                placeholder="123456"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="newPassword" className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-heading)]">New Password (Min 6 chars) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-body)] pointer-events-none">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-xl pl-10 pr-12 py-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer p-1"
                aria-label="Toggle password visibility"
              >
                {showNewPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
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
  );
};

// 🌟 Main Login Component with Caps Lock Detection
const Login = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState({ userId: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const socketRef = useRef(null);

  const API_BASE = import.meta.env.PROD
    ? "https://crinza-saleshub.onrender.com"
    : "http://localhost:5000";

  // Force Logout Socket Listener
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    if (token && userId) {
      socketRef.current = io(API_BASE, { auth: { token } });

      socketRef.current.on('connect', () => {
        socketRef.current.emit('register_user', { userId });
      });

      socketRef.current.on('force_logout', (data) => {
        toast.error(data.message || "Session expired: Logged in from another device.");
        localStorage.clear();
        Preferences.clear();
        window.location.reload();
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [API_BASE]);

  // Throttled Mouse Parallax Effect
  useEffect(() => {
    let animationFrameId = null;

    const handleMouseMove = (e) => {
      if (animationFrameId) return;

      animationFrameId = requestAnimationFrame(() => {
        const { innerWidth, innerHeight } = window;
        const x = (e.clientX / innerWidth - 0.5) * 20;
        const y = (e.clientY / innerHeight - 0.5) * 20;
        setMousePos({ x, y });
        animationFrameId = null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value.trimStart() });
  };

  const handleKeyDown = (e) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await loginUser(credentials);

      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('userId', data.userId);
      
      await Preferences.set({ key: 'isLoggedIn', value: 'true' });
      await Preferences.set({ key: 'salespersonId', value: data.userId });

      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      socketRef.current = io(API_BASE, { auth: { token: data.token } });
      socketRef.current.emit('register_user', { userId: data.userId });

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--color-background)] transition-colors duration-300 relative overflow-hidden">
      
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

      <div className="max-w-md w-full bg-[var(--color-card)] rounded-3xl shadow-2xl p-8 sm:p-10 border border-[var(--color-border)] backdrop-blur-xl space-y-6 relative z-10 transition-all duration-300 animate-fadeIn ring-1 ring-white/10">
        
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
              Welcome to CRINZA
            </h1>
          </div>
        </div>

        <div className="transition-all duration-300 ease-in-out">
          {!showForgotModal ? (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fadeIn">
              <div className="space-y-1.5">
                <label htmlFor="userId" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">
                  User ID
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-body)] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    id="userId"
                    type="text"
                    name="userId"
                    required
                    autoComplete="username"
                    value={credentials.userId}
                    onChange={handleChange}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl pl-11 pr-4 py-3.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200 shadow-sm font-medium"
                    placeholder="e.g. BOSS101, EMP101"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">
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
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-body)] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    autoComplete="current-password"
                    value={credentials.password}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyDown}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl pl-11 pr-12 py-3.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200 shadow-sm font-medium"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {capsLockOn && (
                  <p className="text-[10px] text-amber-500 font-semibold tracking-wide pl-1 mt-1">
                    ⚠️ Caps Lock is on
                  </p>
                )}
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
            <ForgotPasswordModal 
              API_BASE={API_BASE} 
              onCancel={() => setShowForgotModal(false)} 
              onSuccess={() => setShowForgotModal(false)} 
            />
          )}
        </div>

      </div>
    </div>
  );
};

export default Login;