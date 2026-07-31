import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { loginUser } from '../api/api';
import logoImage from '../Assets/logo.png'; 

const Login = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState({ userId: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--color-background)] transition-colors duration-300">
      <div className="max-w-md w-full bg-[var(--color-card)] rounded-3xl shadow-2xl p-6 sm:p-8 border border-[var(--color-border)] backdrop-blur-lg">
        
        {/* Header / Logo Section */}
        <div className="text-center mb-8 flex flex-col items-center">
          {!imgError ? (
            <img 
              src={logoImage} 
              alt="Crinza Logo" 
              className="h-14 sm:h-16 w-auto object-contain mb-4 drop-shadow-sm"
              onError={() => setImgError(true)}
            />
          ) : (
            <h1 className="text-3xl font-black text-[var(--color-primary)] tracking-wider mb-2">CRINZA</h1>
          )}
          
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-heading)] tracking-tight">
            Welcome to Crinza
          </h1>
          <p className="text-[var(--color-body)] text-xs sm:text-sm mt-1">
            Sign in to access your Invoice Portal
          </p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-heading)] mb-2">
              User ID
            </label>
            <input
              type="text"
              name="userId"
              required
              value={credentials.userId}
              onChange={handleChange}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all duration-200 shadow-sm"
              placeholder="e.g. BOSS101, EMP101"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-heading)]">
                Password
              </label>
            </div>
            <input
              type="password"
              name="password"
              required
              value={credentials.password}
              onChange={handleChange}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-heading)] rounded-xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all duration-200 shadow-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium py-3.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 shadow-lg shadow-[var(--color-primary)]/25 flex items-center justify-center text-sm sm:text-base active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authenticating...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Demo Credentials Box */}
        <div className="mt-8 p-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] text-xs space-y-2 shadow-inner">
          <p className="font-semibold text-[var(--color-heading)] mb-1 uppercase tracking-wider text-[10px]">Demo Credentials:</p>
          <div className="flex items-center justify-between text-[var(--color-body)] py-1 border-b border-[var(--color-border)]/50">
            <span>👑 <strong className="text-purple-600">Admin:</strong> BOSS101</span>
            <code className="bg-[var(--color-background)] px-2 py-0.5 rounded border border-[var(--color-border)]">Boss@123</code>
          </div>
          <div className="flex items-center justify-between text-[var(--color-body)] py-1 border-b border-[var(--color-border)]/50">
            <span>👤 <strong className="text-[var(--color-primary)]">Sales:</strong> EMP101</span>
            <code className="bg-[var(--color-background)] px-2 py-0.5 rounded border border-[var(--color-border)]">Admin@123</code>
          </div>
          <div className="flex items-center justify-between text-[var(--color-body)] py-1">
            <span>📑 <strong className="text-[var(--color-success)]">Accountant:</strong> ACCT101</span>
            <code className="bg-[var(--color-background)] px-2 py-0.5 rounded border border-[var(--color-border)]">Acct@123</code>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;