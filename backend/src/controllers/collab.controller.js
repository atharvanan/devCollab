const CollabSession = require('../models/CollabSession');
const Project = require('../models/Project');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { getIO } = require('../socket');
const { canRoleAccessDomain, ROLE_DISPLAY_NAMES, recordSecurityViolation } = require('../utils/roleCompliance');

/**
 * Get all collab sessions for a project.
 * If none exist, auto-scaffolds an initial session for instant collaborative coding.
 */
exports.getProjectSessions = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isMember(req.user._id)) throw new AppError('Access denied', 403);

  let sessions = await CollabSession.find({ project: projectId })
    .populate('createdBy', 'name avatar email')
    .populate('lastEditor', 'name avatar email')
    .sort({ updatedAt: -1 });

  // If no session exists yet, create an initial default one
  if (sessions.length === 0) {
    const defaultSession = await CollabSession.create({
      project: projectId,
      createdBy: req.user._id,
      title: 'Main Collaborative Scratchpad',
      description: 'Shared real-time coding space for project team members.',
      language: 'javascript',
      domain: 'general',
      code: `// DevCollab Live Collaborative Code Workspace\n// Project: ${project.name}\n// Multiple developers can type concurrently and track their share.\n\nexport function calculateMetrics(data) {\n  return data.reduce((acc, curr) => acc + curr, 0);\n}\n`,
      contributors: [
        {
          user: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar || '',
          role: project.getUserRole(req.user._id) || 'contributor',
          charactersAdded: 50,
          linesContributed: 4,
          percentage: 100,
          lastActive: new Date(),
        },
      ],
      lineAttributions: [
        { lineNumber: 1, authorId: req.user._id, authorName: req.user.name },
        { lineNumber: 2, authorId: req.user._id, authorName: req.user.name },
        { lineNumber: 3, authorId: req.user._id, authorName: req.user.name },
        { lineNumber: 4, authorId: req.user._id, authorName: req.user.name },
        { lineNumber: 5, authorId: req.user._id, authorName: req.user.name },
      ],
    });
    await defaultSession.populate('createdBy', 'name avatar email');
    sessions = [defaultSession];
  }

  res.json({ success: true, data: { sessions } });
});

/**
 * Get a specific collab session by ID
 */
exports.getSession = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const session = await CollabSession.findById(sessionId)
    .populate('createdBy', 'name avatar email')
    .populate('lastEditor', 'name avatar email')
    .populate('contributors.user', 'name avatar email');

  if (!session) throw new AppError('Collaborative session not found', 404);

  const project = await Project.findById(session.project);
  if (!project || !project.isMember(req.user._id)) {
    throw new AppError('Access denied to this project session', 403);
  }

  res.json({ success: true, data: { session, project } });
});

/**
 * Create a new collaborative coding session
 */
exports.createSession = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const { title, description, code, language = 'javascript', domain = 'general' } = req.body;

  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  if (!project.isMember(req.user._id)) throw new AppError('Access denied', 403);

  const userRole = project.getUserRole(req.user._id);
  const isPM = project.isProjectManager(req.user._id);

  if (!isPM && !canRoleAccessDomain(userRole, domain)) {
    const roleName = ROLE_DISPLAY_NAMES[userRole] || userRole;
    await recordSecurityViolation({
      req,
      project,
      attemptedAction: 'UNAUTHORIZED_COLLAB_CREATION',
      targetResource: 'collab_session',
      targetDomain: domain,
      details: `${req.user.name} (${roleName}) attempted to start a ${domain} collab session "${title}". Blocked by Role Boundary Guard.`,
      severity: 'medium',
    });
    throw new AppError(
      `Compliance Violation: As a ${roleName}, you cannot create a ${domain} code session. Your PM has been notified.`,
      403
    );
  }

  const initialCode = code || `// Live code room: ${title}\n// Domain: ${domain} | Language: ${language}\n\n`;
  const initialLines = initialCode.split('\n').length;

  const session = await CollabSession.create({
    project: projectId,
    createdBy: req.user._id,
    title,
    description: description || '',
    code: initialCode,
    language,
    domain,
    contributors: [
      {
        user: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar || '',
        role: userRole || 'contributor',
        charactersAdded: initialCode.length,
        linesContributed: initialLines,
        percentage: 100,
        lastActive: new Date(),
      },
    ],
  });

  await session.populate('createdBy', 'name avatar email');

  try {
    getIO().to(`project:${projectId}`).emit('collab:created', session);
  } catch (err) {}

  res.status(201).json({ success: true, data: { session } });
});

/**
 * Save / update code in a collaborative session
 * Updates contributor metrics and attribution percentages
 */
