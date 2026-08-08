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
      setResendCountdown(60);
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
    <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center pb-4 border-b border-[var(--color-border)]/60">
        <h2 className="text-base font-bold text-[var(--color-heading)] tracking-tight">Reset Your Password</h2>
        <p className="text-xs text-[var(--color-body)] mt-1 font-medium leading-relaxed">
          {forgotStep === 1 ? 'Enter your Employee ID or Registered Email to receive verification code.' : 'Enter the 6-digit verification code sent to your email.'}
        </p>
      </div>

      {forgotStep === 1 ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="identifier" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">
              Employee ID or Email *
            </label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-body)] group-focus-within:text-[var(--color-primary)] transition-colors pointer-events-none">
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
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl pl-11 pr-4 py-3.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all font-medium shadow-2xs"
                placeholder="e.g. EMP101 or email@crinza.com"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] font-semibold py-3.5 rounded-2xl text-xs cursor-pointer hover:bg-[var(--color-border)]/40 transition-all active:scale-95 shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={forgotLoading}
              className="flex-1 bg-[var(--color-primary)] hover:opacity-95 text-white font-semibold py-3.5 rounded-2xl text-xs cursor-pointer disabled:opacity-50 shadow-lg shadow-[var(--color-primary)]/25 transition-all active:scale-95"
            >
              {forgotLoading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="otp" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">Enter 6-Digit OTP *</label>
              <button
                type="button"
                disabled={resendCountdown > 0}
                onClick={handleSendOtp}
                className="text-xs font-semibold text-[var(--color-primary)] disabled:text-[var(--color-body)] disabled:opacity-50 hover:underline cursor-pointer transition-all"
              >
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
              </button>
            </div>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-body)] group-focus-within:text-[var(--color-primary)] transition-colors pointer-events-none">
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
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl pl-11 pr-4 py-3.5 text-xs font-mono tracking-[0.3em] text-center font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all shadow-2xs"
                placeholder="123456"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">New Password (Min 6 chars) *</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-body)] group-focus-within:text-[var(--color-primary)] transition-colors pointer-events-none">
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
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl pl-11 pr-12 py-3.5 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all shadow-2xs"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer p-1 transition-colors"
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

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setForgotStep(1)}
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] font-semibold py-3.5 rounded-2xl text-xs cursor-pointer hover:bg-[var(--color-border)]/40 transition-all active:scale-95 shadow-2xs"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={forgotLoading}
              className="flex-1 bg-[var(--color-primary)] hover:opacity-95 text-white font-semibold py-3.5 rounded-2xl text-xs cursor-pointer disabled:opacity-50 shadow-lg shadow-[var(--color-primary)]/25 transition-all active:scale-95"
            >
              {forgotLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

// 🌟 Main Login Component with Smooth Animations & Interactive Experience
const Login = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState({ userId: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  const socketRef = useRef(null);

  const API_BASE = import.meta.env.PROD
    ? "https://crinza-saleshub.onrender.com"
    : "http://localhost:5000";

  useEffect(() => {
    const savedUserId = localStorage.getItem('rememberedUserId');
    if (savedUserId) {
      setCredentials(prev => ({ ...prev, userId: savedUserId }));
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    let timer;
    if (lockoutTimer > 0) {
      timer = setInterval(() => setLockoutTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTimer]);

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

  // Mouse Parallax Glow Effect
  useEffect(() => {
    let animationFrameId = null;

    const handleMouseMove = (e) => {
      if (animationFrameId) return;

      animationFrameId = requestAnimationFrame(() => {
        const { innerWidth, innerHeight } = window;
        const x = (e.clientX / innerWidth - 0.5) * 30;
        const y = (e.clientY / innerHeight - 0.5) * 30;
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
    if (lockoutTimer > 0) {
      toast.error(`Too many failed attempts. Please wait ${lockoutTimer}s.`);
      return;
    }

    setLoading(true);

    try {
      const data = await loginUser(credentials);

      if (rememberMe) {
        localStorage.setItem('rememberedUserId', credentials.userId);
      } else {
        localStorage.removeItem('rememberedUserId');
      }

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

      setFailedAttempts(0);
      toast.success(`Welcome back, ${data.userId}!`);
      onLoginSuccess(data.token, data.role, data.userId);
    } catch (err) {
      const newFailedCount = failedAttempts + 1;
      setFailedAttempts(newFailedCount);

      if (newFailedCount >= 5) {
        setLockoutTimer(30);
        toast.error('Too many failed attempts! Account temporarily locked for 30 seconds.');
      } else {
        toast.error(
          err.response?.data?.message || 
          'Server connection error. Check credentials or backend status!'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--color-background)] transition-colors duration-500 relative overflow-hidden">
      
      {/* 🌟 Custom CSS Keyframe Styles for Floating Animation */}
      <style>{`
        @keyframes floatOrb {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        .animate-float-slow {
          animation: floatOrb 8s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: floatOrb 10s ease-in-out infinite 3s;
        }
        @keyframes cardEntrance {
          0% { opacity: 0; transform: translateY(20px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-card-entrance {
          animation: cardEntrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* 🌟 Animated Floating Ambient Glow Orbs */}
      <div 
        className="absolute w-[450px] h-[450px] bg-[var(--color-primary)]/15 rounded-full blur-[120px] pointer-events-none animate-float-slow"
        style={{
          transform: `translate(${mousePos.x * 1.2}px, ${mousePos.y * 1.2}px)`,
          top: '5%',
          left: '10%'
        }}
      ></div>
      <div 
        className="absolute w-[450px] h-[450px] bg-[var(--color-primary)]/10 rounded-full blur-[120px] pointer-events-none animate-float-delayed"
        style={{
          transform: `translate(${-mousePos.x * 1.2}px, ${-mousePos.y * 1.2}px)`,
          bottom: '5%',
          right: '10%'
        }}
      ></div>

      {/* 🌟 Main Card Container with Entrance Animation & Glassmorphism */}
      <div className="max-w-md w-full bg-[var(--color-card)]/85 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.15)] p-8 sm:p-10 border border-[var(--color-border)] backdrop-blur-xl space-y-8 relative z-10 animate-card-entrance hover:shadow-[0_30px_70px_rgba(0,0,0,0.18)] transition-all duration-300">
        
        {/* Header Section / Logo with Pulse Hover */}
        <div className="text-center flex flex-col items-center space-y-4 pt-2">
          {!imgError ? (
            <div className="p-4 bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] shadow-md shadow-black/5 transform hover:scale-105 hover:shadow-xl hover:shadow-[var(--color-primary)]/15 transition-all duration-300">
              <img 
                src={logoImage} 
                alt="Crinza Logo" 
                className="h-14 sm:h-16 w-auto object-contain"
                onError={() => setImgError(true)}
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-black text-2xl mb-1 border border-[var(--color-primary)]/20 shadow-md">
              C
            </div>
          )}
          
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-heading)] tracking-tight">
              Welcome Back
            </h1>
            {/* <p className="text-xs text-[var(--color-body)] font-medium">
              Sign in to access your Crinza Sales Portal
            </p> */}
          </div>
        </div>

        {/* Form Switcher Area */}
        <div className="transition-all duration-300 ease-in-out">
          {!showForgotModal ? (
            <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-300">
              
              {/* User ID Field */}
              <div className="space-y-1.5">
                <label htmlFor="userId" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">
                  User ID
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-body)] group-focus-within:text-[var(--color-primary)] transition-colors pointer-events-none">
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
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl pl-11 pr-4 py-3.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200 shadow-2xs font-semibold"
                    placeholder="e.g. BOSS101, EMP101"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-heading)]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer transition-all"
                  >
                    Forgot Password?
                  </button>
                </div>
                
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-body)] group-focus-within:text-[var(--color-primary)] transition-colors pointer-events-none">
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
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-2xl pl-11 pr-12 py-3.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all duration-200 shadow-2xs font-semibold"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-body)] hover:text-[var(--color-heading)] cursor-pointer p-1 transition-colors"
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
                  <p className="text-[10px] text-amber-500 font-semibold tracking-wide pl-1 mt-1 flex items-center gap-1 animate-pulse">
                    <span>⚠️</span> Caps Lock is on
                  </p>
                )}
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer text-[var(--color-body)] select-none group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)] cursor-pointer transition-all"
                  />
                  <span className="group-hover:text-[var(--color-heading)] transition-colors font-medium">Remember my ID</span>
                </label>
              </div>

              {/* Submit Button with Hover Lift */}
              <button
                type="submit"
                disabled={loading || lockoutTimer > 0}
                className="w-full mt-2 bg-[var(--color-primary)] hover:opacity-95 hover:shadow-xl hover:-translate-y-0.5 text-white font-semibold py-4 rounded-2xl transition-all duration-200 cursor-pointer disabled:opacity-50 shadow-lg shadow-[var(--color-primary)]/25 flex items-center justify-center text-xs sm:text-sm active:scale-95"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Authenticating...
                  </span>
                ) : lockoutTimer > 0 ? `Locked (${lockoutTimer}s)` : 'Sign In'}
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