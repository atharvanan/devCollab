const SecurityAudit = require('../models/SecurityAudit');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');

const ROLE_DISPLAY_NAMES = {
  project_manager: 'Project Manager',
  frontend_developer: 'Frontend Developer',
  backend_developer: 'Backend Developer',
  db_developer: 'Database Developer',
  devops: 'DevOps Engineer',
  cloud_admin: 'Cloud Admin',
  qa_tester: 'QA Tester',
  ui_ux_designer: 'UI/UX Designer',
  security_engineer: 'Security Engineer',
  admin: 'Admin',
  contributor: 'Contributor',
  viewer: 'Viewer',
};

const ROLE_DOMAINS = {
  project_manager: ['*'],
  admin: ['*'],
  frontend_developer: ['frontend'],
  ui_ux_designer: ['frontend'],
  backend_developer: ['backend'],
  db_developer: ['database'],
  devops: ['devops_cloud'],
  cloud_admin: ['devops_cloud'],
  qa_tester: ['qa'],
  security_engineer: ['security', 'devops_cloud'],
  contributor: ['general', 'frontend', 'backend', 'database', 'devops_cloud', 'qa', 'security'],
  viewer: [],
};

function canRoleAccessDomain(role, domain) {
  if (!role) return false;
  const allowed = ROLE_DOMAINS[role] || [];
  if (allowed.includes('*')) return true;
  if (!domain || domain === 'general') return role !== 'viewer';
  return allowed.includes(domain);
}

async function recordSecurityViolation({
  req,
  project,
  attemptedAction,
  targetResource,
  targetDomain,
  targetId,
  details,
  severity = 'high',
}) {
  const user = req.user;
  const userRole = project.getUserRole(user._id) || 'unknown';
  const roleName = ROLE_DISPLAY_NAMES[userRole] || userRole;

  // 1. Create audit log
  const audit = await SecurityAudit.create({
    project: project._id,
    user: user._id,
    userRole,
    attemptedAction,
    targetResource,
    targetDomain,
    targetId,
    details: details || `User ${user.name} (${roleName}) attempted unauthorized action: ${attemptedAction}`,
    severity,
  });

  // 2. Identify managers to notify (Owner + Project Managers)
  const recipientIds = new Set();
  recipientIds.add(project.owner.toString());

  if (Array.isArray(project.members)) {
    project.members.forEach((m) => {
      const memberRole = m.role;
      const memberId = (m.user?._id || m.user).toString();
      if ((memberRole === 'project_manager' || memberRole === 'admin') && memberId !== user._id.toString()) {
        recipientIds.add(memberId);
      }
    });
  }

  // Do not notify the violator themselves if they happen to be owner
  recipientIds.delete(user._id.toString());

  const notifications = Array.from(recipientIds).map((recipientId) => ({
    recipient: recipientId,
    sender: user._id,
    type: 'security_violation',
    title: `⚠️ Security Violation: Unauthorized Access Attempted`,
    message: `${user.name} (${roleName}) was blocked from modifying ${targetDomain || targetResource} code. This violation has been recorded.`,
    link: `/projects/${project._id}?tab=compliance`,
    data: {
      auditId: audit._id,
      projectId: project._id,
      violatorName: user.name,
      violatorRole: roleName,
      targetResource,
      targetDomain,
    },
  }));

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
    try {
      const io = getIO();
      notifications.forEach((n) => {
        io.to(`user:${n.recipient}`).emit('notification:new', {
          type: 'security_violation',
          title: n.title,
          message: n.message,
        });
      });
      io.to(`project:${project._id}`).emit('security:alert', {
        audit,
        message: `${user.name} (${roleName}) attempted an unauthorized change.`,
      });
    } catch (e) {
      // socket error silent fallback
    }
  }

  return audit;
}

module.exports = {
  ROLE_DISPLAY_NAMES,
  ROLE_DOMAINS,
  canRoleAccessDomain,
  recordSecurityViolation,
};
