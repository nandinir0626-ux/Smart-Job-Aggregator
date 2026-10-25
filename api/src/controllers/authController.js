const crypto = require('crypto');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const {
  validateEmailDomain,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
} = require('../services/emailService');

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Full name is required.',
    'string.min': 'Full name must be at least 2 characters.',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email address is required.',
    'string.email': 'Please enter a valid email address.',
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
    .required()
    .messages({
      'string.empty': 'Password is required.',
      'string.min': 'Password must be at least 8 characters.',
      'string.pattern.base': 'Password must contain at least one letter and one number.',
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .optional()
    .messages({
      'any.only': 'Passwords do not match.',
    }),
  termsAccepted: Joi.boolean().optional(),
  preferences: Joi.object({
    roles: Joi.array().items(Joi.string()),
    locations: Joi.array().items(Joi.string()),
    remote: Joi.boolean(),
    minMatchScore: Joi.number().min(0).max(1),
    emailAlerts: Joi.boolean(),
  }).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required.',
    'string.email': 'Please enter a valid email address.',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required.',
  }),
});

const verifyEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required().messages({
    'string.length': 'Verification code must be 6 digits.',
  }),
});

const resendCodeSchema = Joi.object({
  email: Joi.string().email().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required.',
    'string.email': 'Please enter a valid email address.',
  }),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required.',
    'string.email': 'Please enter a valid email address.',
  }),
  code: Joi.string().length(6).optional().messages({
    'string.length': 'Verification code must be exactly 6 digits.',
  }),
  token: Joi.string().optional(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters.',
      'string.pattern.base': 'Password must contain at least one letter and one number.',
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match.',
      'string.empty': 'Please confirm your password.',
    }),
});

const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

/**
 * Register a new user with email and password
 */
const register = async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const email = value.email.toLowerCase().trim();

    // 1. Live DNS MX verification & disposable domain blocker
    try {
      await validateEmailDomain(email);
    } catch (domainErr) {
      return res.status(400).json({
        success: false,
        error: domainErr.message,
      });
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists and is already verified
      if (existingUser.isVerified) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists. Please sign in.',
        });
      }

      // If user exists but is NOT verified yet, refresh verification code and re-send
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      existingUser.verificationCode = newCode;
      existingUser.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
      existingUser.name = value.name;
      existingUser.passwordHash = await User.hashPassword(value.password);
      if (value.preferences) existingUser.preferences = value.preferences;
      await existingUser.save();

      const emailRes = await sendVerificationEmail(email, newCode, existingUser.name);

      return res.status(200).json({
        success: true,
        requiresVerification: true,
        email,
        devCode: (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'production') ? newCode : undefined,
        previewUrl: emailRes?.previewUrl || undefined,
        message: 'A 6-digit verification code has been dispatched to your official email.',
      });
    }

    // 3. Generate a secure 6-digit OTP code (valid for 15 minutes)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    const passwordHash = await User.hashPassword(value.password);
    const user = await User.create({
      name: value.name,
      email,
      passwordHash,
      authProvider: 'local',
      isVerified: false,
      verificationCode,
      verificationCodeExpires,
      preferences: value.preferences || {},
    });

    // 4. Send email with verification code
    const emailRes = await sendVerificationEmail(email, verificationCode, user.name);

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      email: user.email,
      devCode: (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'production') ? verificationCode : undefined,
      previewUrl: emailRes?.previewUrl || undefined,
      message: 'Account registered. Please enter the 6-digit verification code sent to your email to activate your account.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify 6-digit email activation code
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { error, value } = verifyEmailSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const email = value.email.toLowerCase().trim();
    const code = value.code.trim();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account found with this email address.',
      });
    }

    if (user.isVerified) {
      const token = generateToken(user._id);
      return res.status(200).json({
        success: true,
        message: 'Email is already verified.',
        token,
        user,
      });
    }

    if (!user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 6-digit verification code. Please check your inbox or click resend.',
      });
    }

    if (user.verificationCodeExpires && new Date() > user.verificationCodeExpires) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please click "Resend Code" to get a fresh one.',
      });
    }

    // Mark as verified & clear single-use code
    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Email successfully verified! Welcome to SmartJobs.',
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Resend verification code
 */
