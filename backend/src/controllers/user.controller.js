const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.getProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id).select('-refreshTokens');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: { user: user.toPublicJSON() } });
});

exports.updateProfile = catchAsync(async (req, res) => {
  const allowed = ['name', 'bio', 'github', 'skills'];
  const updates = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ success: true, data: { user: user.toPublicJSON() } });
});

exports.updatePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters long', 400);
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new AppError('User not found', 404);

  if (currentPassword) {
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new AppError('Current password is incorrect', 400);
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
});

exports.searchUsers = catchAsync(async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ success: true, data: { users: [] } });
  const users = await User.find({
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ],
    isVerified: true,
  }).select('name email avatar').limit(10);
  res.json({ success: true, data: { users } });
});
