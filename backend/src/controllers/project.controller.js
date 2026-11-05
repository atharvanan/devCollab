const Project = require('../models/Project');
const User = require('../models/User');
const Task = require('../models/Task');
const SecurityAudit = require('../models/SecurityAudit');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { ROLE_DISPLAY_NAMES } = require('../utils/roleCompliance');
const { logGovernanceAudit } = require('../utils/auditLogger');

exports.createProject = catchAsync(async (req, res) => {
  // Anyone who creates a project is its Project Manager and manages it end to end with all rights
  const canCreate = req.user.role === 'admin' || req.user.canCreateProjects !== false;
  if (!canCreate) {
    await logGovernanceAudit({
      actor: req.user,
      action: 'PROJECT_CREATION_ATTEMPT',
      targetResource: 'project',
      details: `${req.user.name} (${req.user.email}) attempted to create project "${req.body?.name || 'Untitled'}" without project creation authorization.`,
      severity: 'medium',
      status: 'blocked',
    });
    throw new AppError(
      'Authorization Denied: You do not have permission to create projects. Only authorized Project Managers or Platform Administrators can create projects.',
      403
    );
  }

  const { name, description, visibility, tags } = req.body;
  if (!name || !name.trim()) {
    throw new AppError('Project name is required', 400);
  }

  // Creator automatically becomes the Project Owner and initial Project Manager
  const project = await Project.create({
    name: name.trim(),
    description: description || '',
    visibility: visibility || 'private',
    tags: Array.isArray(tags) ? tags : [],
    status: 'active',
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'project_manager', joinedAt: new Date() }],
  });

  // Record immutable governance audit log
  await logGovernanceAudit({
    project: project._id,
    actor: req.user,
    action: 'PROJECT_CREATED',
    targetResource: 'project',
    targetId: project._id,
    details: `${req.user.name} created project "${project.name}" as Project Owner.`,
    severity: 'low',
    status: 'success',
  });

  await project.populate('owner', 'name email avatar');
  await project.populate('members.user', 'name email avatar');

  res.status(201).json({ success: true, data: { project } });
});

exports.getProjects = catchAsync(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  // Find all projects where user has assigned tasks
  const assignedTaskProjectIds = await Task.distinct('project', { assignees: req.user._id }).catch(() => []);

  const query = req.user.role === 'admin'
    ? {}
    : {
        $or: [
          { owner: req.user._id },
          { 'members.user': req.user._id },
          { _id: { $in: assignedTaskProjectIds } },
          { visibility: 'public' },
        ],
      };
  if (search) query.$text = { $search: search };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;
  const [projects, total] = await Promise.all([
    Project.find(query)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Project.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      projects,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    },
  });
});

exports.getProject = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar');
  if (!project) throw new AppError('Project not found', 404);

  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) {
    throw new AppError('Access denied', 403);
  }

  // Refresh populated members in case auto-healing added the user
  await project.populate('members.user', 'name email avatar');

  res.json({ success: true, data: { project } });
});

exports.updateProject = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id)) {
    throw new AppError('Only the project owner or project manager can update this project', 403);
  }
  const allowed = ['name', 'description', 'visibility', 'tags'];
  allowed.forEach((k) => { if (req.body[k] !== undefined) project[k] = req.body[k]; });
  if (req.body.status !== undefined) {
    if (['active', 'on_hold', 'completed'].includes(req.body.status)) {
      project.status = req.body.status;
    } else if (req.body.status === 'archived') {
      if (project.isOwner(req.user._id) || req.user.role === 'admin') {
        project.status = 'archived';
      } else {
        throw new AppError('Only the Project Owner can archive a project', 403);
      }
    }
  }
  await project.save();
  await project.populate('owner', 'name email avatar');
  await project.populate('members.user', 'name email avatar');
  res.json({ success: true, data: { project } });
});

