with open('backend/src/controllers/board.controller.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update getBoard
old_get_board = """  const tasks = await Task.find({ project: projectId })
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

  res.json({ success: true, data: { board } });"""

new_get_board = """  const { evaluateTaskSla } = require('../utils/sla');

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

  res.json({ success: true, data: { board, slaSummary } });"""

if old_get_board in code:
    code = code.replace(old_get_board, new_get_board)
    print("getBoard updated with SLA metrics")
else:
    print("WARNING: old_get_board not matched")

# 2. Update moveTask
old_move_task = """exports.moveTask = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const { column, order } = req.body;
  const task = await Task.findByIdAndUpdate(taskId, { column, order }, { new: true })
    .populate('assignees', 'name avatar email')
    .populate('createdBy', 'name avatar')
    .populate('managerReview.reviewedBy', 'name avatar');
  if (!task) throw new AppError('Task not found', 404);

  getIO().to(`project:${task.project}`).emit('task:moved', { taskId, column, order });
  res.json({ success: true, data: { task } });
});"""

new_move_task = """exports.moveTask = catchAsync(async (req, res) => {
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

  const hasAccess = await ensureProjectAccess(project, req.user);
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
});"""

if old_move_task in code:
    code = code.replace(old_move_task, new_move_task)
    print("moveTask updated with strict compliance hierarchy")
else:
    print("WARNING: old_move_task not matched")

# 3. Update reviewTask to set closedAt and closedBy
old_review_task = """  if (status === 'approved') {
    task.column = 'done';
  } else {"""

new_review_task = """  if (status === 'approved') {
    task.column = 'done';
    task.completedAt = new Date();
    task.closedAt = new Date();
    task.closedBy = req.user._id;
  } else {"""

if old_review_task in code:
    code = code.replace(old_review_task, new_review_task)
    print("reviewTask updated with closedAt & closedBy")
else:
    print("WARNING: old_review_task not matched")

with open('backend/src/controllers/board.controller.js', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(code)
print("Saved backend/src/controllers/board.controller.js successfully")

