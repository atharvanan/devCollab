const router = require('express').Router();
const ctrl = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.route('/').post(ctrl.createReview).get(ctrl.getReviews);
router.route('/:id').get(ctrl.getReview).put(ctrl.updateReview);
router.post('/:id/comments/inline', ctrl.addInlineComment);
router.patch('/:id/comments/inline/:commentId/resolve', ctrl.resolveComment);
router.post('/:id/comments/general', ctrl.addGeneralComment);
router.patch('/:id/status', ctrl.updateStatus);

module.exports = router;