exports.deleteProject = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (project.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    await logGovernanceAudit({
      project: project._id,
      actor: req.user,
      action: 'PROJECT_DELETION_ATTEMPT',
      targetResource: 'project',
      details: `${req.user.name} attempted to delete project "${project.name}" without Project Owner authority.`,
      severity: 'critical',
      status: 'blocked',
    });
    throw new AppError('Only the project owner can delete this project', 403);
  }

  const projectId = project._id;
  const Review = require('../models/Review');
  const CollabSession = require('../models/CollabSession');
  const Notification = require('../models/Notification');

  await logGovernanceAudit({
    project: projectId,
    actor: req.user,
    action: 'PROJECT_DELETED',
    targetResource: 'project',
    targetId: projectId,
    details: `${req.user.name} deleted project "${project.name}".`,
    severity: 'critical',
    status: 'success',
  });

  await Promise.all([
    project.deleteOne(),
    Task.deleteMany({ project: projectId }).catch(() => {}),
    Review.deleteMany({ project: projectId }).catch(() => {}),
    CollabSession.deleteMany({ project: projectId }).catch(() => {}),
    // Regulatory compliance retention: Retain security audits with tombstone status
    SecurityAudit.updateMany(
      { project: projectId },
      { $set: { projectDeleted: true, projectDeletedAt: new Date() } }
    ).catch(() => {}),
    Notification.deleteMany({ 'data.projectId': projectId }).catch(() => {}),
  ]);

  try {
    const { getIO } = require('../socket');
    getIO().to(`project:${projectId}`).emit('project:deleted', { projectId });
  } catch (_) {
    // Non-blocking socket notification error
  }

  res.json({ success: true, message: 'Project and all associated resources deleted successfully' });
});

/**
 * Transfer project ownership to another active member.
 * Only the current Project Owner or Platform Administrator can perform this action.
 */
exports.transferOwnership = catchAsync(async (req, res) => {
  const { id: projectId } = req.params;
  const { newOwnerId, reason } = req.body;

  if (!newOwnerId) {
    throw new AppError('newOwnerId is required for ownership transfer', 400);
  }

  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  // Verification: Only current Project Owner or Platform Administrator
  const isOwner = project.isOwner(req.user._id) || req.user.role === 'admin';
  if (!isOwner) {
    await logGovernanceAudit({
      project: project._id,
      actor: req.user,
      targetUser: newOwnerId,
      action: 'OWNERSHIP_TRANSFER_ATTEMPT',
      targetResource: 'project_ownership',
      details: `${req.user.name} attempted to transfer project ownership of "${project.name}" without Project Owner authority.`,
      severity: 'critical',
      status: 'blocked',
    });
    throw new AppError('Authorization Denied: Only the Project Owner can transfer project ownership.', 403);
  }

  // Prevent transferring to self
  if (project.owner.toString() === newOwnerId.toString()) {
    throw new AppError('Target user is already the Project Owner of this project.', 400);
  }

  // Target must be an active project member
  const targetMember = project.members.find(
    (m) => (m.user?._id || m.user).toString() === newOwnerId.toString()
  );
  if (!targetMember) {
    throw new AppError('Cannot transfer ownership to a non-member. Target user must be an active project member.', 400);
  }

  const previousOwnerId = project.owner;
  const previousTargetRole = targetMember.role;

  // Transfer ownership
  project.owner = newOwnerId;
  targetMember.role = 'project_manager';

  // Ensure previous owner remains as a Project Manager in project.members
  const prevOwnerMember = project.members.find(
    (m) => (m.user?._id || m.user).toString() === previousOwnerId.toString()
  );
  if (prevOwnerMember) {
    prevOwnerMember.role = 'project_manager';
  } else {
    project.members.push({ user: previousOwnerId, role: 'project_manager', joinedAt: new Date() });
  }

  await project.save();
  await project.populate('owner', 'name email avatar');
  await project.populate('members.user', 'name email avatar');

  // Record immutable governance audit log
  await logGovernanceAudit({
    project: project._id,
    actor: req.user,
    targetUser: newOwnerId,
    action: 'OWNERSHIP_TRANSFERRED',
    previousRole: previousTargetRole,
    newRole: 'owner',
    targetResource: 'project_ownership',
    details: `${req.user.name} transferred project ownership of "${project.name}" to ${targetMember.user?.name || newOwnerId}. ${reason ? `Reason: ${reason}` : ''}`.trim(),
    severity: 'critical',
    status: 'success',
  });

  try {
    const { getIO } = require('../socket');
    getIO().to(`project:${projectId}`).emit('project:ownership_transferred', {
      projectId,
      newOwner: project.owner,
      transferredBy: req.user._id,
    });
  } catch (_) {
    // Non-blocking socket notification error
  }

  res.json({
    success: true,
    message: `Project ownership successfully transferred to ${project.owner.name}`,
    data: { project },
  });
});

