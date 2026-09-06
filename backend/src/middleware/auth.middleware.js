const User = require('../models/User');
const { verifyAccessToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) throw new AppError('Authentication required', 401);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw new AppError(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token', 401);
  }

  const user = await User.findById(payload.id);
  if (!user) throw new AppError('User no longer exists', 401);

  req.user = user;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
};
