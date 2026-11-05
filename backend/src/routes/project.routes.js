const router = require('express').Router();
const ctrl = require('../controllers/project.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.route('/').get(ctrl.getProjects).post(ctrl.createProject);
router.get('/test/bot-credentials', ctrl.getBotCredentials);
router.route('/:id').get(ctrl.getProject).put(ctrl.updateProject).patch(ctrl.updateProject).delete(ctrl.deleteProject);
router.post('/:id/invite', ctrl.inviteMember);
router.post('/:id/seed-bots', ctrl.seedProjectBots);
router.post('/:id/transfer-ownership', ctrl.transferOwnership);
router.post('/:id/managers/:userId', ctrl.appointProjectManager);
router.delete('/:id/managers/:userId', ctrl.revokeProjectManager);
router.patch('/:id/lifecycle', ctrl.updateLifecycle);
router.get('/:id/governance', ctrl.getGovernanceSummary);
router.patch('/:id/members/:userId/role', ctrl.updateMemberRole);
router.delete('/:id/members/:userId', ctrl.removeMember);
router.get('/:id/security-audits', ctrl.getSecurityAudits);
router.patch('/:id/security-audits/:auditId/resolve', ctrl.resolveSecurityAudit);

module.exports = router;