/**
 * Appoint a project member as Project Manager.
 * STRICT: Only the Project Owner (or Platform Admin) can appoint Project Managers.
 */
exports.appointProjectManager = catchAsync(async (req, res) => {
  const { id: projectId, userId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  // Only Project Owner or Platform Admin can appoint Project Managers
  if (!project.isOwner(req.user._id) && req.user.role !== 'admin') {
    await logGovernanceAudit({
      project: project._id,
      actor: req.user,
      targetUser: userId,
      action: 'PM_APPOINTMENT_ATTEMPT',
      targetResource: 'project_management',
      details: `${req.user.name} attempted to appoint ${userId} as Project Manager without Project Owner authority.`,
      severity: 'high',
      status: 'blocked',
    });
    throw new AppError('Authorization Denied: Only the Project Owner can appoint Project Managers.', 403);
  }

  const member = project.members.find((m) => (m.user?._id || m.user).toString() === userId);
  if (!member) throw new AppError('Target user is not a member of this project', 404);

  if (member.role === 'project_manager') {
    throw new AppError('User is already a Project Manager of this project.', 400);
  }

  const previousRole = member.role;
  member.role = 'project_manager';
  await project.save();
  await project.populate('owner', 'name email avatar');
  await project.populate('members.user', 'name email avatar');

  await logGovernanceAudit({
    project: project._id,
    actor: req.user,
    targetUser: userId,
    action: 'PM_APPOINTED',
    previousRole,
    newRole: 'project_manager',
    targetResource: 'project_management',
    details: `${req.user.name} appointed ${member.user?.name || userId} as Project Manager.`,
    severity: 'high',
    status: 'success',
  });

  res.json({
    success: true,
    message: `Member appointed as Project Manager`,
    data: { project },
  });
});

/**
 * Revoke Project Manager authority from a member.
 * STRICT: Only the Project Owner (or Platform Admin) can revoke PM status.
 */
exports.revokeProjectManager = catchAsync(async (req, res) => {
  const { id: projectId, userId } = req.params;
  const newRole = req.body?.newRole || 'contributor';

  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  // Only Project Owner or Platform Admin can revoke Project Managers
  if (!project.isOwner(req.user._id) && req.user.role !== 'admin') {
    await logGovernanceAudit({
      project: project._id,
      actor: req.user,
      targetUser: userId,
      action: 'PM_REVOCATION_ATTEMPT',
      targetResource: 'project_management',
      details: `${req.user.name} attempted to revoke Project Manager privileges from ${userId} without Project Owner authority.`,
      severity: 'high',
      status: 'blocked',
    });
    throw new AppError('Authorization Denied: Only the Project Owner can revoke Project Manager privileges.', 403);
  }

  if (project.isOwner(userId)) {
    throw new AppError('Cannot revoke Project Manager status from the Project Owner. Transfer ownership first.', 400);
  }

  const member = project.members.find((m) => (m.user?._id || m.user).toString() === userId.toString());
  if (!member) throw new AppError('Member not found in project', 404);

  if (member.role !== 'project_manager') {
    throw new AppError(`Member is not currently a Project Manager (current role: ${member.role})`, 400);
  }

  member.role = newRole;
  await project.save();
  await project.populate('owner', 'name email avatar');
  await project.populate('members.user', 'name email avatar');

  await logGovernanceAudit({
    project: project._id,
    actor: req.user,
    targetUser: userId,
    action: 'PM_REVOKED',
    previousRole: 'project_manager',
    newRole,
    targetResource: 'project_management',
    details: `${req.user.name} revoked Project Manager role from ${member.user?.name || userId} (new role: ${newRole}).`,
    severity: 'high',
    status: 'success',
  });

  res.json({
    success: true,
    message: `Project Manager authority revoked (member set to ${ROLE_DISPLAY_NAMES[newRole] || newRole})`,
    data: { project },
  });
});

/**
 * Update member engineering role with strict privilege escalation prevention.
 */
exports.updateMemberRole = catchAsync(async (req, res) => {
  const { role } = req.body;
  const { id: projectId, userId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  if (!project.isProjectManager(req.user._id)) {
    throw new AppError('Only the project owner or manager can assign roles', 403);
  }

  // Prevent changing owner role
  if (project.owner.toString() === userId) {
    throw new AppError('Project owner cannot be demoted. Transfer project ownership first.', 400);
  }

  const member = project.members.find((m) => (m.user?._id || m.user).toString() === userId);
  if (!member) throw new AppError('Member not found in project', 404);

  // Privilege Guard 1: Only Project Owner can assign or promote someone to Project Manager
  if (role === 'project_manager' && !project.isOwner(req.user._id) && req.user.role !== 'admin') {
    await logGovernanceAudit({
      project: project._id,
      actor: req.user,
      targetUser: userId,
      action: 'ROLE_ELEVATION_ATTEMPT',
      targetResource: 'membership',
      details: `${req.user.name} attempted to elevate ${member.user?.name || userId} to Project Manager without Project Owner authority.`,
      severity: 'high',
      status: 'blocked',
    });
    throw new AppError('Authorization Denied: Only the Project Owner can appoint Project Managers.', 403);
  }

  // Privilege Guard 2: Only Project Owner can demote an existing Project Manager
  if (member.role === 'project_manager' && role !== 'project_manager' && !project.isOwner(req.user._id) && req.user.role !== 'admin') {
    await logGovernanceAudit({
      project: project._id,
      actor: req.user,
      targetUser: userId,
      action: 'PM_DEMOTION_ATTEMPT',
      targetResource: 'membership',
      details: `${req.user.name} attempted to demote Project Manager ${member.user?.name || userId} without Project Owner authority.`,
      severity: 'high',
      status: 'blocked',
    });
    throw new AppError('Authorization Denied: Only the Project Owner can demote a Project Manager.', 403);
  }

  const previousRole = member.role;
  member.role = role;
  await project.save();
  await project.populate('owner', 'name email avatar');
  await project.populate('members.user', 'name email avatar');

  await logGovernanceAudit({
    project: project._id,
    actor: req.user,
    targetUser: userId,
    action: 'MEMBER_ROLE_CHANGED',
    previousRole,
    newRole: role,
    targetResource: 'membership',
    details: `${req.user.name} changed role of ${member.user?.name || userId} from ${previousRole} to ${role}.`,
    severity: 'medium',
    status: 'success',
  });

  res.json({
    success: true,
    message: `Role updated to ${ROLE_DISPLAY_NAMES[role] || role}`,
    data: { project },
  });
});

exports.inviteMember = catchAsync(async (req, res) => {
  const { email, role = 'contributor' } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id)) {
    throw new AppError('Only the project owner or manager can invite members', 403);
  }

  // Privilege Guard: Only Project Owner can invite directly with Project Manager role
  if (role === 'project_manager' && !project.isOwner(req.user._id) && req.user.role !== 'admin') {
    throw new AppError('Authorization Denied: Only the Project Owner can invite members with the Project Manager role.', 403);
  }

  const invitee = await User.findOne({ email });
  if (!invitee) throw new AppError('User not found with that email address', 404);
  if (project.isMember(invitee._id)) throw new AppError('User is already a member of this project', 400);

  project.members.push({ user: invitee._id, role, joinedAt: new Date() });
  await project.save();
  await project.populate('owner', 'name email avatar');
  await project.populate('members.user', 'name email avatar');

  await logGovernanceAudit({
    project: project._id,
    actor: req.user,
    targetUser: invitee._id,
    action: 'MEMBER_INVITED',
    newRole: role,
    targetResource: 'membership',
    details: `${req.user.name} invited ${invitee.name} (${email}) as ${ROLE_DISPLAY_NAMES[role] || role}.`,
    severity: 'low',
    status: 'success',
  });

  try {
    const Notification = require('../models/Notification');
    const { getIO } = require('../socket');
    await Notification.create({
      recipient: invitee._id,
      sender: req.user._id,
      type: 'project_invitation',
      title: 'Added to Project',
      message: `${req.user.name} added you to project "${project.name}" as ${ROLE_DISPLAY_NAMES[role] || role}.`,
      link: `/projects/${project._id}`,
      data: { projectId: project._id },
    });
    getIO().to(`user:${invitee._id}`).emit('notification:new', { type: 'project_invitation' });
  } catch (_) {
    // Non-blocking socket notification error
  }

  res.json({ success: true, message: `Member added as ${ROLE_DISPLAY_NAMES[role] || role}`, data: { project } });
});

