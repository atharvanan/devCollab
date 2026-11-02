const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/search', ctrl.searchUsers);
router.get('/:id', ctrl.getProfile);
router.patch('/profile', ctrl.updateProfile);
router.patch('/password', ctrl.updatePassword);

module.exports = router;
