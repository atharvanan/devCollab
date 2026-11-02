const router = require('express').Router();
const ctrl = require('../controllers/project.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.route('/').get(ctrl.getProjects).post(ctrl.createProject);
router.route('/:id').get(ctrl.getProject).put(ctrl.updateProject).delete(ctrl.deleteProject);
router.post('/:id/invite', ctrl.inviteMember);
router.patch('/:id/members/:userId/role', ctrl.updateMemberRole);
router.delete('/:id/members/:userId', ctrl.removeMember);
router.get('/:id/security-audits', ctrl.getSecurityAudits);
router.patch('/:id/security-audits/:auditId/resolve', ctrl.resolveSecurityAudit);

module.exports = router;
