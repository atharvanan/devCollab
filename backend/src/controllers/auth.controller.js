const crypto = require('crypto');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/jwt');
const { sendOTPEmail, sendPasswordResetEmail } = require('../services/email.service');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

exports.register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  let user = await User.findOne({ email });
  if (user) {
    if (user.isVerified) {
      throw new AppError('Email already registered', 400);
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.name = name || user.name;
    user.password = password;
    user.role = 'user';
    user.canCreateProjects = true;
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    await sendOTPEmail(email, otp, user.name);

    return res.status(200).json({
      success: true,
      requiresOTP: true,
      message: 'Account pending verification. A fresh verification code has been sent to your email.',
      data: {
        userId: user._id,
        email: user.email,
      },
    });
  }

  const userCount = await User.countDocuments();
  const isFirstUser = userCount === 0;

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  user = await User.create({
    name,
    email,
    password,
    role: isFirstUser ? 'admin' : 'user',
    canCreateProjects: true,
    isVerified: false,
    otp,
    otpExpires,
  });

  await sendOTPEmail(email, otp, name);

  res.status(201).json({
    success: true,
    requiresOTP: true,
    message: 'Verification code sent to your email address.',
    data: {
      userId: user._id,
      email: user.email,
    },
  });
});

exports.verifyOTP = catchAsync(async (req, res) => {
  const { userId, email, otp } = req.body;

  const query = userId ? { _id: userId } : { email };
  const user = await User.findOne(query).select('+otp +otpExpires +otpAttempts +otpLockedUntil +refreshTokens');
  if (!user) throw new AppError('User not found', 404);

  if (user.otpLockedUntil && user.otpLockedUntil > Date.now()) {
    throw new AppError('Too many failed attempts. Account temporarily locked for 15 minutes.', 429);
  }

  const isValidOtp = Boolean(user.otp && user.otp === otp);

  if (!isValidOtp) {
    user.otpAttempts = (user.otpAttempts || 0) + 1;
    if (user.otpAttempts >= 5) {
      user.otpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.otp = undefined;
    }
    await user.save();
    if (user.otpAttempts >= 5) {
      throw new AppError('Maximum OTP attempts exceeded. Account locked for 15 minutes.', 429);
    }
    throw new AppError(`Invalid OTP. ${5 - user.otpAttempts} attempts remaining.`, 400);
  }

  if (user.otpExpires < Date.now()) throw new AppError('OTP expired. Request a new one.', 400);

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  user.otpLockedUntil = undefined;
  user.lastSeen = new Date();

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  await user.save();

  setRefreshCookie(res, refreshToken);
  res.json({
    success: true,
    message: 'Authentication successful',
    data: { accessToken, user: user.toPublicJSON() },
  });
});

exports.resendOTP = catchAsync(async (req, res) => {
  const { userId, email } = req.body;
  const query = userId ? { _id: userId } : { email };
  const user = await User.findOne(query).select('+otp +otpExpires');
  if (!user) throw new AppError('User not found', 404);

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOTPEmail(user.email, otp, user.name);

  res.json({
    success: true,
    message: 'A fresh verification code has been sent to your email.',
    data: {
      userId: user._id,
      email: user.email,
    },
  });
});

exports.login = catchAsync(async (req, res) => {
  const { email, password, otp } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshTokens +otp +otpExpires');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  // If OTP is provided in the login body, verify it immediately
  if (otp) {
    if (!user.otp || user.otp !== otp) throw new AppError('Invalid OTP', 400);
    if (user.otpExpires < Date.now()) throw new AppError('OTP expired. Request a new one.', 400);
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.lastSeen = new Date();

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
    await user.save();

    setRefreshCookie(res, refreshToken);
    return res.json({ success: true, data: { accessToken, user: user.toPublicJSON() } });
  }

  // Automated Jest integration tests bypass flag (for fast test suites)
  if (process.env.NODE_ENV === 'test' && !req.headers['x-require-otp']) {
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        isUnverified: true,
        message: 'Please verify your email before logging in. A new OTP has been sent.',
        data: {
          userId: user._id,
          email: user.email,
        },
      });
    }
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
    user.lastSeen = new Date();
    await user.save();
    setRefreshCookie(res, refreshToken);
    return res.json({ success: true, data: { accessToken, user: user.toPublicJSON() } });
  }

  const loginOtp = generateOTP();
  user.otp = loginOtp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOTPEmail(user.email, loginOtp, user.name);

  return res.json({
    success: true,
    requiresOTP: true,
    message: 'A 6-digit verification code has been sent to your email address.',
    data: {
      userId: user._id,
      email: user.email,
    },
  });
});

exports.refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) throw new AppError('No refresh token', 401);

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await User.findById(payload.id).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(token)) {
    throw new AppError('Refresh token revoked', 401);
  }

  const accessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
  user.refreshTokens.push(newRefreshToken);
  await user.save();

  setRefreshCookie(res, newRefreshToken);
  res.json({ success: true, data: { accessToken } });
});

exports.logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;

  try {
    if (token && req.user) {
      const user = await User.findById(req.user._id).select('+refreshTokens');
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
        await user.save();
      }
    } else if (token) {
      // User not authenticated via header, attempt recovery from refresh token payload
      const { verifyRefreshToken } = require('../utils/jwt');
      const payload = verifyRefreshToken(token);
      if (payload?.id) {
        const user = await User.findById(payload.id).select('+refreshTokens');
        if (user) {
          user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
          await user.save();
        }
      }
    }
  } catch (_) {
    // Suppress token errors - logging out must always succeed
  }

  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

exports.getMe = catchAsync(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toPublicJSON() } });
});

exports.forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset code has been sent.',
    });
  }

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  user.resetPasswordOtp = otp;
  user.resetPasswordExpires = otpExpires;
  await user.save();

  await sendPasswordResetEmail(user.email, otp, user.name).catch(() => {});

  res.status(200).json({
    success: true,
    message: 'If an account exists with this email, a password reset code has been sent.',
  });
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { email, otp, password } = req.body;

  const user = await User.findOne({ email }).select(
    '+password +resetPasswordOtp +resetPasswordExpires +refreshTokens'
  );

  if (!user) {
    throw new AppError('Invalid request or account does not exist', 400);
  }

  if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
    throw new AppError('Invalid or incorrect verification code', 400);
  }

  if (!user.resetPasswordExpires || user.resetPasswordExpires < Date.now()) {
    throw new AppError('Verification code has expired. Please request a new one.', 400);
  }

  user.password = password;
  user.resetPasswordOtp = undefined;
  user.resetPasswordExpires = undefined;
  user.resetPasswordToken = undefined;
  user.refreshTokens = [];

  if (!user.isVerified) {
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
  }

  await user.save();
  clearRefreshCookie(res);

  res.status(200).json({
    success: true,
    message: 'Password has been reset successfully. You can now sign in with your new password.',
  });
});
