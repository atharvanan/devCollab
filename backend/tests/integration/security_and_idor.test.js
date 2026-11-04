const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');
const Task = require('../../src/models/Task');
const Review = require('../../src/models/Review');
const SecurityAudit = require('../../src/models/SecurityAudit');
const Notification = require('../../src/models/Notification');
const { escapeHtml } = require('../../src/services/email.service');
const { isTestBotEmail } = require('../../src/utils/testBots');

describe('Security & Vulnerability Remediation Suite (SEC-001 to SEC-020, D-01 to D-23)', () => {
  let aliceUser, bobUser, eveOutsider;
  let aliceToken, bobToken, eveToken;
  let privateProject, aliceTask, aliceReview;

  beforeAll(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await Review.deleteMany({});
    await SecurityAudit.deleteMany({});
    await Notification.deleteMany({});

    aliceUser = await User.create({
      name: 'Alice Manager',
      email: 'alice.pm@company.com',
      password: 'Password123!',
      role: 'user',
      isVerified: true,
    });

    bobUser = await User.create({
      name: 'Bob Developer',
      email: 'bob.dev@company.com',
      password: 'Password123!',
      role: 'user',
      isVerified: true,
    });

    eveOutsider = await User.create({
      name: 'Eve Malicious',
      email: 'eve.hacker@darkweb.org',
      password: 'Password123!',
      role: 'user',
      isVerified: true,
    });

    const aLog = await request(app).post('/api/v1/auth/login').send({ email: aliceUser.email, password: 'Password123!' });
    aliceToken = aLog.body.data.accessToken;

    const bLog = await request(app).post('/api/v1/auth/login').send({ email: bobUser.email, password: 'Password123!' });
    bobToken = bLog.body.data.accessToken;

    const eLog = await request(app).post('/api/v1/auth/login').send({ email: eveOutsider.email, password: 'Password123!' });
    eveToken = eLog.body.data.accessToken;

    privateProject = await Project.create({
      name: 'Top Secret Falcon Project',
      description: 'Confidential corporate intellectual property',
      owner: aliceUser._id,
      members: [
        { user: aliceUser._id, role: 'project_manager' },
        { user: bobUser._id, role: 'contributor' },
      ],
      visibility: 'private',
    });

    aliceTask = await Task.create({
      title: 'Confidential Falcon Blueprint',
      description: 'Proprietary design architecture',
      project: privateProject._id,
      createdBy: aliceUser._id,
      assignees: [bobUser._id],
      column: 'in_progress',
      priority: 'high',
    });

    aliceReview = await Review.create({
      title: 'Falcon Core Cryptographic Key Engine',
      description: 'Proprietary source code for internal audit',
      project: privateProject._id,
      author: aliceUser._id,
      code: 'const SECRET_CIPHER = "FALCON-998877-CLASSIFIED";\nfunction encrypt() { return true; }',
      language: 'javascript',
      status: 'open',
    });
  });

  describe('D-01 & D-08: Task IDOR & Mass Assignment Prevention', () => {
    it('SEC-001: Blocks outsider from viewing private project tasks (IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/board/${privateProject._id}`)
        .set('Authorization', `Bearer ${eveToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/i);
    });

    it('SEC-002: Blocks outsider from modifying tasks in a project they do not belong to', async () => {
      const res = await request(app)
        .put(`/api/v1/board/tasks/${aliceTask._id}`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send({ title: 'Hacked by Eve' });

      expect(res.status).toBe(403);
    });

    it('SEC-003: Blocks outsider from deleting tasks in foreign projects', async () => {
      const res = await request(app)
        .delete(`/api/v1/board/tasks/${aliceTask._id}`)
        .set('Authorization', `Bearer ${eveToken}`);

      expect(res.status).toBe(403);
    });

    it('SEC-004: Sanitizes mass-assignment on task creation (strips managerReview & closedAt)', async () => {
      const res = await request(app)
        .post(`/api/v1/board/${privateProject._id}/tasks`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          title: 'Tampered Ticket',
          column: 'done', // Contributor tries to force done immediately
          managerReview: { status: 'approved' },
          closedAt: new Date(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.task.column).not.toBe('done');
      expect(res.body.data.task.managerReview?.status).not.toBe('approved');
    });

    it('SEC-016: Rejects assigning task to non-member on task creation (TASK-009, ROLE-013)', async () => {
      const res = await request(app)
        .post(`/api/v1/board/${privateProject._id}/tasks`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          title: 'Unauthorized Outsider Assignment',
          assignees: [eveOutsider._id], // Eve is not a member of privateProject
          column: 'todo',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot assign task to a non-member/i);
    });

    it('SEC-017: Rejects updating task assignees to include non-member (AUTO-TASK-005, ROLE-013)', async () => {
      const res = await request(app)
        .put(`/api/v1/board/tasks/${aliceTask._id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          assignees: [eveOutsider._id],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot assign task to a non-member/i);
    });
  });

  describe('D-02: Code Review IDOR & Sensitive Code Protection', () => {
    it('SEC-005: Blocks unauthenticated user from accessing private reviews', async () => {
      const res = await request(app).get(`/api/v1/reviews/${aliceReview._id}`);
      expect(res.status).toBe(401);
    });

    it('SEC-006: Blocks outsider authenticated user from viewing private reviews (IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/reviews/${aliceReview._id}`)
        .set('Authorization', `Bearer ${eveToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/i);
    });

    it('SEC-007: Blocks outsider from injecting inline comments into private reviews', async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/${aliceReview._id}/comments/inline`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send({ lineNumber: 1, content: 'Malicious injection' });

      expect(res.status).toBe(403);
    });

    it('SEC-008: Blocks non-PM member from approving code review', async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${aliceReview._id}/status`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Only Project Managers can approve/i);
    });

    it('SEC-009: Allows Project Manager to approve code review', async () => {
      const res = await request(app)
        .patch(`/api/v1/reviews/${aliceReview._id}/status`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.data.review.status).toBe('approved');
    });
  });

  describe('D-11 & D-12: Authentication Hardening, OTP Security & Anti-Enumeration', () => {
    it('SEC-010: Locks user account for 15 minutes after 5 consecutive failed OTP attempts', async () => {
      const victim = await User.create({
        name: 'Victim User',
        email: 'victim@securecorp.com',
        password: 'Password123!',
        role: 'user',
        isVerified: false,
        otp: '999888',
        otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      });

      for (let i = 0; i < 4; i++) {
        const attempt = await request(app)
          .post('/api/v1/auth/verify-otp')
          .send({ email: victim.email, otp: '000000' });
        expect(attempt.status).toBe(400);
        expect(attempt.body.message).toMatch(/Invalid OTP/i);
      }

      const fifthAttempt = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: victim.email, otp: '000000' });

      expect(fifthAttempt.status).toBe(429);
      expect(fifthAttempt.body.message).toMatch(/Maximum OTP attempts exceeded.*locked/i);

      const lockedAttempt = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: victim.email, otp: '999888' });

      expect(lockedAttempt.status).toBe(429);
      expect(lockedAttempt.body.message).toMatch(/temporarily locked/i);
    });

    it('SEC-011: Eliminates account enumeration on forgot-password endpoint', async () => {
      const existingRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: aliceUser.email });

      const nonExistingRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'ghost.never.registered@fakedomain.xyz' });

      expect(existingRes.status).toBe(200);
      expect(nonExistingRes.status).toBe(200);
      expect(existingRes.body.message).toBe(nonExistingRes.body.message);
      expect(existingRes.body.data).toBeUndefined();
      expect(nonExistingRes.body.data).toBeUndefined();
    });
  });

  describe('D-13 & D-14: Injection Prevention (ReDoS & HTML Injection)', () => {
    it('SEC-012: Escapes regex special characters in searchUsers (prevents ReDoS & injection)', async () => {
      const res = await request(app)
        .get('/api/v1/users/search?q=.*+?^${}()|[]\\')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.users)).toBe(true);
    });

    it('SEC-013: Escapes HTML in user-supplied strings for email templates (XSS/HTMLi)', () => {
      const maliciousPayload = '<script>alert("pwned")</script><b>Bold</b>&"\'';
      const sanitized = escapeHtml(maliciousPayload);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).toContain('&quot;');
      expect(sanitized).toContain('&#039;');
      expect(sanitized).toContain('&amp;');
    });
  });

  describe('D-15, D-19 & PROJX-004: Bounded Pagination & Security Audit Retention Policy', () => {
    it('SEC-014: Bounds negative and out-of-range pagination parameters safely', async () => {
      const res = await request(app)
        .get('/api/v1/projects?page=-5&limit=9999')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('SEC-015 & SEC-018: Cascades project deletion while RETAINING compliance audit records', async () => {
      const tempProject = await Project.create({
        name: 'Audit Retention Demo Project',
        owner: aliceUser._id,
        members: [{ user: aliceUser._id, role: 'project_manager' }],
      });

      const tempTask = await Task.create({
        title: 'Child Task',
        project: tempProject._id,
        createdBy: aliceUser._id,
      });

      const tempReview = await Review.create({
        title: 'Child Review',
        project: tempProject._id,
        author: aliceUser._id,
        code: 'console.log(1)',
        language: 'javascript',
      });

      // Create a critical security audit record
      const tempAudit = await SecurityAudit.create({
        project: tempProject._id,
        user: bobUser._id,
        userRole: 'contributor',
        attemptedAction: 'unauthorized_code_modification',
        targetResource: 'code_review',
        targetDomain: 'security',
        details: 'Attempted to modify security firewall rules without authorization',
        severity: 'critical',
      });

      // Delete project
      const delRes = await request(app)
        .delete(`/api/v1/projects/${tempProject._id}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(delRes.status).toBe(200);

      // Operational tasks and reviews must be deleted
      const remainingTasks = await Task.find({ project: tempProject._id });
      const remainingReviews = await Review.find({ project: tempProject._id });
      expect(remainingTasks.length).toBe(0);
      expect(remainingReviews.length).toBe(0);

      // CRITICAL COMPLIANCE AUDIT RETENTION (SOC-2/ISO-27001): Audit log MUST be retained
      const preservedAudit = await SecurityAudit.findById(tempAudit._id);
      expect(preservedAudit).toBeDefined();
      expect(preservedAudit.projectDeleted).toBe(true);
      expect(preservedAudit.projectDeletedAt).toBeDefined();
    });
  });

  describe('Test Bot Production Security Isolation (BOT-001, BOT-008, BOT-009)', () => {
    it('SEC-019: Disables test-bot credential endpoint in production mode (BOT-001)', async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const res = await request(app)
          .get('/api/v1/projects/test/bot-credentials')
          .set('Authorization', `Bearer ${aliceToken}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/disabled in production/i);
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });

    it('SEC-020: Proves test-bot bypass cannot be activated in production (BOT-008, BOT-009)', () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // In production, isTestBotEmail must return FALSE for any email
        expect(isTestBotEmail('alex.frontend@devcollab.com')).toBe(false);
        expect(isTestBotEmail('attacker@devcollab.com')).toBe(false);
        expect(isTestBotEmail('hacker@external.com')).toBe(false);
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });

    it('SEC-021: Lookalike and domain suffix emails cannot hijack test-bot status (BOT-009)', () => {
      // Test that non-bot emails on the domain are NEVER treated as bots
      expect(isTestBotEmail('random_user@devcollab.com')).toBe(false);
      expect(isTestBotEmail('ceo@devcollab.com')).toBe(false);
      expect(isTestBotEmail('alex.frontend@devcollab.com.fake.com')).toBe(false);
      expect(isTestBotEmail('alex.frontend+evil@devcollab.com')).toBe(false);
    });
  });
});
