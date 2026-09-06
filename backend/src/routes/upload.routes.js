const router = require('express').Router();
const ctrl = require('../controllers/upload.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.post('/', ctrl.uploadMiddleware, ctrl.uploadFile);
router.post('/avatar', ctrl.uploadMiddleware, ctrl.uploadAvatar);
router.delete('/', ctrl.deleteFile);

module.exports = router;
