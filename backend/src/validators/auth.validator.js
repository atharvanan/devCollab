const Joi = require('joi');

exports.registerSchema = Joi.object({
  name: Joi.string().min(2).max(60).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

exports.loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

exports.otpSchema = Joi.object({
  userId: Joi.string().optional(),
  email: Joi.string().email().optional(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
}).or('userId', 'email');

exports.resendOTPSchema = Joi.object({
  userId: Joi.string().optional(),
  email: Joi.string().email().optional(),
}).or('userId', 'email');
