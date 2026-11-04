const Project = require('../models/Project');
const User = require('../models/User');
const Task = require('../models/Task');
const SecurityAudit = require('../models/SecurityAudit');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { ROLE_DISPLAY_NAMES } = require('../utils/roleCompliance');
const {
  TEST_BOTS,
  isTestBotEmail,
  ensureBotUser,
  autoSeedBotsToProject,
  ensureProjectAccess,
} = require('../utils/testBots');

exports.createProject = catchAsync(async (req, res) => {
  const { name, description, visibility, tags } = req.body;
  const project = await Project.create({
    name, description, visibility, tags,
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'project_manager' }],
  });

  // Automatically attach all test bot teammates so every role is ready to collaborate
  await autoSeedBotsToProject(project).catch(() => {});

  res.status(201).json({ success: true, data: { project } });
});

exports.getProjects = catchAsync(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const isBot = isTestBotEmail(req.user.email);

  // Find all projects where user has assigned tasks
  const assignedTaskProjectIds = await Task.distinct('project', { assignees: req.user._id }).catch(() => []);

  const query = isBot
    ? {} // Test bots can view all projects in workspace for multi-user collaboration testing
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

  const hasAccess = await ensureProjectAccess(project, req.user);
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
  const allowed = ['name', 'description', 'visibility', 'tags', 'status'];
  allowed.forEach((k) => { if (req.body[k] !== undefined) project[k] = req.body[k]; });
  await project.save();
  res.json({ success: true, data: { project } });
});

exports.deleteProject = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (project.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AppError('Only the project owner can delete this project', 403);
  }

  const projectId = project._id;
  const Task = require('../models/Task');
  const Review = require('../models/Review');
  const CollabSession = require('../models/CollabSession');

  const SecurityAudit = require('../models/SecurityAudit');
  const Notification = require('../models/Notification');

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
  } catch (_) {}

  res.json({ success: true, message: 'Project and all associated resources deleted successfully' });
});

exports.inviteMember = catchAsync(async (req, res) => {
  const { email, role = 'contributor' } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id)) {
    throw new AppError('Only the project owner or manager can invite members', 403);
  }
  const invitee = await User.findOne({ email });
  if (!invitee) throw new AppError('User not found with that email address', 404);
  if (project.isMember(invitee._id)) throw new AppError('User is already a member of this project', 400);

  project.members.push({ user: invitee._id, role });
  await project.save();
  await project.populate('members.user', 'name email avatar');

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
  } catch (_) {}

  res.json({ success: true, message: `Member added as ${ROLE_DISPLAY_NAMES[role] || role}`, data: { project } });
});

exports.updateMemberRole = catchAsync(async (req, res) => {
  const { role } = req.body;
  const { id: projectId, userId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id)) {
    throw new AppError('Only the project owner or manager can assign roles', 403);
  }

  // Prevent changing owner role to non-manager
  if (project.owner.toString() === userId && role !== 'project_manager' && role !== 'admin') {
    throw new AppError('Project owner must remain as Project Manager or Admin', 400);
  }

  const member = project.members.find((m) => m.user.toString() === userId);
  if (!member) throw new AppError('Member not found in project', 404);

  member.role = role;
  await project.save();
  await project.populate('members.user', 'name email avatar');

  res.json({
    success: true,
    message: `Role updated to ${ROLE_DISPLAY_NAMES[role] || role}`,
    data: { project },
  });
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
  project.members = project.members.filter(
    (m) => m.user.toString() !== req.params.userId
  );
  await project.save();
  await project.populate('members.user', 'name email avatar');
  res.json({ success: true, message: 'Member removed', data: { project } });
});

exports.getSecurityAudits = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id) && project.getUserRole(req.user._id) !== 'security_engineer') {
    throw new AppError('Access denied: Only Project Managers and Security Engineers can view compliance logs', 403);
  }

  const audits = await SecurityAudit.find({ project: project._id })
    .populate('user', 'name email avatar')
    .populate('resolvedBy', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ success: true, data: { audits } });
});

exports.resolveSecurityAudit = catchAsync(async (req, res) => {
  const { id: projectId, auditId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id)) {
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

exports.seedProjectBots = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isProjectManager(req.user._id)) {
    throw new AppError('Only the project owner or manager can add test bots', 403);
  }

  await autoSeedBotsToProject(project);
  await project.populate('members.user', 'name email avatar');

  res.json({
    success: true,
    message: 'Test bots successfully added to this project!',
    data: { project, bots: TEST_BOTS },
  });
});

exports.getBotCredentials = catchAsync(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Bot credentials endpoint is disabled in production environments', 403);
  }
  res.json({
    success: true,
    data: {
      bots: TEST_BOTS.map((b) => ({
        name: b.name,
        email: b.email,
        password: b.password,
        role: b.role,
      })),
    },
  });
});
