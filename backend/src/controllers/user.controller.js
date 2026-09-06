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
