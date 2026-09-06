const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('File type not allowed', 400), false);
  },
});

const uploadToCloudinary = (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `devcollab/${folder}`, ...options },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

exports.uploadMiddleware = upload.single('file');

exports.uploadFile = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('No file provided', 400);

  const { type = 'attachment' } = req.body;
  const isImage = req.file.mimetype.startsWith('image/');

  const result = await uploadToCloudinary(req.file.buffer, type, {
    resource_type: isImage ? 'image' : 'raw',
    ...(isImage && { transformation: [{ quality: 'auto', fetch_format: 'auto' }] }),
  });

  res.status(201).json({
    success: true,
    data: {
      url: result.secure_url,
      publicId: result.public_id,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    },
  });
});

exports.deleteFile = catchAsync(async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) throw new AppError('Public ID required', 400);
  await cloudinary.uploader.destroy(publicId);
  res.json({ success: true, message: 'File deleted' });
});

exports.uploadAvatar = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('No file provided', 400);

  const result = await uploadToCloudinary(req.file.buffer, 'avatars', {
    transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face', quality: 'auto' }],
  });

  const User = require('../models/User');
  if (req.user.avatarPublicId) {
    await cloudinary.uploader.destroy(req.user.avatarPublicId).catch(() => {});
  }

  await User.findByIdAndUpdate(req.user._id, {
    avatar: result.secure_url,
    avatarPublicId: result.public_id,
  });

  res.json({ success: true, data: { avatar: result.secure_url } });
});
