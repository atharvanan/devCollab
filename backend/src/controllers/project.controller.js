const Project = require('../models/Project');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.createProject = catchAsync(async (req, res) => {
  const { name, description, visibility, tags } = req.body;
  const project = await Project.create({
    name, description, visibility, tags,
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'admin' }],
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
  if (project.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Only the owner can update this project', 403);
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
    throw new AppError('Only the owner can delete this project', 403);
  }
  await project.deleteOne();
  res.json({ success: true, message: 'Project deleted' });
});

exports.inviteMember = catchAsync(async (req, res) => {
  const { email, role = 'contributor' } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (project.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Only the owner can invite members', 403);
  }
  const invitee = await User.findOne({ email });
  if (!invitee) throw new AppError('User not found', 404);
  if (project.isMember(invitee._id)) throw new AppError('User is already a member', 400);
  project.members.push({ user: invitee._id, role });
  await project.save();
  res.json({ success: true, message: 'Member invited successfully' });
});

exports.removeMember = catchAsync(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new AppError('Project not found', 404);
  if (project.owner.toString() !== req.user._id.toString()) {
    throw new AppError('Only the owner can remove members', 403);
  }
  project.members = project.members.filter(
    (m) => m.user.toString() !== req.params.userId
  );
  await project.save();
  res.json({ success: true, message: 'Member removed' });
});
