const Review = require('../models/Review');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { getIO } = require('../socket');
const { canRoleAccessDomain, ROLE_DISPLAY_NAMES, recordSecurityViolation } = require('../utils/roleCompliance');

exports.createReview = catchAsync(async (req, res) => {
  const { projectId, title, description, code, language, domain = 'general' } = req.body;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const userRole = project.getUserRole(req.user._id);
  const isPM = project.isProjectManager(req.user._id);

  if (userRole === 'viewer') {
    throw new AppError('Viewers have read-only permissions and cannot create reviews', 403);
  }

  if (code && typeof code === 'string' && code.length > 100000) {
    throw new AppError('Review code size exceeds maximum limit of 100 KB', 413);
  }

  // Check role-based domain boundaries
  if (!isPM && !canRoleAccessDomain(userRole, domain)) {
    const roleName = ROLE_DISPLAY_NAMES[userRole] || userRole;
    await recordSecurityViolation({
      req,
      project,
      attemptedAction: 'UNAUTHORIZED_CODE_CREATION',
      targetResource: 'code_review',
      targetDomain: domain,
      details: `${req.user.name} (${roleName}) attempted to publish ${domain} code for review "${title}". Blocked by Role Boundary Guard.`,
      severity: 'high',
    });
    throw new AppError(
      `Compliance Violation: As a ${roleName}, you are strictly bound to your role and cannot create or modify ${domain} code. Your Project Manager has been alerted.`,
      403
    );
  }

  let review;
  const reviewPayload = {
    project: projectId,
    author: req.user._id,
    title,
    description,
    code,
    language: language || 'javascript',
    domain: domain || 'general',
  };

  try {
    review = await Review.create(reviewPayload);
  } catch (err) {
    if (err?.message?.includes('language override unsupported')) {
      try {
        await Review.collection.dropIndexes();
        await Review.syncIndexes();
      } catch (e) {
        // Non-blocking index sync fallback
      }
      review = await Review.create(reviewPayload);
    } else {
      throw err;
    }
  }
  await review.populate('author', 'name avatar email');

  try {
    getIO().to(`project:${projectId}`).emit('review:created', review);
  } catch (e) {
    // Non-blocking socket notification error
  }
  res.status(201).json({ success: true, data: { review } });
});

exports.getReviews = catchAsync(async (req, res) => {
  const { projectId, page = 1, limit = 10, status } = req.query;
  const query = {};

  if (projectId) {
    query.project = projectId;
  } else if (req.user?.role !== 'admin') {
    const Project = require('../models/Project');
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id },
        { visibility: 'public' },
      ],
    }).select('_id');
    const projectIds = projects.map((p) => p._id);
    query.$or = [
      { project: { $in: projectIds } },
      { author: req.user._id },
      { reviewers: req.user._id },
    ];
  }

  if (projectId) {
    const project = await Project.findById(projectId);
    if (!project) throw new AppError('Project not found', 404);
    const hasAccess = project.hasAccess(req.user);
    if (!hasAccess) throw new AppError('Access denied: You are not a member of this project', 403);
  }

  if (status === 'open') {
    query.status = { $in: ['open', 'in_review', 'changes_requested'] };
  } else if (status) {
    query.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;
  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('author', 'name avatar')
      .select('-code -inlineComments')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments(query),
  ]);

  res.json({ success: true, data: { reviews, total } });
});

exports.getReview = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id)
    .populate('author', 'name avatar email')
    .populate('inlineComments.author', 'name avatar')
    .populate('generalComments.author', 'name avatar')
    .populate('reviewers', 'name avatar');
  if (!review) throw new AppError('Review not found', 404);

  const project = await Project.findById(review.project)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar');
  if (!project) throw new AppError('Project not found', 404);
  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied: You are not authorized to view reviews in this project', 403);

  const isPM =
    req.user.role === 'admin' ||
    (project.owner?._id || project.owner)?.toString() === req.user._id.toString() ||
    project.isProjectManager(req.user._id);

  res.json({ success: true, data: { review, project, isPM } });
});

exports.addInlineComment = catchAsync(async (req, res) => {
  const { lineNumber, content } = req.body;
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);

  const project = await Project.findById(review.project);
  if (!project) throw new AppError('Project not found', 404);
  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied: You are not a member of this project', 403);

  const userRole = project.getUserRole(req.user._id);
  if (userRole === 'viewer') {
    throw new AppError('Viewers have read-only access and cannot add inline comments', 403);
  }

  if (typeof lineNumber !== 'number' || lineNumber <= 0) {
    throw new AppError('Line number must be a positive integer greater than 0', 400);
  }

  if (!content || !content.trim()) {
    throw new AppError('Comment content is required', 400);
  }

  if (content.length > 2000) {
    throw new AppError('Comment cannot exceed 2000 characters', 400);
  }

  const comment = { author: req.user._id, lineNumber, content };
  review.inlineComments.push(comment);
  await review.save();
  await review.populate('inlineComments.author', 'name avatar');

  const newComment = review.inlineComments[review.inlineComments.length - 1];
  getIO().to(`review:${review._id}`).emit('comment:added', { reviewId: review._id, comment: newComment });

  // Notify review author
  if (review.author.toString() !== req.user._id.toString()) {
    await Notification.create({
      recipient: review.author,
      sender: req.user._id,
      type: 'review_comment',
      title: 'New comment on your review',
      message: `${req.user.name} commented on line ${lineNumber}`,
      link: `/reviews/${review._id}`,
      data: { reviewId: review._id },
    });
    getIO().to(`user:${review.author}`).emit('notification:new', { type: 'review_comment' });
  }

  res.status(201).json({ success: true, data: { comment: newComment } });
});

