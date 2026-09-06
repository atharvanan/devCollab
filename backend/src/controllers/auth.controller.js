const crypto = require('crypto');
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/jwt');
const { sendOTPEmail } = require('../services/email.service');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

exports.register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw new AppError('Email already registered', 400);

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  const user = await User.create({ name, email, password, otp, otpExpires });

  await sendOTPEmail(email, otp, name).catch(() => {});

  res.status(201).json({
    success: true,
    message: 'Registration successful. Check your email for the OTP.',
    data: { userId: user._id },
  });
});

exports.verifyOTP = catchAsync(async (req, res) => {
  const { userId, otp } = req.body;

  const user = await User.findById(userId).select('+otp +otpExpires');
  if (!user) throw new AppError('User not found', 404);
  if (user.isVerified) throw new AppError('Account already verified', 400);
  if (!user.otp || user.otp !== otp) throw new AppError('Invalid OTP', 400);
  if (user.otpExpires < Date.now()) throw new AppError('OTP expired. Request a new one.', 400);

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshTokens = [refreshToken];
  await user.save();

  setRefreshCookie(res, refreshToken);
  res.json({ success: true, data: { accessToken, user: user.toPublicJSON() } });
});

exports.resendOTP = catchAsync(async (req, res) => {
  const { userId } = req.body;
  const user = await User.findById(userId).select('+otp +otpExpires');
  if (!user) throw new AppError('User not found', 404);
  if (user.isVerified) throw new AppError('Already verified', 400);

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendOTPEmail(user.email, otp, user.name).catch(() => {});
  res.json({ success: true, message: 'OTP resent to your email.' });
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.isVerified) {
    throw new AppError('Please verify your email before logging in.', 403);
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Keep max 5 refresh tokens (multi-device)
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  user.lastSeen = new Date();
  await user.save();

  setRefreshCookie(res, refreshToken);
  res.json({ success: true, data: { accessToken, user: user.toPublicJSON() } });
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
  const token = req.cookies.refreshToken;

  if (token && req.user) {
    const user = await User.findById(req.user._id).select('+refreshTokens');
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
      await user.save();
    }
  }

  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

exports.getMe = catchAsync(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toPublicJSON() } });
});
