const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { getIO } = require('../socket');

exports.getBoard = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const { evaluateTaskSla } = require('../utils/sla');

  const tasks = await Task.find({ project: projectId })
    .populate('assignees', 'name avatar email')
    .populate('createdBy', 'name avatar')
    .populate('managerReview.reviewedBy', 'name avatar')
    .populate('activityNotes.author', 'name avatar')
    .sort({ order: 1 });

  let compliantCount = 0;
  let atRiskCount = 0;
  let breachedCount = 0;

  const tasksWithSla = tasks.map((t) => {
    const tObj = t.toObject();
    const slaStatus = evaluateTaskSla(t);
    tObj.slaStatus = slaStatus;

    if (slaStatus.state === 'breached') breachedCount++;
    else if (slaStatus.state === 'at_risk') atRiskCount++;
    else compliantCount++;

    return tObj;
  });

  const columns = ['backlog', 'todo', 'in_progress', 'review', 'done'];
  const board = columns.reduce((acc, col) => {
    acc[col] = tasksWithSla.filter((t) => t.column === col);
    return acc;
  }, {});

  const total = tasksWithSla.length;
  const complianceRate = total > 0 ? Math.round(((total - breachedCount) / total) * 100) : 100;

  const slaSummary = {
    total,
    compliant: compliantCount,
    atRisk: atRiskCount,
    breached: breachedCount,
    complianceRate,
  };

  res.json({ success: true, data: { board, slaSummary } });
});