exports.resolveComment = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);

  const project = await Project.findById(review.project);
  if (!project) throw new AppError('Project not found', 404);
  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied', 403);

  const userRole = project.getUserRole(req.user._id);
  if (userRole === 'viewer') {
    throw new AppError('Viewers have read-only access and cannot resolve comments', 403);
  }

  const comment = review.inlineComments.id(req.params.commentId);
  if (!comment) throw new AppError('Comment not found', 404);
  comment.resolved = true;
  comment.resolvedBy = req.user._id;
  await review.save();
  getIO().to(`review:${review._id}`).emit('comment:resolved', { commentId: comment._id });
  res.json({ success: true, data: { comment } });
});

exports.addGeneralComment = catchAsync(async (req, res) => {
  const { content } = req.body;
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);

  const project = await Project.findById(review.project);
  if (!project) throw new AppError('Project not found', 404);
  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied: You are not a member of this project', 403);

  const userRole = project.getUserRole(req.user._id);
  if (userRole === 'viewer') {
    throw new AppError('Viewers have read-only access and cannot add comments', 403);
  }

  if (!content || !content.trim()) {
    throw new AppError('Comment content is required', 400);
  }

  if (content.length > 2000) {
    throw new AppError('Comment cannot exceed 2000 characters', 400);
  }
  review.generalComments.push({ author: req.user._id, content });
  await review.save();
  await review.populate('generalComments.author', 'name avatar');
  const newComment = review.generalComments[review.generalComments.length - 1];
  getIO().to(`review:${review._id}`).emit('generalComment:added', newComment);
  res.status(201).json({ success: true, data: { comment: newComment } });
});

exports.updateStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['open', 'in_review', 'changes_requested', 'approved', 'closed'];
  if (!validStatuses.includes(status)) {
    throw new AppError(`Invalid review status: ${status}`, 400);
  }

  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);

  const project = await Project.findById(review.project);
  if (!project) throw new AppError('Project not found', 404);
  const hasAccess = project.hasAccess(req.user);
  if (!hasAccess) throw new AppError('Access denied: You are not a member of this project', 403);

  const isPM =
    req.user.role === 'admin' ||
    (project.owner?._id || project.owner)?.toString() === req.user._id.toString() ||
    project.isProjectManager(req.user._id) ||
    (Array.isArray(project.members) && project.members.some(m =>
      (m.user?._id || m.user)?.toString() === req.user._id.toString() &&
      (m.role === 'project_manager' || m.role === 'admin')
    ));
  const userRole = project.getUserRole(req.user._id);

  if (userRole === 'viewer') {
    throw new AppError('Viewers have read-only access and cannot change review status', 403);
  }

  if (status === 'approved' && !isPM) {
    throw new AppError('Compliance Restriction: Only Project Managers can approve code reviews', 403);
  }

  // Author cannot request changes on their own review (Requirement 5)
  const isAuthor = (review.author?._id || review.author)?.toString() === req.user._id.toString();
  if (status === 'changes_requested' && isAuthor) {
    throw new AppError('Logical Restriction: Review author cannot request changes on their own review', 400);
  }
  review.status = status;
  await review.save();
  getIO().to(`review:${review._id}`).emit('review:statusChanged', { status });
  getIO().to(`project:${review.project}`).emit('review:statusChanged', { reviewId: review._id, status });

  if (review.author.toString() !== req.user._id.toString()) {
    const typeMap = { approved: 'review_approved', changes_requested: 'review_changes_requested' };
    if (typeMap[status]) {
      await Notification.create({
        recipient: review.author, sender: req.user._id,
        type: typeMap[status],
        title: status === 'approved' ? 'Review approved!' : 'Changes requested',
        message: `${req.user.name} ${status === 'approved' ? 'approved' : 'requested changes on'} your review`,
        link: `/reviews/${review._id}`,
      });
      getIO().to(`user:${review.author}`).emit('notification:new', { type: typeMap[status] });
    }
  }
  res.json({ success: true, data: { review } });
});

exports.updateReview = catchAsync(async (req, res) => {
  const { title, description, code, domain } = req.body;
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);

  const project = await Project.findById(review.project);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isMember(req.user._id)) throw new AppError('Access denied', 403);

  const userRole = project.getUserRole(req.user._id);
  const isPM = project.isProjectManager(req.user._id);

  if (userRole === 'viewer') {
    throw new AppError('Viewers have read-only permissions and cannot create reviews', 403);
  }

  if (code && typeof code === 'string' && code.length > 100000) {
    throw new AppError('Review code size exceeds maximum limit of 100 KB', 413);
  }
  const targetDomain = domain || review.domain || 'general';

  // Code modification security guard
  if (code !== undefined && code !== review.code) {
    if (!isPM && !canRoleAccessDomain(userRole, targetDomain)) {
      const roleName = ROLE_DISPLAY_NAMES[userRole] || userRole;
      await recordSecurityViolation({
        req,
        project,
        attemptedAction: 'UNAUTHORIZED_CODE_EDIT',
        targetResource: 'code_review',
        targetDomain,
        targetId: review._id,
        details: `${req.user.name} (${roleName}) attempted to alter ${targetDomain} code in review "${review.title}". Blocked by Role Boundary Guard.`,
        severity: 'critical',
      });
      throw new AppError(
        `Security Alert: As a ${roleName}, you are strictly bound to your role and cannot modify ${targetDomain} code. Your Project Manager has been alerted.`,
        403
      );
    }
  }

  if (title !== undefined) review.title = title;
  if (description !== undefined) review.description = description;
  if (code !== undefined) review.code = code;
  if (domain !== undefined && isPM) review.domain = domain;

  await review.save();
  await review.populate('author', 'name avatar email');
  getIO().to(`review:${review._id}`).emit('review:updated', review);
  res.json({ success: true, data: { review } });
});