exports.removeMember = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id)) {
    throw new AppError('Only the project owner or manager can remove members', 403);
  }
  if (project.owner.toString() === req.params.userId) {
    throw new AppError('Cannot remove project owner', 400);
  }

  const targetMember = project.members.find(
    (m) => (m.user?._id || m.user).toString() === req.params.userId
  );
  if (!targetMember) throw new AppError('Member not found in project', 404);

  // Privilege Guard: Non-owner PM cannot remove another PM
  if (targetMember.role === 'project_manager' && !project.isOwner(req.user._id) && req.user.role !== 'admin') {
    throw new AppError('Authorization Denied: Only the Project Owner can remove a Project Manager from the project.', 403);
  }

  const previousRole = targetMember.role;
  project.members = project.members.filter(
    (m) => (m.user?._id || m.user).toString() !== req.params.userId
  );
  await project.save();
  await project.populate('owner', 'name email avatar');
  await project.populate('members.user', 'name email avatar');

  await logGovernanceAudit({
    project: project._id,
    actor: req.user,
    targetUser: req.params.userId,
    action: 'MEMBER_REMOVED',
    previousRole,
    targetResource: 'membership',
    details: `${req.user.name} removed member ${req.params.userId} from project.`,
    severity: 'medium',
    status: 'success',
  });

  res.json({ success: true, message: 'Member removed', data: { project } });
});