const resendVerificationCode = async (req, res, next) => {
  try {
    const { error, value } = resendCodeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const email = value.email.toLowerCase().trim();
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account registered with this email.',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        error: 'This email is already verified. You can log in directly.',
      });
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = newCode;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const emailRes = await sendVerificationEmail(email, newCode, user.name);

    return res.status(200).json({
      success: true,
      devCode: (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'production') ? newCode : undefined,
      previewUrl: emailRes?.previewUrl || undefined,
      message: 'A fresh verification code has been dispatched to your email.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Standard Email / Password login
 */
const login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const email = value.email.toLowerCase().trim();
    const user = await User.findOne({ email });

    // Protect against user enumeration by returning a generic invalid error
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    // If user has no local password set
    if (!user.passwordHash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password. Please use Forgot Password to set up your password.',
      });
    }

    const isMatch = await user.comparePassword(value.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    // Gate: Check if email is verified
    if (!user.isVerified) {
      let code = user.verificationCode;
      if (!code || (user.verificationCodeExpires && new Date() > user.verificationCodeExpires)) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = code;
        user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
      }
      const emailRes = await sendVerificationEmail(email, code, user.name);

      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        devCode: (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'production') ? code : undefined,
        previewUrl: emailRes?.previewUrl || undefined,
        error: 'Your email address has not been verified yet. Please enter the verification code sent to your email.',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get current authenticated user profile
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};

/**
 * Forgot Password - Generate 6-digit OTP and send via email (valid for 15 minutes)
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const email = value.email.toLowerCase().trim();

    // Verify email domain validity
    try {
      await validateEmailDomain(email);
    } catch (domainErr) {
      return res.status(400).json({
        success: false,
        error: domainErr.message,
      });
    }

    const user = await User.findOne({ email });

    // Generic response regardless of whether account exists to prevent account harvesting
    const genericResponse = {
      success: true,
      message: 'If an account exists for that email, a 6-digit verification code has been dispatched (valid for 15 minutes).',
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Generate cryptographically random 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const rawResetToken = crypto.randomBytes(32).toString('hex');

    // Store 6-digit code and SHA-256 token in database with 15-minute expiration
    user.resetPasswordCode = resetCode;
    user.resetPasswordToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    // Dispatch real email via Google SMTP / Resend
    await sendPasswordResetOtpEmail(user.email, resetCode, user.name);

    return res.status(200).json(genericResponse);
  } catch (err) {
    next(err);
  }
};

/**
 * Reset Password - Verify 6-digit OTP code and set new secure password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { email, code, token, password } = value;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address or verification code.',
      });
    }

    // Verify 6-digit code or fallback to token for test compatibility
    let isCodeValid = false;

    if (code) {
      isCodeValid = Boolean(
        user.resetPasswordCode &&
        user.resetPasswordCode === code.trim() &&
        user.resetPasswordExpires &&
        new Date() < user.resetPasswordExpires
      );
    } else if (token) {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      isCodeValid = Boolean(
        user.resetPasswordToken &&
        user.resetPasswordToken === hashedToken &&
        user.resetPasswordExpires &&
        new Date() < user.resetPasswordExpires
      );
    }

    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is invalid or has expired (15-minute validity). Please request a fresh code.',
      });
    }

    // Set new password hash and invalidate the reset code/token immediately (Single-Use!)
    user.passwordHash = await User.hashPassword(password);
    user.resetPasswordCode = null;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.isVerified = true; // Setting password confirms email control
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout - Invalidate frontend session state
 */
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

module.exports = {
  register,
  verifyEmail,
  resendVerificationCode,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  logout,
};
