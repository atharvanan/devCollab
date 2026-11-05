const SecurityAudit = require('../models/SecurityAudit');
const logger = require('./logger');

/**
 * Centrally and immutably records a governance or security event.
 */
async function logGovernanceAudit({
  project,
  actor,
  targetUser = null,
  action,
  previousRole = null,
  newRole = null,
  targetResource = 'project',
  targetDomain = null,
  targetId = null,
  details,
  severity = 'medium',
  status = 'success',
  metadata = {},
}) {
  try {
    const actorId = actor?._id || actor;
    let actorRole = 'user';
    if (actor?.role === 'admin') {
      actorRole = 'admin';
    } else if (project && typeof project.getUserRole === 'function') {
      actorRole = project.getUserRole(actorId) || 'user';
    }

    const projectId = project?._id || project;
    const targetUserId = targetUser?._id || targetUser || null;

    const audit = await SecurityAudit.create({
      project: projectId,
      user: actorId,
      actor: actorId,
      targetUser: targetUserId,
      userRole: actorRole,
      attemptedAction: action,
      action,
      targetResource,
      targetDomain,
      targetId: targetId || projectId,
      previousRole,
      newRole,
      details,
      severity,
      status,
      metadata,
    });

    return audit;
  } catch (err) {
    logger.error('Failed to write governance audit log:', err);
    return null;
  }
}

module.exports = { logGovernanceAudit };