/**
 * Manage project lifecycle status: active, on_hold, completed, archived.
 */
exports.updateLifecycle = catchAsync(async (req, res) => {
  const { id: projectId } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['active', 'on_hold', 'completed', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid project lifecycle status. Must be active, on_hold, completed, or archived.', 400);
  }

  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  if (!project.isProjectManager(req.user._id)) {
    await logGovernanceAudit({
      project: project._id,
      actor: req.user,
      action: 'PROJECT_STATUS_CHANGE_ATTEMPT',
      targetResource: 'lifecycle',
      details: `${req.user.name} attempted to change lifecycle status of "${project.name}" without Project Manager or Owner authority.`,
      severity: 'high',
      status: 'blocked',
      metadata: { attemptedStatus: status },
    });
    throw new AppError('Only Project Managers or the Project Owner can change project lifecycle status', 403);
  }

  // Explicit Archiving Policy:
  // Project Managers may hold, resume and complete projects.
  // Archiving strictly requires Project Owner or Platform Administrator authority.
  if (status === 'archived') {
    const isOwner = project.isOwner(req.user._id) || req.user.role === 'admin';
    if (!isOwner) {
      await logGovernanceAudit({
        project: project._id,
        actor: req.user,
        action: 'PROJECT_ARCHIVE_ATTEMPT',
        targetResource: 'lifecycle',
        details: `${req.user.name} (Project Manager) attempted to archive project "${project.name}". Archiving strictly requires Project Owner or Platform Administrator authority.`,
        severity: 'high',
        status: 'blocked',
        metadata: { attemptedStatus: status },
      });
      throw new AppError('Authorization Denied: Only the Project Owner or Platform Administrator can archive a project.', 403);
    }
  }

  const previousStatus = project.status || 'active';
  project.status = status;
  await project.save();
  await project.populate('owner', 'name email avatar');
  await project.populate('members.user', 'name email avatar');

  await logGovernanceAudit({
    project: project._id,
    actor: req.user,
    action: 'PROJECT_STATUS_CHANGED',
    targetResource: 'lifecycle',
    details: `${req.user.name} transitioned project status from ${previousStatus} to ${status}. ${reason ? `Reason: ${reason}` : ''}`.trim(),
    severity: status === 'archived' ? 'high' : 'medium',
    status: 'success',
    metadata: { previousStatus, newStatus: status, reason },
  });

  res.json({
    success: true,
    message: `Project lifecycle updated to ${status.replace('_', ' ')}`,
    data: { project },
  });
});

