import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  ArrowRight,
  AlertCircle,
  Loader2,
  MailCheck,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';

export default function Register() {
  const { register, verifyEmail, resendCode } = useAuth();
  const navigate = useNavigate();

  // Registration form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [roles, setRoles] = useState('Full Stack Engineer, Backend Engineer');
  const [remote, setRemote] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Verification step state
  const [step, setStep] = useState('register'); // 'register' | 'verify'
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  // Password strength calculation
  const calculateStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return score;
  };

  const strengthScore = calculateStrength(password);

  const getStrengthMeta = (score) => {
    switch (score) {
      case 0:
        return { label: 'Too Weak', color: 'bg-red-500', text: 'text-red-500' };
      case 1:
        return { label: 'Weak', color: 'bg-orange-500', text: 'text-orange-500' };
      case 2:
        return { label: 'Fair', color: 'bg-yellow-500', text: 'text-yellow-600' };
      case 3:
        return { label: 'Good', color: 'bg-blue-500', text: 'text-blue-600' };
      case 4:
        return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' };
      default:
        return { label: 'Too Weak', color: 'bg-slate-200', text: 'text-slate-400' };
    }
  };

  const strengthMeta = getStrengthMeta(strengthScore);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!termsAccepted) {
      setError('Please accept the Terms of Service to create an account.');
      return;
    }

    setSubmitting(true);
    try {
      const rolesArray = roles.split(',').map((r) => r.trim()).filter(Boolean);
      const res = await register(
        name,
        email.toLowerCase().trim(),
        password,
        confirmPassword,
        {
          roles: rolesArray,
          remote,
          minMatchScore: 0.6,
          emailAlerts: true,
        },
        termsAccepted
      );

      if (res && res.requiresVerification) {
        setStep('verify');
        if (res.devCode) {
          setVerificationCode(res.devCode);
          setResendMessage(`Auto-filled: Verification code is ${res.devCode}`);
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(
        err.response?.data?.error || 'Registration failed. Please check your email and credentials.'
      );
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
        setResendMessage('A fresh 6-digit code has been dispatched to your email.');
      }
      setTimeout(() => setResendMessage(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        {/* Step 1: Registration Form */}
        {step === 'register' && (
          <>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-200">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Create Account</h2>
              <p className="mt-1 text-xs text-slate-500">
                Join SmartJobs for real-time AI matching and job notifications
              </p>
            </div>

            <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-start space-x-2 text-[11px] text-emerald-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Live Domain Verification:</strong> Enter an active personal or work email. A 6-digit activation code confirms your ownership.
              </span>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>

              {/* Official Email */}
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
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Must be an active email address with genuine mail servers.
                </span>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters (letters & numbers)"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex space-x-1.5">
                      {[1, 2, 3, 4].map((stepNum) => (
                        <div
                          key={stepNum}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            strengthScore >= stepNum ? strengthMeta.color : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500">Password Strength:</span>
                      <span className={`font-semibold ${strengthMeta.text}`}>{strengthMeta.label}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Confirm Password</label>
                <div className="relative mt-1.5">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <span className="text-[11px] text-red-500 mt-1 block">Passwords do not match.</span>
                )}
                {confirmPassword && password === confirmPassword && (
                  <span className="text-[11px] text-emerald-600 mt-1 flex items-center space-x-1">
                    <Check className="h-3 w-3" />
                    <span>Passwords match</span>
                  </span>
                )}
              </div>

              {/* Target Roles */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Target Roles</label>
                <input
                  type="text"
                  value={roles}
                  onChange={(e) => setRoles(e.target.value)}
                  placeholder="Full Stack Engineer, Backend Engineer"
                  className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>

              {/* Remote Preference & Terms Checkboxes */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remotePref"
                    checked={remote}
                    onChange={(e) => setRemote(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="remotePref" className="text-xs text-slate-700 select-none">
                    Open to Remote Roles
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="termsAccepted"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="termsAccepted" className="text-xs text-slate-600 select-none">
                    I agree to the <span className="text-emerald-600 font-medium">Terms of Service</span> and{' '}
                    <span className="text-emerald-600 font-medium">Privacy Policy</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || (confirmPassword && password !== confirmPassword)}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-200 transition flex items-center justify-center space-x-2 disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying & Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account & Verify</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
                Sign In
              </Link>
            </div>
          </>
        )}

        {/* Step 2: Verification Code Input */}
        {step === 'verify' && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <MailCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900">Confirm Your Email</h2>
              <p className="mt-1 text-xs text-slate-500">
                A 6-digit verification code has been dispatched to:
              </p>
              <p className="text-xs font-semibold text-slate-800 bg-slate-50 py-1.5 px-3 rounded-lg mt-2 inline-block border border-slate-200">
                {email}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
              <strong>Email Delivery Notice:</strong> If live SMTP credentials are not yet configured in <code>.env</code>, check your terminal server console for the code.
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
                  Enter 6-Digit Verification Code
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
                  <span>Verify Email & Activate Account</span>
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
                  setStep('register');
                  setError('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                Change Email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
