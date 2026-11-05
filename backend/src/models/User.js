const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    avatar: { type: String, default: '' },
    avatarPublicId: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    canCreateProjects: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpLockedUntil: { type: Date, select: false },
    resetPasswordOtp: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    refreshTokens: [{ type: String, select: false }],
    bio: { type: String, maxlength: 200, default: '' },
    github: { type: String, default: '' },
    skills: [{ type: String }],
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpires;
  delete obj.resetPasswordOtp;
  delete obj.resetPasswordExpires;
  delete obj.resetPasswordToken;
  delete obj.refreshTokens;
  obj.canCreateProjects = !!(this.canCreateProjects || this.role === 'admin');
  return obj;
};

module.exports = mongoose.model('User', userSchema);
