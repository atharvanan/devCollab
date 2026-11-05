const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/me/permissions', ctrl.getMyPermissions);
router.get('/search', ctrl.searchUsers);
router.delete('/account', ctrl.deleteAccount);
router.patch('/:userId/project-creation-permission', ctrl.setProjectCreationPermission);
router.get('/:id', ctrl.getProfile);
router.patch('/profile', ctrl.updateProfile);
router.patch('/password', ctrl.updatePassword);

module.exports = router;