exports.createTask = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const userRole = project.getUserRole(req.user._id);
  if (userRole === 'viewer') {
    throw new AppError('Viewers have read-only access and cannot create tasks', 403);
  }

  let assignees = Array.isArray(req.body.assignees) ? [...req.body.assignees] : [];

  // Ensure all assignees are legitimate members of this project (Security: TASK-009, AUTO-TASK-005, ROLE-013)
  for (const assigneeId of assignees) {
    const isMem = (project.owner?._id || project.owner)?.toString() === assigneeId.toString() ||
      project.members.some((m) => (m.user?._id || m.user)?.toString() === assigneeId.toString());
    if (!isMem) {
      throw new AppError('Cannot assign task to a non-member. All assignees must be members of this project.', 400);
    }
  }

  const count = await Task.countDocuments({ project: projectId, column: req.body.column || 'backlog' });
  
  // Sanitize fields against mass-assignment
  const initialColumn = (req.body.column === 'todo') ? 'todo' : 'backlog';
  const task = await Task.create({
    title: req.body.title,
    description: req.body.description || '',
    priority: req.body.priority || 'medium',
    targetRole: req.body.targetRole || 'any',
    dueDate: req.body.dueDate,
    labels: Array.isArray(req.body.labels) ? req.body.labels : [],
    column: initialColumn,
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

  const project = await Project.findById(task.project);
  if (!project) throw new AppError('Project not found', 404);

  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied: You are not authorized to access this project', 403);

  const userRole = project.getUserRole(req.user._id);
  if (userRole === 'viewer') {
    throw new AppError('Viewers have read-only access and cannot edit tasks', 403);
  }

  const isPM = project.isProjectManager(req.user._id);
  const isAssignee = task.assignees?.some(
    (a) => (a._id || a).toString() === req.user._id.toString()
  );
  const isCreator = (task.createdBy?._id || task.createdBy)?.toString() === req.user._id.toString();

  if (!isPM && !isAssignee && !isCreator) {
    throw new AppError('Permission Denied: Only the assigned engineer, creator, or Project Manager can edit this task', 403);
  }

  // If assignees are updated, ensure they are legitimate members of this project (Security: TASK-009, ROLE-013)
  if (Array.isArray(req.body.assignees)) {
    for (const assigneeId of req.body.assignees) {
      const isMem = (project.owner?._id || project.owner)?.toString() === assigneeId.toString() ||
        project.members.some((m) => (m.user?._id || m.user)?.toString() === assigneeId.toString());
      if (!isMem) {
        throw new AppError('Cannot assign task to a non-member. All assignees must be members of this project.', 400);
      }
    }
  }

  // Whitelist safe editable fields
  const allowed = ['title', 'description', 'priority', 'targetRole', 'assignees', 'dueDate', 'labels', 'order', 'resolutionNotes'];
  allowed.forEach((k) => { if (req.body[k] !== undefined) task[k] = req.body[k]; });

  if (req.body.column !== undefined) {
    const validColumns = ['backlog', 'todo', 'in_progress', 'review', 'done'];
    if (!validColumns.includes(req.body.column)) {
      throw new AppError('Invalid board column', 400);
    }
    if (req.body.column === 'done' && !isPM) {
      throw new AppError('Compliance Restriction: Only Project Managers can approve and close tickets into Done.', 403);
    }
    if (task.column === 'review' && req.body.column !== 'review' && !isPM) {
      throw new AppError('Compliance Restriction: Ticket is under PM Review and cannot be moved by team members.', 403);
    }
    if (req.body.column === 'in_progress' && !task.startedAt) {
      task.startedAt = new Date();
    }
    task.column = req.body.column;
  }
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
  const hasAccess = project.hasAccess(req.user);
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
  const hasAccess = project.hasAccess(req.user);
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
    task.completedAt = new Date();
    task.closedAt = new Date();
    task.closedBy = req.user._id;
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

  const validColumns = ['backlog', 'todo', 'in_progress', 'review', 'done'];
  if (!validColumns.includes(column)) {
    throw new AppError('Invalid board column', 400);
  }

  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found', 404);

  const project = await Project.findById(task.project);
  if (!project) throw new AppError('Project not found', 404);

  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const isPM = project.isProjectManager(req.user._id);
  const isAssignee = task.assignees?.some(
    (a) => (a._id || a).toString() === req.user._id.toString()
  );

  // Compliance Rule 1: Strict Hierarchy - Only PM can move or approve ticket into Done
  if (column === 'done' && !isPM) {
    throw new AppError(
      'Compliance Restriction: Only Project Managers can approve and close tickets into Done.',
      403
    );
  }

  // Compliance Rule 2: Review Lock - Tickets in Review cannot be moved by team members
  if (task.column === 'review' && column !== 'review' && !isPM) {
    throw new AppError(
      'Compliance Restriction: Ticket is under PM Review and cannot be moved by team members.',
      403
    );
  }

  // Compliance Rule 3: Only assigned engineers or PM can move tickets
  if (!isPM && !isAssignee) {
    throw new AppError(
      'Permission Denied: Only assigned team members or Project Managers can move this ticket.',
      403
    );
  }

  const previousColumn = task.column;
  task.column = column;
  if (typeof order === 'number') {
    task.order = order;
  }

  const userRole = project.getUserRole(req.user._id) || (isPM ? 'project_manager' : 'contributor');
  task.activityNotes = task.activityNotes || [];

  // Track SDLC Milestones & SLA Transitions
  if (column === 'in_progress' && previousColumn !== 'in_progress') {
    if (!task.startedAt) task.startedAt = new Date();
    task.activityNotes.push({
      author: req.user._id,
      authorName: req.user.name,
      role: userRole,
      action: 'comment',
      message: `Started work. Ticket transitioned from ${previousColumn} to In Progress.`,
      createdAt: new Date(),
    });
  } else if (column === 'review' && previousColumn !== 'review') {
    task.submittedAt = new Date();
    task.completedByAssignee = true;
    task.activityNotes.push({
      author: req.user._id,
      authorName: req.user.name,
      role: userRole,
      action: 'submitted',
      message: `Work completed and submitted for Project Manager sign-off.`,
      createdAt: new Date(),
    });
  } else if (column === 'done' && previousColumn !== 'done') {
    task.completedAt = new Date();
    task.closedAt = new Date();
    task.closedBy = req.user._id;
    task.managerReview = {
      status: 'approved',
      reviewedBy: req.user._id,
      feedback: 'Signed off and verified completed by Project Manager.',
      reviewedAt: new Date(),
    };
    task.activityNotes.push({
      author: req.user._id,
      authorName: req.user.name,
      role: 'project_manager',
      action: 'approved',
      message: `Project Manager signed off and approved ticket into Done.`,
      createdAt: new Date(),
    });
  } else if (previousColumn !== column) {
    task.activityNotes.push({
      author: req.user._id,
      authorName: req.user.name,
      role: userRole,
      action: 'comment',
      message: `Moved ticket from ${previousColumn} to ${column}.`,
      createdAt: new Date(),
    });
  }

  await task.save();
  await task.populate('assignees', 'name avatar email');
  await task.populate('createdBy', 'name avatar');
  await task.populate('managerReview.reviewedBy', 'name avatar');
  await task.populate('activityNotes.author', 'name avatar');

  const { evaluateTaskSla } = require('../utils/sla');
  const taskObj = task.toObject();
  taskObj.slaStatus = evaluateTaskSla(task);

  getIO().to(`project:${task.project}`).emit('task:moved', { taskId, column, order, task: taskObj });
  getIO().to(`project:${task.project}`).emit('task:updated', taskObj);

  res.json({ success: true, data: { task: taskObj } });
});

exports.deleteTask = catchAsync(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) throw new AppError('Task not found', 404);

  const project = await Project.findById(task.project);
  if (!project) throw new AppError('Project not found', 404);

  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const isPM = project.isProjectManager(req.user._id);
  const isCreator = (task.createdBy?._id || task.createdBy)?.toString() === req.user._id.toString();

  if (!isPM && !isCreator) {
    throw new AppError('Permission Denied: Only the Project Manager or task creator can delete this task', 403);
  }

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
  const hasAccess = project.hasAccess(req.user);
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