exports.updateSessionCode = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { code, language, title, activeLine, charsDelta = 0, linesDelta = 0 } = req.body;

  const session = await CollabSession.findById(sessionId);
  if (!session) throw new AppError('Session not found', 404);

  const project = await Project.findById(session.project);
  if (!project || !project.isMember(req.user._id)) {
    throw new AppError('Access denied', 403);
  }

  const userRole = project.getUserRole(req.user._id);
  const isPM = project.isProjectManager(req.user._id);

  if (code !== undefined && code !== session.code) {
    if (!isPM && !canRoleAccessDomain(userRole, session.domain)) {
      const roleName = ROLE_DISPLAY_NAMES[userRole] || userRole;
      await recordSecurityViolation({
        req,
        project,
        attemptedAction: 'UNAUTHORIZED_COLLAB_EDIT',
        targetResource: 'collab_session',
        targetDomain: session.domain,
        targetId: session._id,
        details: `${req.user.name} (${roleName}) attempted to edit ${session.domain} code. Blocked by Role Guard.`,
        severity: 'high',
      });
      throw new AppError(
        `Compliance Violation: As a ${roleName}, you cannot edit code in domain "${session.domain}".`,
        403
      );
    }
    session.code = code;
    session.lastEditor = req.user._id;
  }

  if (language) session.language = language;
  if (title) session.title = title;

  // Track / update contributor metrics
  const uid = req.user._id.toString();
  let contrib = session.contributors.find((c) => c.user.toString() === uid);
  const addedChars = Math.max(1, Math.abs(charsDelta || 1));
  const addedLines = Math.max(0, linesDelta || 0);

  if (contrib) {
    contrib.charactersAdded = (contrib.charactersAdded || 0) + addedChars;
    contrib.linesContributed = (contrib.linesContributed || 0) + addedLines;
    contrib.lastActive = new Date();
  } else {
    session.contributors.push({
      user: req.user._id,
      name: req.user.name,
      avatar: req.user.avatar || '',
      role: userRole || 'contributor',
      charactersAdded: addedChars,
      linesContributed: addedLines,
      percentage: 0,
      lastActive: new Date(),
    });
  }

  // Recalculate contribution share percentages
  const totalChars = session.contributors.reduce((acc, c) => acc + (c.charactersAdded || 0), 0);
  if (totalChars > 0) {
    session.contributors.forEach((c) => {
      c.percentage = Math.round(((c.charactersAdded || 0) / totalChars) * 100);
    });
  }

  // Update line attribution if activeLine provided
  if (activeLine) {
    const existingAttr = session.lineAttributions.find((l) => l.lineNumber === activeLine);
    if (existingAttr) {
      existingAttr.authorId = req.user._id;
      existingAttr.authorName = req.user.name;
      existingAttr.updatedAt = new Date();
    } else {
      session.lineAttributions.push({
        lineNumber: activeLine,
        authorId: req.user._id,
        authorName: req.user.name,
      });
    }
  }

  await session.save();
  await session.populate('lastEditor', 'name avatar email');

  try {
    getIO().to(`collab:${sessionId}`).emit('collab:updated', {
      session: {
        _id: session._id,
        code: session.code,
        language: session.language,
        contributors: session.contributors,
        lineAttributions: session.lineAttributions,
        lastEditor: session.lastEditor,
      },
      author: { _id: req.user._id, name: req.user.name },
    });
  } catch (err) {}

  res.json({ success: true, data: { session } });
});

/**
 * 1-Click Export to Code Review:
 * Converts the collaborative code session into an official Code Review
 * tagging all collaborators as co-contributors/reviewers.
 */
exports.exportToReview = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { title, description } = req.body;

  const session = await CollabSession.findById(sessionId);
  if (!session) throw new AppError('Session not found', 404);

  const project = await Project.findById(session.project);
  if (!project || !project.isMember(req.user._id)) {
    throw new AppError('Access denied', 403);
  }

  // Build list of co-reviewers from other contributors
  const otherContributors = session.contributors
    .filter((c) => c.user.toString() !== req.user._id.toString())
    .map((c) => c.user);

  const reviewTitle = title || `Review: ${session.title}`;
  const reviewDescription =
    description ||
    `Collaboratively authored in DevCollab live room by ${session.contributors.map((c) => c.name).join(', ')}.`;

  const review = await Review.create({
    project: session.project,
    author: req.user._id,
    title: reviewTitle,
    description: reviewDescription,
    code: session.code,
    language: session.language,
    domain: session.domain,
    status: 'open',
    reviewers: otherContributors,
  });

  await review.populate('author', 'name avatar email');

  // Notify co-contributors
  for (const contributorId of otherContributors) {
    await Notification.create({
      recipient: contributorId,
      sender: req.user._id,
      type: 'review_assigned',
      title: 'Collaborative code exported for review',
      message: `${req.user.name} exported your shared code session to Review "${reviewTitle}".`,
      link: `/reviews/${review._id}`,
      data: { reviewId: review._id },
    }).catch(() => {});

    try {
      getIO().to(`user:${contributorId}`).emit('notification:new', { type: 'review_assigned' });
    } catch (e) {}
  }

  try {
    getIO().to(`project:${session.project}`).emit('review:created', review);
  } catch (e) {}

  res.status(201).json({
    success: true,
    message: 'Collaborative code session successfully exported to Code Review!',
    data: { review },
  });
});

/**
 * Delete or reset a collaborative session
 */
exports.deleteSession = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const session = await CollabSession.findById(sessionId);
  if (!session) throw new AppError('Session not found', 404);

  const project = await Project.findById(session.project);
  if (!project) throw new AppError('Project not found', 404);

  const isPM = project.isProjectManager(req.user._id);
  const isCreator = session.createdBy.toString() === req.user._id.toString();

  if (!isPM && !isCreator) {
    throw new AppError('Only project managers or the creator can delete this session', 403);
  }

  await session.deleteOne();

  try {
    getIO().to(`project:${session.project}`).emit('collab:deleted', { sessionId });
  } catch (e) {}

  res.json({ success: true, message: 'Collaborative session deleted' });
});

