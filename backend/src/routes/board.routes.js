const router = require('express').Router();
const ctrl = require('../controllers/board.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/:projectId', ctrl.getBoard);
router.post('/:projectId/tasks', ctrl.createTask);
router.put('/tasks/:taskId', ctrl.updateTask);
router.patch('/tasks/:taskId/complete', ctrl.toggleTaskComplete);
router.patch('/tasks/:taskId/manager-review', ctrl.reviewTask);
router.patch('/tasks/:taskId/move', ctrl.moveTask);
router.delete('/tasks/:taskId', ctrl.deleteTask);

module.exports = router;