/**
 * Returns comprehensive governance summary for the project.
 */
exports.getGovernanceSummary = catchAsync(async (req, res) => {
  const { id: projectId } = req.params;
  const project = await Project.findById(projectId)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar');
  if (!project) throw new AppError('Project not found', 404);

  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const isOwner = project.isOwner(req.user._id) || req.user.role === 'admin';
  const isPM = project.isProjectManager(req.user._id);
  const userRole = project.getUserRole(req.user._id);

  // Group managers
  const projectManagers = project.getProjectManagers();

  // Role breakdown count
  const roleBreakdown = {};
  project.members.forEach((m) => {
    roleBreakdown[m.role] = (roleBreakdown[m.role] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      projectId: project._id,
      name: project.name,
      status: project.status,
      owner: project.owner,
      projectManagers,
      membersCount: project.members.length,
      roleBreakdown,
      currentUserPermissions: {
        isOwner,
        isPM,
        role: userRole,
        canTransferOwnership: isOwner,
        canAppointPM: isOwner,
        canRevokePM: isOwner,
        canChangeLifecycle: isPM,
        canManageMembers: isPM,
        canDeleteProject: isOwner,
      },
    },
  });
});

exports.getSecurityAudits = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id) && project.getUserRole(req.user._id) !== 'security_engineer' && req.user.role !== 'admin') {
    throw new AppError('Access denied: Only Project Managers, Security Engineers, and Platform Admins can view compliance logs', 403);
  }

  const audits = await SecurityAudit.find({ project: project._id })
    .populate('user', 'name email avatar')
    .populate('actor', 'name email avatar')
    .populate('targetUser', 'name email avatar')
    .populate('resolvedBy', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ success: true, data: { audits } });
});

exports.resolveSecurityAudit = catchAsync(async (req, res) => {
  const { id: projectId, auditId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id) && req.user.role !== 'admin') {
    throw new AppError('Only Project Managers can acknowledge security violations', 403);
  }

  const audit = await SecurityAudit.findOne({ _id: auditId, project: projectId });
  if (!audit) throw new AppError('Audit record not found', 404);

  audit.resolved = true;
  audit.resolvedBy = req.user._id;
  audit.resolvedAt = new Date();
  await audit.save();
  await audit.populate('resolvedBy', 'name email');

  res.json({ success: true, message: 'Security violation marked as resolved', data: { audit } });
});
