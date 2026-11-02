const router = require('express').Router();
const collabController = require('../controllers/collab.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

// Project-level collab sessions
router.get('/project/:projectId', collabController.getProjectSessions);
router.post('/project/:projectId', collabController.createSession);

// Individual session operations
router.get('/:sessionId', collabController.getSession);
router.put('/:sessionId/code', collabController.updateSessionCode);
router.post('/:sessionId/export-review', collabController.exportToReview);
router.delete('/:sessionId', collabController.deleteSession);

module.exports = router;

