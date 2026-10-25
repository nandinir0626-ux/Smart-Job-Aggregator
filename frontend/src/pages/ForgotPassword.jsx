import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  KeyRound,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
  Clock,
} from 'lucide-react';

export default function ForgotPassword() {
  const { forgotPassword, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Step state: 'request' | 'verify' | 'success'
  const [step, setStep] = useState('request');

  // Form states
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Pre-fill email from query param if available
  useEffect(() => {
    const qEmail = searchParams.get('email');
    if (qEmail) {
      setEmail(qEmail);
    }
  }, [searchParams]);

  // Cooldown timer for resend code
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    if (pwd.length >= 12) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-sky-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  // Step 1: Request 6-digit OTP
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email || !email.trim()) {
      setError('Please enter your account email address.');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.toLowerCase().trim());
      setStep('verify');
      setCooldown(60);
      setSuccessMessage('A 6-digit verification code has been dispatched to your email.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to dispatch verification code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  // Resend 6-digit OTP
  const handleResendCode = async () => {
    if (cooldown > 0 || resending) return;
    setError('');
    setResending(true);
    try {
      await forgotPassword(email.toLowerCase().trim());
      setCooldown(60);
      setSuccessMessage('A fresh 6-digit code has been dispatched to your email.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Step 2: Verify OTP and update password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (code.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code sent to your email.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(code.trim(), email.toLowerCase().trim(), password, confirmPassword);
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. Please check your verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        
        {/* Header Icon & Title */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            {step === 'success' ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ) : (
              <KeyRound className="h-6 w-6" />
            )}
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            {step === 'request' && 'Forgot Password'}
            {step === 'verify' && 'Verify & Set New Password'}
            {step === 'success' && 'Password Updated!'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {step === 'request' && "Enter your registered email and we'll dispatch a secure 6-digit verification code."}
            {step === 'verify' && 'Enter the 6-digit code sent to your email along with your new password.'}
            {step === 'success' && 'Your account password has been securely reset. You can now sign in.'}
          </p>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="mt-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success message banner */}
        {successMessage && step === 'verify' && (
          <div className="mt-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 1: Request 6-Digit OTP                                */}
        {/* ========================================================= */}
        {step === 'request' && (
          <form className="mt-6 space-y-4" onSubmit={handleRequestCode}>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Account Email Address</label>
              <div className="relative mt-1.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@gmail.com"
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 flex items-start space-x-2 text-[11px] text-emerald-800">
              <Clock className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>15-Minute Validity:</strong> A single-use 6-digit OTP will be dispatched to your registered inbox.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-200 transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Send 6-Digit Code</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center space-x-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* STEP 2: Enter 6-Digit OTP + Set New Password              */}
        {/* ========================================================= */}
        {step === 'verify' && (
          <form className="mt-6 space-y-4" onSubmit={handleResetPassword}>
            {/* Target Email Badge & 15-Minute Alert */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center space-y-1">
              <span className="text-[11px] text-slate-500 block">Code dispatched to:</span>
              <span className="text-xs font-bold text-slate-800 font-mono">{email}</span>
              <div className="flex items-center justify-center space-x-1 text-[11px] font-semibold text-amber-700 pt-1">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>Expires in 15 minutes</span>
              </div>
            </div>

            {/* 6-Digit OTP Input */}
            <div>
              <label className="block text-center text-xs font-semibold text-slate-700 mb-1.5">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="••••••"
                className="w-full text-center text-2xl font-mono font-bold tracking-[0.4em] py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">New Password</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters..."
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Strength:</span>
                    <span className="font-semibold text-slate-700">{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full ${strength.color} transition-all duration-300`}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">Confirm New Password</label>
              <div className="relative mt-1">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm matching password..."
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6 || !password}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-200 transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Resetting Password...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Save New Password</span>
                </>
              )}
            </button>

            {/* Resend & Back actions */}
            <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={cooldown > 0 || resending}
                className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('request');
                  setError('');
                  setSuccessMessage('');
                  setCode('');
                }}
                className="text-slate-500 hover:text-slate-800 font-medium"
              >
                Change Email
              </button>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* STEP 3: Success Confirmation                              */}
        {/* ========================================================= */}
        {step === 'success' && (
          <div className="mt-6 space-y-4 text-center">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900">Account Secured</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Your password has been updated and your session credentials have been refreshed.
              </p>
            </div>

            <Link
              to="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-200 transition flex items-center justify-center space-x-2"
            >
              <span>Sign In with New Password</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
