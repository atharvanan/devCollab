const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const CollabSession = require('../models/CollabSession');
const { TEST_BOTS, ensureBotUser } = require('./testBots');
const logger = require('./logger');

/**
 * Automatically bootstraps initial workspace data if the database is brand new.
 * Safe and non-destructive: if any project already exists, it skips immediately.
 */
async function bootstrapInitialData() {
  try {
    // 1. Ensure Atharva's Lead PM account exists and holds Platform Administrator privileges
    let atharva = await User.findOne({ email: 'atharvanandurkar2411@gmail.com' });
    if (!atharva) {
      atharva = await User.create({
        name: 'Atharva Nandurkar',
        email: 'atharvanandurkar2411@gmail.com',
        password: 'Password123',
        role: 'admin',
        canCreateProjects: true,
        isVerified: true,
        bio: 'Lead Platform Architect & Project Manager',
      });
      logger.info('[BOOTSTRAP] Created Lead PM & Platform Administrator: Atharva Nandurkar');
    } else {
      let needsSave = false;
      if (atharva.role !== 'admin') {
        atharva.role = 'admin';
        needsSave = true;
      }
      if (!atharva.canCreateProjects) {
        atharva.canCreateProjects = true;
        needsSave = true;
      }
      if (needsSave) {
        await atharva.save();
        logger.info('[BOOTSTRAP] Reconciled Platform Administrator privileges for Atharva');
      }
    }

    const projectCount = await Project.countDocuments();
    if (projectCount > 0) {
      // Reconcile projects: ensure each project has a valid owner and owner is a project_manager
      const allProjects = await Project.find();
      for (const p of allProjects) {
        let pModified = false;
        if (!p.owner) {
          p.owner = atharva._id;
          pModified = true;
        }
        const hasOwnerInMembers = p.members.some(
          (m) => (m.user?._id || m.user)?.toString() === p.owner.toString()
        );
        if (!hasOwnerInMembers) {
          p.members.push({ user: p.owner, role: 'project_manager', joinedAt: new Date() });
          pModified = true;
        }
        if (pModified) {
          await p.save();
        }
      }
      return; // Existing database reconciled successfully
    }

    logger.info('[BOOTSTRAP] Initializing workspace data for fresh deployment...');

    // 2. Ensure all 7 engineering test bots exist
    const botUserMap = {};
    for (const b of TEST_BOTS) {
      const u = await ensureBotUser(b);
      botUserMap[b.role] = u;
    }
    logger.info(`[BOOTSTRAP] Ensured ${TEST_BOTS.length} engineering role bots.`);

    // 3. Create the canonical DevCollab Project
    const membersList = [
      { user: atharva._id, role: 'project_manager', joinedAt: new Date() },
    ];
    for (const b of TEST_BOTS) {
      const u = botUserMap[b.role];
      if (u) {
        membersList.push({
          user: u._id,
          role: b.role,
          joinedAt: new Date(),
        });
      }
    }

    const project = await Project.create({
      name: 'DevCollab',
      description: 'Developers collaboration project',
      owner: atharva._id,
      visibility: 'private',
      status: 'active',
      tags: ['TypeScript', 'Next.js', 'React.js', 'MongoDB', 'Socket.io'],
      members: membersList,
    });
    logger.info(`[BOOTSTRAP] Created project: DevCollab (${project._id})`);

    // 4. Seed initial realistic SDLC tasks
    const alex = botUserMap['frontend_developer'];
    const sarah = botUserMap['backend_developer'];
    const lucas = botUserMap['devops'];
    const emma = botUserMap['ui_ux_designer'];
    const david = botUserMap['qa_tester'];

    // In Progress Task: High Priority Frontend
    if (alex) {
      await Task.create({
        title: 'UI Feature: Dark Mode Ergonomics & Navigation',
        description: 'Implement accessible color palettes, contrast ratio verification, and pre-login theme toggle.',
        priority: 'high',
        column: 'in_progress',
        targetRole: 'frontend_developer',
        assignees: [alex._id],
        project: project._id,
        createdBy: atharva._id,
        startedAt: new Date(Date.now() - 3600000), // 1 hour ago
        order: 0,
      });
    }

    // In Progress Task: Medium Priority Backend
    if (sarah) {
      await Task.create({
        title: 'Backend Fix: Rate Limiting & Redis Session Caching',
        description: 'Verify token rotation, distributed locks, and retry backoff strategies.',
        priority: 'medium',
        column: 'in_progress',
        targetRole: 'backend_developer',
        assignees: [sarah._id],
        project: project._id,
        createdBy: atharva._id,
        startedAt: new Date(Date.now() - 7200000), // 2 hours ago
        order: 1,
      });
    }

    // Review Task: Low Priority UI/UX with Resolution Notes
    if (emma) {
      await Task.create({
        title: 'UI UX issue: Kanban Horizontal Scrolling Track',
        description: 'Ensure prominent horizontal scrollbar on Kanban boards and hide vertical column clutter.',
        priority: 'low',
        column: 'review',
        targetRole: 'ui_ux_designer',
        assignees: [emma._id],
        project: project._id,
        createdBy: atharva._id,
        startedAt: new Date(Date.now() - 14400000),
        completedByAssignee: true,
        assigneeNotes: 'Horizontal scroll track styled with Tailwind custom classes. Nav buttons added for touchpad-free navigation.',
        order: 0,
      });
    }

    // To Do Task: DevOps
    if (lucas) {
      await Task.create({
        title: 'DevOps issue: Container Cluster Health & Healthchecks',
        description: 'Configure Docker compose healthchecks for Redis and Mongo to ensure zero-downtime boots.',
        priority: 'low',
        column: 'todo',
        targetRole: 'devops',
        assignees: [lucas._id],
        project: project._id,
        createdBy: atharva._id,
        order: 0,
      });
    }

    // Backlog Task: QA
    if (david) {
      await Task.create({
        title: 'QA issue: End-to-End Test Suite Verification',
        description: 'Execute comprehensive test matrix covering boundary arithmetic and WCAG compliance.',
        priority: 'critical',
        column: 'backlog',
        targetRole: 'qa_tester',
        assignees: [david._id],
        project: project._id,
        createdBy: atharva._id,
        order: 0,
      });
    }

    // 5. Seed default Collaborative Scratchpad with code and chat history
    const collabMessages = [];
    if (emma) {
      collabMessages.push({
        _id: new (require('mongoose')).Types.ObjectId(),
        user: emma._id,
        name: 'Emma Watson (UI/UX)',
        role: 'ui_ux_designer',
        avatar: emma.avatar || '',
        content: "I've done the addition",
        timestamp: new Date(Date.now() - 120000),
      });
      collabMessages.push({
        _id: new (require('mongoose')).Types.ObjectId(),
        user: emma._id,
        name: 'Emma Watson (UI/UX)',
        role: 'ui_ux_designer',
        avatar: emma.avatar || '',
        content: 'Done the multiplication.',
        timestamp: new Date(Date.now() - 30000),
      });
    }

    await CollabSession.create({
      project: project._id,
      createdBy: atharva._id,
      title: 'Main Collaborative Scratchpad',
      description: 'Shared real-time coding space for project team members.',
      language: 'javascript',
      domain: 'general',
      code: 'const a = 5;\nconst b = 5;\n\nconsole.log(a+b);\n\nlet c = 10;\nlet d = 10;\nconsole.log(a*b);\n',
      contributors: [
        {
          user: atharva._id,
          name: 'Atharva Nandurkar',
          avatar: '',
          role: 'project_manager',
          charactersAdded: 50,
          linesContributed: 4,
          percentage: 53,
          lastActive: new Date(),
        },
        ...(emma ? [{
          user: emma._id,
          name: 'Emma Watson (UI/UX)',
          avatar: emma.avatar || '',
          role: 'ui_ux_designer',
          charactersAdded: 45,
          linesContributed: 4,
          percentage: 47,
          lastActive: new Date(),
        }] : []),
      ],
      lineAttributions: [
        { lineNumber: 1, authorId: atharva._id, authorName: 'Atharva Nandurkar' },
        { lineNumber: 2, authorId: atharva._id, authorName: 'Atharva Nandurkar' },
        { lineNumber: 3, authorId: atharva._id, authorName: 'Atharva Nandurkar' },
        { lineNumber: 4, authorId: atharva._id, authorName: 'Atharva Nandurkar' },
        ...(emma ? [
          { lineNumber: 5, authorId: emma._id, authorName: 'Emma Watson (UI/UX)' },
          { lineNumber: 6, authorId: emma._id, authorName: 'Emma Watson (UI/UX)' },
          { lineNumber: 7, authorId: emma._id, authorName: 'Emma Watson (UI/UX)' },
          { lineNumber: 8, authorId: emma._id, authorName: 'Emma Watson (UI/UX)' },
        ] : []),
      ],
      messages: collabMessages,
    });
    logger.info('[BOOTSTRAP] Created Main Collaborative Scratchpad with code and chat history.');

    logger.info('[BOOTSTRAP] Workspace initialization completed successfully!');
  } catch (err) {
    logger.error(`[BOOTSTRAP] Error during initial bootstrap: ${err.message}`);
  }
}

module.exports = { bootstrapInitialData };

