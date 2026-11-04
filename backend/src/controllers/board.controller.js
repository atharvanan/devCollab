const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { getIO } = require('../socket');
const {
  TEST_BOTS,
  isTestBotEmail,
  ensureBotUser,
  ensureProjectAccess,
} = require('../utils/testBots');

exports.getBoard = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  const hasAccess = await ensureProjectAccess(project, req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const tasks = await Task.find({ project: projectId })
    .populate('assignees', 'name avatar email')
    .populate('createdBy', 'name avatar')
    .populate('managerReview.reviewedBy', 'name avatar')
    .populate('activityNotes.author', 'name avatar')
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

  const hasAccess = await ensureProjectAccess(project, req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  let assignees = Array.isArray(req.body.assignees) ? [...req.body.assignees] : [];

  // If assignees list is empty but targetRole is specified, auto-assign the matching role's bot/engineer
  if (assignees.length === 0 && req.body.targetRole && req.body.targetRole !== 'any') {
    const bot = TEST_BOTS.find((b) => b.role === req.body.targetRole);
    if (bot) {
      const botUser = await ensureBotUser(bot);
      assignees.push(botUser._id);
    }
  }

  // Ensure all assignees are members of this project
  let projectModified = false;
  for (const assigneeId of assignees) {
    const isMem = project.members.some(
      (m) => (m.user?._id || m.user)?.toString() === assigneeId.toString()
    );
    if (!isMem) {
      const userObj = await User.findById(assigneeId);
      const role = (req.body.targetRole && req.body.targetRole !== 'any')
        ? req.body.targetRole
        : (userObj?.role || 'contributor');
      project.members.push({ user: assigneeId, role });
      projectModified = true;
    }
  }
  if (projectModified) {
    await project.save();
  }

  const count = await Task.countDocuments({ project: projectId, column: req.body.column || 'backlog' });
  const task = await Task.create({
    ...req.body,
    assignees,
    project: projectId,
    createdBy: req.user._id,
    order: count,
    activityNotes: [
      {
        author: req.user._id,
        authorName: req.user.name,
        role: project.getUserRole(req.user._id) || 'project_manager',
        action: 'created',
        message: `Task created and assigned: "${req.body.title}"`,
      },
    ],
  });
  await task.populate('assignees', 'name avatar email');
  await task.populate('createdBy', 'name avatar');
  await task.populate('activityNotes.author', 'name avatar');

  getIO().to(`project:${projectId}`).emit('task:created', task);

  // Notify assignees
  if (task.assignees?.length) {
    const notifications = task.assignees
      .filter((a) => a._id.toString() !== req.user._id.toString())
      .map((a) => ({
        recipient: a._id, sender: req.user._id,
        type: 'task_assigned',
        title: 'New task assigned to you',
        message: `${req.user.name} assigned you to "${task.title}"`,
        link: `/projects/${projectId}?tab=board`,
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

  // If assignees are updated, ensure they are members of this project
  if (Array.isArray(req.body.assignees) && req.body.assignees.length > 0) {
    const project = await Project.findById(task.project);
    if (project) {
      let modified = false;
      for (const assigneeId of req.body.assignees) {
        const isMem = project.members.some(
          (m) => (m.user?._id || m.user)?.toString() === assigneeId.toString()
        );
        if (!isMem) {
          const userObj = await User.findById(assigneeId);
          project.members.push({ user: assigneeId, role: userObj?.role || 'contributor' });
          modified = true;
        }
      }
      if (modified) await project.save();
    }
  }

  const allowed = ['title', 'description', 'column', 'priority', 'targetRole', 'assignees', 'dueDate', 'labels', 'order', 'resolutionNotes'];
  allowed.forEach((k) => { if (req.body[k] !== undefined) task[k] = req.body[k]; });
  await task.save();
  await task.populate('assignees', 'name avatar email');
  await task.populate('createdBy', 'name avatar');
  await task.populate('managerReview.reviewedBy', 'name avatar');
  await task.populate('activityNotes.author', 'name avatar');

  getIO().to(`project:${task.project}`).emit('task:updated', task);
  res.json({ success: true, data: { task } });
});

exports.toggleTaskComplete = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found', 404);

  const project = await Project.findById(task.project);
  if (!project) throw new AppError('Project not found', 404);
  const hasAccess = await ensureProjectAccess(project, req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const isAssignee = task.assignees.some((a) => a.toString() === req.user._id.toString());
  const isPM = project.isProjectManager(req.user._id);

  if (!isAssignee && !isPM) {
    throw new AppError('Only the assigned developer or Project Manager can toggle completion', 403);
  }

  const newCompletedState = !task.completedByAssignee;
  task.completedByAssignee = newCompletedState;
  task.completedAt = newCompletedState ? new Date() : null;

  if (newCompletedState) {
    task.column = 'review';
    task.managerReview = { status: 'pending', feedback: '', reviewedBy: null, reviewedAt: null };
  } else {
    task.column = 'in_progress';
  }

  await task.save();
  await task.populate('assignees', 'name avatar email');
  await task.populate('createdBy', 'name avatar');
  await task.populate('managerReview.reviewedBy', 'name avatar');

  getIO().to(`project:${task.project}`).emit('task:updated', task);

  // Notify Project Manager when marked complete
  if (newCompletedState) {
    const pmRecipients = new Set();
    pmRecipients.add(project.owner.toString());
    project.members.forEach((m) => {
      if ((m.role === 'project_manager' || m.role === 'admin') && m.user.toString() !== req.user._id.toString()) {
        pmRecipients.add((m.user?._id || m.user).toString());
      }
    });
    pmRecipients.delete(req.user._id.toString());

    const notifications = Array.from(pmRecipients).map((pmId) => ({
      recipient: pmId,
      sender: req.user._id,
      type: 'task_completed',
      title: 'Task marked as done — Ready for review',
      message: `${req.user.name} marked "${task.title}" as completed. Please review their work.`,
      link: `/projects/${project._id}?tab=board`,
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      notifications.forEach((n) => {
        getIO().to(`user:${n.recipient}`).emit('notification:new', { type: 'task_completed' });
      });
    }
  }

  res.json({ success: true, message: newCompletedState ? 'Task marked complete and submitted for review' : 'Task marked as in-progress', data: { task } });
});

exports.submitTaskResolution = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const { notes = '', column = 'review' } = req.body;
  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found', 404);

  const project = await Project.findById(task.project);
  if (!project) throw new AppError('Project not found', 404);
  const hasAccess = await ensureProjectAccess(project, req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const isAssignee = task.assignees.some((a) => a.toString() === req.user._id.toString());
  const isPM = project.isProjectManager(req.user._id);

  if (!isAssignee && !isPM) {
    throw new AppError('Only the assigned developer or Project Manager can submit resolution notes', 403);
  }

  task.completedByAssignee = true;
  task.completedAt = new Date();
  task.column = column;
  task.resolutionNotes = notes.trim();
  task.managerReview = { status: 'pending', feedback: '', reviewedBy: null, reviewedAt: null };

  task.activityNotes = task.activityNotes || [];
  task.activityNotes.push({
    author: req.user._id,
    authorName: req.user.name,
    role: project.getUserRole(req.user._id) || 'contributor',
    action: 'submitted',
    message: notes.trim() || 'Work marked as done and submitted for Project Manager sign-off.',
    createdAt: new Date(),
  });

  await task.save();
  await task.populate('assignees', 'name avatar email');
  await task.populate('createdBy', 'name avatar');
  await task.populate('managerReview.reviewedBy', 'name avatar');
  await task.populate('activityNotes.author', 'name avatar');

  getIO().to(`project:${task.project}`).emit('task:updated', task);

  // Notify Project Manager
  const pmRecipients = new Set();
  pmRecipients.add(project.owner.toString());
  project.members.forEach((m) => {
    if ((m.role === 'project_manager' || m.role === 'admin') && m.user.toString() !== req.user._id.toString()) {
      pmRecipients.add((m.user?._id || m.user).toString());
    }
  });
  pmRecipients.delete(req.user._id.toString());

  const notifications = Array.from(pmRecipients).map((pmId) => ({
    recipient: pmId,
    sender: req.user._id,
    type: 'task_completed',
    title: 'Ticket submitted for review',
    message: `${req.user.name} submitted "${task.title}" with resolution feedback notes.`,
    link: `/projects/${project._id}?tab=board`,
  }));

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
    notifications.forEach((n) => {
      getIO().to(`user:${n.recipient}`).emit('notification:new', { type: 'task_completed' });
    });
  }

  res.json({
    success: true,
    message: 'Ticket resolution feedback submitted to Project Manager',
    data: { task },
  });
});

exports.reviewTask = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const { status, feedback = '', routeToColumn } = req.body; // status: 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(status)) {
    throw new AppError('Review status must be approved or rejected', 400);
  }

  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found', 404);

  const project = await Project.findById(task.project);
  if (!project) throw new AppError('Project not found', 404);

  if (!project.isProjectManager(req.user._id)) {
    throw new AppError('Only the Project Manager or owner can review and sign off on tasks', 403);
  }

  task.managerReview = {
    status,
    feedback: feedback.trim(),
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
  };

  if (status === 'approved') {
    task.column = 'done';
  } else {
    task.column = routeToColumn || 'in_progress';
    task.completedByAssignee = false;
  }

  task.activityNotes = task.activityNotes || [];
  task.activityNotes.push({
    author: req.user._id,
    authorName: req.user.name,
    role: 'project_manager',
    action: status === 'approved' ? 'approved' : 'changes_requested',
    message: feedback.trim() || (status === 'approved' ? 'Approved and closed by Project Manager.' : 'Changes requested by Project Manager.'),
    createdAt: new Date(),
  });

  await task.save();
  await task.populate('assignees', 'name avatar email');
  await task.populate('createdBy', 'name avatar');
  await task.populate('managerReview.reviewedBy', 'name avatar');
  await task.populate('activityNotes.author', 'name avatar');

  getIO().to(`project:${task.project}`).emit('task:updated', task);

  // Notify assignees about PM decision
  if (task.assignees?.length) {
    const notifications = task.assignees
      .filter((a) => a._id.toString() !== req.user._id.toString())
      .map((a) => ({
        recipient: a._id,
        sender: req.user._id,
        type: status === 'approved' ? 'task_approved' : 'task_rejected',
        title: status === 'approved' ? 'Task Approved by PM! 🎉' : 'Changes Requested on Task ✏️',
        message: `${req.user.name} (Project Manager) ${status === 'approved' ? 'approved' : 'requested revisions on'} "${task.title}". ${feedback ? `Feedback: "${feedback}"` : ''}`,
        link: `/projects/${project._id}?tab=board`,
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      notifications.forEach((n) => {
        getIO().to(`user:${n.recipient}`).emit('notification:new', { type: 'task_reviewed' });
      });
    }
  }

  res.json({ success: true, message: `Task ${status === 'approved' ? 'approved and moved to Done' : 'returned to In Progress with feedback'}`, data: { task } });
});

exports.moveTask = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const { column, order } = req.body;
  const task = await Task.findByIdAndUpdate(taskId, { column, order }, { new: true })
    .populate('assignees', 'name avatar email')
    .populate('createdBy', 'name avatar')
    .populate('managerReview.reviewedBy', 'name avatar');
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

exports.addTaskComment = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const { message } = req.body;
  if (!message || !message.trim()) {
    throw new AppError('Comment message is required', 400);
  }

  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found', 404);

  const project = await Project.findById(task.project);
  if (!project) throw new AppError('Project not found', 404);
  const hasAccess = await ensureProjectAccess(project, req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const userRole = project.getUserRole(req.user._id) || (project.owner.toString() === req.user._id.toString() ? 'project_manager' : 'member');

  task.activityNotes = task.activityNotes || [];
  const note = {
    author: req.user._id,
    authorName: req.user.name,
    role: userRole,
    action: 'comment',
    message: message.trim(),
    createdAt: new Date(),
  };
  task.activityNotes.push(note);

  await task.save();
  await task.populate('assignees', 'name avatar email');
  await task.populate('createdBy', 'name avatar');
  await task.populate('managerReview.reviewedBy', 'name avatar');
  await task.populate('activityNotes.author', 'name avatar');

  try {
    getIO().to(`project:${task.project}`).emit('task:updated', task);
  } catch (e) {}

  // Notify assignees and PM if someone else commented
  const recipients = new Set();
  task.assignees.forEach((a) => recipients.add((a._id || a).toString()));
  if (project.owner) recipients.add(project.owner.toString());
  project.members?.filter((m) => m.role === 'project_manager').forEach((m) => recipients.add(m.user.toString()));
  recipients.delete(req.user._id.toString());

  const notifications = Array.from(recipients).map((rId) => ({
    recipient: rId,
    sender: req.user._id,
    type: 'task_comment',
    title: 'New note on task',
    message: `${req.user.name} commented on "${task.title}": "${message.trim().slice(0, 80)}"`,
    link: `/projects/${project._id}?tab=board`,
  }));

  if (notifications.length > 0) {
    try {
      await Notification.insertMany(notifications);
      notifications.forEach((n) => {
        getIO().to(`user:${n.recipient}`).emit('notification:new', { type: 'task_comment' });
      });
    } catch (e) {}
  }

  res.status(201).json({
    success: true,
    message: 'Comment added to task',
    data: { task, note },
  });
});
