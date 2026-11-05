const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const CollabSession = require('../models/CollabSession');
const logger = require('./logger');

const { bootstrapPlatformAdmin } = require('./adminProvisioning');
const { reconcileProjectOwnership } = require('./ownershipReconciliation');

/**
 * Initializes workspace data if the database is brand new.
 * Safe, auditable, and idempotent: preserves existing valid data.
 */
async function bootstrapInitialData() {
  try {
    // 1. Idempotently bootstrap or reconcile Platform Administrator
    const admin = await bootstrapPlatformAdmin();

    const projectCount = await Project.countDocuments();
    if (projectCount > 0) {
      await reconcileProjectOwnership({ dryRun: false });
      return;
    }

    logger.info('[BOOTSTRAP] Initializing workspace data for fresh deployment...');

    // 2. Create initial workspace project owned by the administrator
    const project = await Project.create({
      name: 'DevCollab Workspace',
      description: 'Central engineering workspace for collaborative development and code review.',
      owner: admin._id,
      visibility: 'private',
      status: 'active',
      tags: ['Engineering', 'Product', 'Infrastructure'],
      members: [
        {
          user: admin._id,
          role: 'project_manager',
          joinedAt: new Date(),
        },
      ],
    });
    logger.info(`[BOOTSTRAP] Created initial project: DevCollab Workspace (${project._id})`);

    // 3. Seed clean onboarding starter tasks
    await Task.create({
      title: 'Configure Production Environment & Security Policies',
      description: 'Review environment variables, CORS origins, and governance policies in workspace settings.',
      priority: 'high',
      column: 'in_progress',
      targetRole: 'devops',
      assignees: [admin._id],
      project: project._id,
      createdBy: admin._id,
      startedAt: new Date(),
      order: 0,
    });

    await Task.create({
      title: 'Invite Engineering Team Members',
      description: 'Add team members and assign appropriate engineering roles via the project settings panel.',
      priority: 'medium',
      column: 'todo',
      targetRole: 'project_manager',
      assignees: [admin._id],
      project: project._id,
      createdBy: admin._id,
      order: 0,
    });

    await Task.create({
      title: 'Establish Code Review & Deployment Standards',
      description: 'Define automated testing benchmarks, peer review requirements, and merge criteria.',
      priority: 'low',
      column: 'backlog',
      targetRole: 'engineering_lead',
      assignees: [admin._id],
      project: project._id,
      createdBy: admin._id,
      order: 0,
    });

    // 4. Seed clean default collaborative session
    await CollabSession.create({
      project: project._id,
      createdBy: admin._id,
      title: 'Main Collaborative Scratchpad',
      description: 'Shared real-time coding space for project team members.',
      language: 'javascript',
      domain: 'general',
      code: '// DevCollab Real-time Collaborative Session\n// Start pair-programming with your team in real time.\n\nfunction initializeWorkspace() {\n  console.log("Workspace initialized successfully.");\n}\n\ninitializeWorkspace();\n',
      contributors: [
        {
          user: admin._id,
          name: admin.name,
          avatar: admin.avatar || '',
          role: 'project_manager',
          charactersAdded: 80,
          linesContributed: 8,
          percentage: 100,
          lastActive: new Date(),
        },
      ],
      lineAttributions: [
        { lineNumber: 1, authorId: admin._id, authorName: admin.name },
        { lineNumber: 2, authorId: admin._id, authorName: admin.name },
        { lineNumber: 3, authorId: admin._id, authorName: admin.name },
        { lineNumber: 4, authorId: admin._id, authorName: admin.name },
        { lineNumber: 5, authorId: admin._id, authorName: admin.name },
        { lineNumber: 6, authorId: admin._id, authorName: admin.name },
        { lineNumber: 7, authorId: admin._id, authorName: admin.name },
        { lineNumber: 8, authorId: admin._id, authorName: admin.name },
      ],
      messages: [],
    });
    logger.info('[BOOTSTRAP] Initialized clean collaborative session.');

    logger.info('[BOOTSTRAP] Workspace initialization completed successfully.');
  } catch (err) {
    logger.error(`[BOOTSTRAP] Error during initial bootstrap: ${err.message}`);
  }
}

module.exports = { bootstrapInitialData };
