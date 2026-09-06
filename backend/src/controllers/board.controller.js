const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { getIO } = require('../socket');

exports.getBoard = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isMember(req.user._id)) throw new AppError('Access denied', 403);

  const tasks = await Task.find({ project: projectId })
    .populate('assignees', 'name avatar')
    .populate('createdBy', 'name avatar')
    .sort({ order: 1 });

  const columns = ['backlog', 'todo', 'in_progress', 'review', 'done'];
  const board = columns.reduce((acc, col) => {
    acc[col] = tasks.filter((t) => t.column === col);
    return acc;
  }, {});

  res.json({ success: true, data: { board } });
});

exports.createTask = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isMember(req.user._id)) throw new AppError('Access denied', 403);

  const count = await Task.countDocuments({ project: projectId, column: req.body.column || 'backlog' });
  const task = await Task.create({
    ...req.body,
    project: projectId,
    createdBy: req.user._id,
    order: count,
  });
  await task.populate('assignees', 'name avatar');
  await task.populate('createdBy', 'name avatar');

  getIO().to(`project:${projectId}`).emit('task:created', task);

  // Notify assignees
  if (task.assignees?.length) {
    const notifications = task.assignees
      .filter((a) => a._id.toString() !== req.user._id.toString())
      .map((a) => ({
        recipient: a._id, sender: req.user._id,
        type: 'task_assigned',
        title: 'You have been assigned a task',
        message: `${req.user.name} assigned you to "${task.title}"`,
        link: `/projects/${projectId}/board`,
      }));
    if (notifications.length) {
      await Notification.insertMany(notifications);
      notifications.forEach((n) => {
        getIO().to(`user:${n.recipient}`).emit('notification:new', { type: 'task_assigned' });
      });
    }
  }

  res.status(201).json({ success: true, data: { task } });
});

exports.updateTask = catchAsync(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) throw new AppError('Task not found', 404);

  const allowed = ['title', 'description', 'column', 'priority', 'assignees', 'dueDate', 'labels', 'order'];
  allowed.forEach((k) => { if (req.body[k] !== undefined) task[k] = req.body[k]; });
  await task.save();
  await task.populate('assignees', 'name avatar');

  getIO().to(`project:${task.project}`).emit('task:updated', task);
  res.json({ success: true, data: { task } });
});

exports.moveTask = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const { column, order } = req.body;
  const task = await Task.findByIdAndUpdate(taskId, { column, order }, { new: true })
    .populate('assignees', 'name avatar');
  if (!task) throw new AppError('Task not found', 404);

  getIO().to(`project:${task.project}`).emit('task:moved', { taskId, column, order });
  res.json({ success: true, data: { task } });
});

exports.deleteTask = catchAsync(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) throw new AppError('Task not found', 404);
  const projectId = task.project;
  await task.deleteOne();
  getIO().to(`project:${projectId}`).emit('task:deleted', { taskId: req.params.taskId });
  res.json({ success: true, message: 'Task deleted' });
});
