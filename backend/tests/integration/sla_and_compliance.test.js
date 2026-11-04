const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');
const Task = require('../../src/models/Task');
const { SLA_POLICIES, computeSlaDeadlines, evaluateTaskSla, formatDuration } = require('../../src/utils/sla');

describe('Enterprise SLA Engine & SDLC Compliance Hierarchy (SLA-001 to SLA-016, ROLE-001 to ROLE-014)', () => {
  let pmUser, devUser, qaUser, viewerUser, outsiderUser;
  let pmToken, devToken, qaToken, viewerToken, outsiderToken;
  let project, devTask, qaTask;

  beforeAll(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});

    // 1. Create Users (User model role is 'user' or 'admin'; project-level role is in project.members)
    pmUser = await User.create({ name: 'PM Alice', email: 'pm.alice@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    devUser = await User.create({ name: 'Dev Bob', email: 'dev.bob@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    qaUser = await User.create({ name: 'QA Charlie', email: 'qa.charlie@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    viewerUser = await User.create({ name: 'Viewer Dave', email: 'viewer.dave@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    outsiderUser = await User.create({ name: 'Eve Outsider', email: 'eve.outsider@external.com', password: 'Password123!', role: 'user', isVerified: true });

    // Login tokens
    const pmLogin = await request(app).post('/api/v1/auth/login').send({ email: pmUser.email, password: 'Password123!' });
    pmToken = pmLogin.body.data.accessToken;

    const devLogin = await request(app).post('/api/v1/auth/login').send({ email: devUser.email, password: 'Password123!' });
    devToken = devLogin.body.data.accessToken;

    const qaLogin = await request(app).post('/api/v1/auth/login').send({ email: qaUser.email, password: 'Password123!' });
    qaToken = qaLogin.body.data.accessToken;

    const viewerLogin = await request(app).post('/api/v1/auth/login').send({ email: viewerUser.email, password: 'Password123!' });
    viewerToken = viewerLogin.body.data.accessToken;

    const outsiderLogin = await request(app).post('/api/v1/auth/login').send({ email: outsiderUser.email, password: 'Password123!' });
    outsiderToken = outsiderLogin.body.data.accessToken;

    // 2. Create Project with PM Alice as owner
    project = await Project.create({
      name: 'SDLC Compliance Demo',
      description: 'Project to verify SLA policies and strict SDLC hierarchy',
      owner: pmUser._id,
      members: [
        { user: pmUser._id, role: 'project_manager' },
        { user: devUser._id, role: 'contributor' },
        { user: qaUser._id, role: 'contributor' },
        { user: viewerUser._id, role: 'viewer' },
      ],
      visibility: 'private',
    });

    // 3. Create Tasks
    devTask = await Task.create({
      title: 'Dev Core Engine',
      description: 'Implement core functionality',
      project: project._id,
      createdBy: pmUser._id,
      assignees: [devUser._id],
      column: 'todo',
      priority: 'high',
      targetRole: 'backend_developer',
    });

    qaTask = await Task.create({
      title: 'QA Performance Benchmark',
      description: 'Run load and stress suite',
      project: project._id,
      createdBy: pmUser._id,
      assignees: [qaUser._id],
      column: 'in_progress',
      priority: 'critical',
      targetRole: 'qa_tester',
      startedAt: new Date(),
    });
  });

  describe('SLA Policy Calculations & Boundary Conditions (SLA-001 to SLA-016)', () => {
    it('SLA-001: Verifies SLA policy definitions match enterprise SLA specification', () => {
      expect(SLA_POLICIES.critical.responseHours).toBe(2);
      expect(SLA_POLICIES.critical.resolutionHours).toBe(8);

      expect(SLA_POLICIES.high.responseHours).toBe(6);
      expect(SLA_POLICIES.high.resolutionHours).toBe(24);

      expect(SLA_POLICIES.medium.responseHours).toBe(24);
      expect(SLA_POLICIES.medium.resolutionHours).toBe(72);

      expect(SLA_POLICIES.low.responseHours).toBe(48);
      expect(SLA_POLICIES.low.resolutionHours).toBe(168);
    });

    it('SLA-002: Computes response and resolution deadlines accurately from creation', () => {
      const now = new Date('2026-11-04T10:00:00Z');
      const { responseDeadline, resolutionDeadline } = computeSlaDeadlines('critical', now);

      expect(responseDeadline.toISOString()).toBe('2026-11-04T12:00:00.000Z'); // 2 hours
      expect(resolutionDeadline.toISOString()).toBe('2026-11-04T18:00:00.000Z'); // 8 hours
    });

    it('SLA-003: Computes formatDuration accurately for human-readable SLA displays', () => {
      expect(formatDuration(45 * 60 * 1000)).toBe('45m');
      expect(formatDuration(2 * 3600 * 1000 + 15 * 60 * 1000)).toBe('2h 15m');
      expect(formatDuration(26 * 3600 * 1000)).toBe('1d 2h');
    });

    it('SLA-004: Evaluates healthy task within response and resolution windows', () => {
      const now = Date.now();
      const task = {
        priority: 'critical',
        column: 'todo',
        createdAt: new Date(now - 30 * 60 * 1000), // 30 mins ago
      };
      const sla = evaluateTaskSla(task);
      expect(sla.state).toBe('healthy');
      expect(sla.responseBreached).toBe(false);
      expect(sla.resolutionBreached).toBe(false);
      expect(sla.badgeColor).toBe('sky');
    });

    it('SLA-005: Evaluates response breach when unstarted past response deadline', () => {
      const now = Date.now();
      const task = {
        priority: 'critical',
        column: 'todo',
        createdAt: new Date(now - 3 * 3600 * 1000), // 3 hours ago (> 2h limit)
      };
      const sla = evaluateTaskSla(task);
      expect(sla.state).toBe('breached');
      expect(sla.responseBreached).toBe(true);
      expect(sla.badgeColor).toBe('rose');
    });

    it('SLA-006: Evaluates at_risk status when resolution deadline is approaching', () => {
      const now = Date.now();
      const task = {
        priority: 'critical',
        column: 'in_progress',
        startedAt: new Date(now - 6 * 3600 * 1000),
        createdAt: new Date(now - 6.5 * 3600 * 1000),
      };
      const sla = evaluateTaskSla(task);
      expect(sla.state).toBe('at_risk');
      expect(sla.badgeColor).toBe('amber');
    });

    it('SLA-007: Evaluates resolution breach when resolution time is exceeded', () => {
      const now = Date.now();
      const task = {
        priority: 'critical',
        column: 'in_progress',
        startedAt: new Date(now - 8 * 3600 * 1000),
        createdAt: new Date(now - 9 * 3600 * 1000), // 9 hours (> 8h)
      };
      const sla = evaluateTaskSla(task);
      expect(sla.state).toBe('breached');
      expect(sla.resolutionBreached).toBe(true);
      expect(sla.badgeColor).toBe('rose');
    });

    it('SLA-008: Evaluates fulfilled SLA when completed within deadline', () => {
      const now = Date.now();
      const task = {
        priority: 'critical',
        column: 'done',
        createdAt: new Date(now - 4 * 3600 * 1000),
        completedAt: new Date(now - 1 * 3600 * 1000), // Completed in 3 hours (< 8h)
      };
      const sla = evaluateTaskSla(task);
      expect(sla.state).toBe('fulfilled');
      expect(sla.resolutionBreached).toBe(false);
      expect(sla.badgeColor).toBe('emerald');
    });

    it('SLA-009: API /api/v1/board/:projectId returns aggregated SLA summary metrics', async () => {
      const res = await request(app)
        .get(`/api/v1/board/${project._id}`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.slaSummary).toBeDefined();
      expect(typeof res.body.data.slaSummary.complianceRate).toBe('number');
      expect(res.body.data.slaSummary.total).toBeGreaterThan(0);
    });
  });

  describe('SDLC Role Hierarchy & Compliance Controls (ROLE-001 to ROLE-014)', () => {
    it('ROLE-001: Contributor CAN move their assigned ticket from todo to in_progress', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${devTask._id}/move`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ column: 'in_progress', order: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('in_progress');
      expect(res.body.data.task.startedAt).toBeDefined();
    });

    it('ROLE-002: Contributor CANNOT move ticket directly to done (Strict PM Sign-off)', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${devTask._id}/move`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ column: 'done', order: 0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Compliance Restriction.*Project Manager/i);
    });

    it('ROLE-003: Contributor CANNOT move another developer assigned ticket', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${qaTask._id}/move`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ column: 'review', order: 0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Permission Denied.*assigned/i);
    });

    it('ROLE-004: Contributor submits resolution notes and moves ticket to Review', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${devTask._id}/resolve`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          notes: 'Completed core engine logic with all unit tests passing.',
          column: 'review',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('review');
      expect(res.body.data.task.completedByAssignee).toBe(true);
      expect(res.body.data.task.resolutionNotes).toBe('Completed core engine logic with all unit tests passing.');
      expect(res.body.data.task.managerReview.status).toBe('pending');
    });

    it('ROLE-005: Contributor CANNOT drag ticket out of Review (Review Lock)', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${devTask._id}/move`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ column: 'in_progress', order: 0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Compliance Restriction.*under PM Review/i);
    });

    it('ROLE-006: Non-PM CANNOT sign off on Review (reviewTask)', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${devTask._id}/manager-review`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ status: 'approved', feedback: 'Self approval attempt' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Only the Project Manager/i);
    });

    it('ROLE-007: Project Manager reviews and requests revisions (routes back to in_progress)', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${devTask._id}/manager-review`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'rejected',
          feedback: 'Please add validation checks for edge cases in auth tokens.',
          routeToColumn: 'in_progress',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('in_progress');
      expect(res.body.data.task.completedByAssignee).toBe(false);
      expect(res.body.data.task.managerReview.status).toBe('rejected');
      expect(res.body.data.task.managerReview.feedback).toBe('Please add validation checks for edge cases in auth tokens.');
    });

    it('ROLE-008: Contributor resubmits revised work for PM sign-off', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${devTask._id}/resolve`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          notes: 'Added token validation edge case checks and regression suite.',
          column: 'review',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('review');
    });

    it('ROLE-009: Project Manager approves ticket and signs off into Done', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${devTask._id}/manager-review`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          status: 'approved',
          feedback: 'Excellent work. Verified and signed off for production.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.task.column).toBe('done');
      expect(res.body.data.task.closedAt).toBeDefined();
      expect(res.body.data.task.managerReview.status).toBe('approved');
    });

    it('ROLE-010: Viewer role CANNOT create tasks (Read-Only Enforcement)', async () => {
      const res = await request(app)
        .post(`/api/v1/board/${project._id}/tasks`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Unauthorized Task by Viewer',
          column: 'todo',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Viewers have read-only access/i);
    });

    it('ROLE-011: Viewer role CANNOT move tasks', async () => {
      const res = await request(app)
        .patch(`/api/v1/board/tasks/${qaTask._id}/move`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ column: 'review', order: 0 });

      expect(res.status).toBe(403);
    });

    it('ROLE-012: Outsider non-member CANNOT access project board or tasks (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/board/${project._id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/i);
    });
  });
});
