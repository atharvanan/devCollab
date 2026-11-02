const Project = require('../models/Project');
const User = require('../models/User');
const SecurityAudit = require('../models/SecurityAudit');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { ROLE_DISPLAY_NAMES } = require('../utils/roleCompliance');

exports.createProject = catchAsync(async (req, res) => {
  const { name, description, visibility, tags } = req.body;
  const project = await Project.create({
    name, description, visibility, tags,
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'project_manager' }],
  });
  res.status(201).json({ success: true, data: { project } });
});

exports.getProjects = catchAsync(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const query = {
    $or: [
      { owner: req.user._id },
      { 'members.user': req.user._id },
      { visibility: 'public' },
    ],
  };
  if (search) query.$text = { $search: search };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [projects, total] = await Promise.all([
    Project.find(query)
      .populate('owner', 'name email avatar')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Project.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: { projects, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } },
  });
});

exports.getProject = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar');
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isMember(req.user._id) && project.visibility !== 'public') {
    throw new AppError('Access denied', 403);
  }
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
  if (project.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Only the project owner can delete this project', 403);
  }
  await project.deleteOne();
  res.json({ success: true, message: 'Project deleted' });
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
