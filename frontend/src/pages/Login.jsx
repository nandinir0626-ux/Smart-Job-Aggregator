import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  ArrowRight,
  AlertCircle,
  Loader2,
  MailCheck,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function Login() {
  const { login, verifyEmail, resendCode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Unverified user state
  const [showVerifyStep, setShowVerifyStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.toLowerCase().trim(), password);
      navigate('/');
    } catch (err) {
      if (err.response?.data?.requiresVerification) {
        setShowVerifyStep(true);
        if (err.response.data.devCode) {
          setVerificationCode(err.response.data.devCode);
          setResendMessage(`Auto-filled: Verification code is ${err.response.data.devCode}`);
        }
        setError(err.response?.data?.error || 'Please enter the verification code sent to your email.');
      } else {
        setError(err.response?.data?.error || 'Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      await verifyEmail(email.toLowerCase().trim(), verificationCode.trim());
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired verification code.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    setResendMessage('');
    try {
      const res = await resendCode(email.toLowerCase().trim());
      if (res?.devCode) {
        setVerificationCode(res.devCode);
        setResendMessage(`Auto-filled: Fresh verification code is ${res.devCode}`);
      } else {
        setResendMessage('A fresh verification code has been dispatched to your email.');
      }
      setTimeout(() => setResendMessage(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        
        {!showVerifyStep ? (
          <>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-200">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Welcome Back</h2>
              <p className="mt-1 text-xs text-slate-500">
                Sign in to access personalized real-time job recommendations
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@gmail.com"
                  className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!email || !email.trim()) {
                        setError('Please enter your account email address above first to reset your password.');
                        return;
                      }
                      navigate(`/forgot-password?email=${encodeURIComponent(email.trim())}`);
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-200 transition flex items-center justify-center space-x-2 disabled:opacity-70"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-emerald-600 hover:text-emerald-700">
                Create one now
              </Link>
            </div>
          </>
        ) : (
          /* Unverified User Prompt */
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <MailCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900">Email Verification Needed</h2>
              <p className="mt-1 text-xs text-slate-500">
                Please enter the 6-digit code sent to:
              </p>
              <p className="text-xs font-semibold text-slate-800 bg-slate-50 py-1.5 px-3 rounded-lg mt-2 inline-block border border-slate-200">
                {email}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
              <strong>Notice:</strong> If SMTP credentials are not yet configured in <code>.env</code>, check your terminal server console for the code.
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {resendMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{resendMessage}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-center text-xs font-semibold text-slate-700 mb-2">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="••••••"
                  className="w-full text-center text-2xl font-mono font-bold tracking-[0.4em] py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={verifying || verificationCode.length !== 6}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-200 transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify Email & Log In</span>
                )}
              </button>
            </form>

            <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>Resend Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowVerifyStep(false);
                  setError('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
