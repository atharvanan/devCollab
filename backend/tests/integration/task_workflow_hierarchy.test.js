const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');
const Task = require('../../src/models/Task');
const Notification = require('../../src/models/Notification');

describe('Task SDLC Workflow & Hierarchy Lifecycle (TASKX-001 to TASKX-020)', () => {
  let pm, dev, qa, outsider;
  let pmToken, devToken, qaToken, outsiderToken;
  let project;

  beforeAll(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await Notification.deleteMany({});

    pm = await User.create({ name: 'Sarah PM', email: 'sarah.pm@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    dev = await User.create({ name: 'Alex Frontend', email: 'alex.fe@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    qa = await User.create({ name: 'David QA', email: 'david.qa@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    outsider = await User.create({ name: 'Outsider', email: 'outsider@other.com', password: 'Password123!', role: 'user', isVerified: true });

    const pmRes = await request(app).post('/api/v1/auth/login').send({ email: pm.email, password: 'Password123!' });
    pmToken = pmRes.body.data.accessToken;

    const devRes = await request(app).post('/api/v1/auth/login').send({ email: dev.email, password: 'Password123!' });
    devToken = devRes.body.data.accessToken;

    const qaRes = await request(app).post('/api/v1/auth/login').send({ email: qa.email, password: 'Password123!' });
    qaToken = qaRes.body.data.accessToken;

    const outRes = await request(app).post('/api/v1/auth/login').send({ email: outsider.email, password: 'Password123!' });
    outsiderToken = outRes.body.data.accessToken;

    project = await Project.create({
      name: 'SDLC Workflow Test Platform',
      owner: pm._id,
      members: [
        { user: pm._id, role: 'project_manager' },
        { user: dev._id, role: 'contributor' },
        { user: qa._id, role: 'contributor' },
      ],
      visibility: 'private',
    });
  });

  describe('TASKX-001 to TASKX-010: Task Creation, Role Targeting & Assignment Notifications', () => {
    let createdTaskId;

    it('TASKX-001: PM creates a task with targetRole and assignees', async () => {
      const res = await request(app)
        .post(`/api/v1/board/${project._id}/tasks`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          title: 'Implement Dark Mode Auth Component',
          description: 'Build responsive dark theme toggle on login and verify-otp pages',
          priority: 'high',
          targetRole: 'frontend_developer',
          assignees: [dev._id],
          column: 'todo',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.task.title).toBe('Implement Dark Mode Auth Component');
      expect(res.body.data.task.column).toBe('todo');
      expect(res.body.data.task.activityNotes.length).toBeGreaterThan(0);
      expect(res.body.data.task.activityNotes[0].action).toBe('created');
      createdTaskId = res.body.data.task._id;
    });

    it('TASKX-002: Verifies task assignment notification was generated for assignee', async () => {
      const notifs = await Notification.find({ recipient: dev._id });
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].type).toBe('task_assigned');
      expect(notifs[0].message).toContain('Implement Dark Mode Auth Component');
    });

    it('TASKX-003: Assignee transitions ticket to in_progress and system stamps startedAt', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${createdTaskId}/move`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ column: 'in_progress', order: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('in_progress');
      expect(res.body.data.task.startedAt).toBeDefined();
    });

    it('TASKX-004: QA engineer adds a collaborative progress note to the task', async () => {
      const res = await request(app)
        .post(`/api/v1/board/tasks/${createdTaskId}/comments`)
        .set('Authorization', `Bearer ${qaToken}`)
        .send({ message: 'QA environment ready with automated Puppeteer harness' });

      expect(res.status).toBe(201);
      expect(res.body.data.task.activityNotes.some((n) => n.message.includes('Puppeteer harness'))).toBe(true);
    });
  });

  describe('TASKX-011 to TASKX-020: Review Submission, Hierarchy Approval & PM Sign-Off', () => {
    let lifecycleTaskId;

    beforeAll(async () => {
      const task = await Task.create({
        title: 'Backend Database Indexing & Optimization',
        description: 'Add compound indexes for project membership and SLA lookups',
        project: project._id,
        createdBy: pm._id,
        assignees: [dev._id],
        column: 'in_progress',
        priority: 'critical',
        startedAt: new Date(),
      });
      lifecycleTaskId = task._id;
    });

    it('TASKX-011: Contributor submits resolution notes with work summary', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${lifecycleTaskId}/resolve`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          notes: 'Compound indexes created on project.members.user and task.sla.resolutionDeadline.',
          column: 'review',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('review');
      expect(res.body.data.task.completedByAssignee).toBe(true);
      expect(res.body.data.task.managerReview.status).toBe('pending');
    });

    it('TASKX-012: Contributor attempt to force ticket to Done is blocked by compliance policy', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${lifecycleTaskId}/move`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ column: 'done', order: 0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Compliance Restriction/i);
    });

    it('TASKX-013: Contributor attempt to move ticket back while in Review is blocked (Review Lock)', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${lifecycleTaskId}/move`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ column: 'in_progress', order: 0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/under PM Review/i);
    });

    it('TASKX-014: Project Manager requests revision with feedback notes', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${lifecycleTaskId}/manager-review`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'rejected',
          feedback: 'Please verify index size footprint on MongoDB replica sets.',
          routeToColumn: 'in_progress',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('in_progress');
      expect(res.body.data.task.completedByAssignee).toBe(false);
      expect(res.body.data.task.managerReview.status).toBe('rejected');
    });

    it('TASKX-015: Contributor addresses revisions and resubmits to PM', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${lifecycleTaskId}/resolve`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          notes: 'Replica index footprint benchmarked at under 2MB. Safe for production.',
          column: 'review',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('review');
      expect(res.body.data.task.completedByAssignee).toBe(true);
    });

    it('TASKX-016: Project Manager conducts final review and approves ticket into Done', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${lifecycleTaskId}/manager-review`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'approved',
          feedback: 'Approved for production deployment.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('done');
      expect(res.body.data.task.closedAt).toBeDefined();
      expect(res.body.data.task.closedBy.toString()).toBe(pm._id.toString());
      expect(res.body.data.task.managerReview.status).toBe('approved');
    });

    it('TASKX-017: Verifies activity audit trail captures complete SDLC history', async () => {
      const task = await Task.findById(lifecycleTaskId);
      const actions = task.activityNotes.map((n) => n.action);

      expect(actions).toContain('submitted');
      expect(actions).toContain('changes_requested');
      expect(actions).toContain('approved');
    });
  });
});
