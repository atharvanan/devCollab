const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');
const CollabSession = require('../../src/models/CollabSession');
const Review = require('../../src/models/Review');
const SecurityAudit = require('../../src/models/SecurityAudit');
const Notification = require('../../src/models/Notification');
const { generateAccessToken } = require('../../src/utils/jwt');

describe('QA End-to-End & Edge Cases Test Suite', () => {
  let pmUser, devUser, qaUser, pmToken, devToken, qaToken, project;

  beforeEach(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    await CollabSession.deleteMany({});
    await Review.deleteMany({});
    await SecurityAudit.deleteMany({});
    await Notification.deleteMany({});

    // 1. PM User
    pmUser = await User.create({
      name: 'Sarah ProjectManager',
      email: 'pm@example.com',
      password: 'StrongPassword123',
      isVerified: true,
      role: 'admin',
    });

    // 2. Dev User (Frontend)
    devUser = await User.create({
      name: 'Dave Developer',
      email: 'dave@example.com',
      password: 'StrongPassword123',
      isVerified: true,
    });

    // 3. QA Tester User
    qaUser = await User.create({
      name: 'Quinn Tester',
      email: 'qa@example.com',
      password: 'StrongPassword123',
      isVerified: true,
    });

    pmToken = generateAccessToken(pmUser._id);
    devToken = generateAccessToken(devUser._id);
    qaToken = generateAccessToken(qaUser._id);

    project = await Project.create({
      name: 'Mission Critical Platform',
      description: 'End-to-end collaborative platform with strict compliance',
      owner: pmUser._id,
      members: [
        { user: devUser._id, role: 'frontend_developer' },
        { user: qaUser._id, role: 'qa_tester' },
      ],
    });
  });

  describe('1. Authentication & Password Reset Edge Cases', () => {
    it('EDGE CASE: Rejects invalid email format in forgot-password', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'invalid-email-string',
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('EDGE CASE: Non-existent user returns 200 without exposing user absence', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'nobody@nowhere.com',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeUndefined(); // no devOtp leaked
    });

    it('EDGE CASE: Rejects reset-password with password shorter than 8 chars', async () => {
      await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'dave@example.com',
      });
      const user = await User.findOne({ email: 'dave@example.com' }).select('+resetPasswordOtp');

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'dave@example.com',
        otp: user.resetPasswordOtp,
        password: '123', // < 8 characters
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('EDGE CASE: Rejects reset-password when OTP has expired', async () => {
      await User.updateOne(
        { email: 'dave@example.com' },
        {
          resetPasswordOtp: '112233',
          resetPasswordExpires: new Date(Date.now() - 5 * 60 * 1000), // expired 5 mins ago
        }
      );

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'dave@example.com',
        otp: '112233',
        password: 'ValidBrandNewPassword123',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });

    it('EDGE CASE: Resetting password verifies previously unverified user', async () => {
      const unverified = await User.create({
        name: 'Unverified Joe',
        email: 'joe@example.com',
        password: 'InitialPassword123',
        isVerified: false,
        resetPasswordOtp: '445566',
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
      });

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        email: 'joe@example.com',
        otp: '445566',
        password: 'NewVerifiedPassword123',
      });

      expect(res.status).toBe(200);

      // Verify user in DB is now marked isVerified: true
      const updated = await User.findById(unverified._id);
      expect(updated.isVerified).toBe(true);

      // Joe can now log in directly!
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'joe@example.com',
        password: 'NewVerifiedPassword123',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.accessToken).toBeDefined();
    });
  });

  describe('2. Real-Time Collaborative Coding & Contribution Share Edge Cases', () => {
    it('EDGE CASE: Handles empty code and zero contributions without NaN', async () => {
      const session = await CollabSession.create({
        project: project._id,
        createdBy: pmUser._id,
        title: 'Empty Code Session',
        code: '',
        contributors: [],
      });

      const res = await request(app)
        .put(`/api/v1/collab/${session._id}/code`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          code: 'const x = 1;',
          charsDelta: 12,
          linesDelta: 1,
        });

      expect(res.status).toBe(200);
      const updated = res.body.data.session;
      expect(updated.contributors.length).toBe(1);
      expect(updated.contributors[0].percentage).toBe(100);
      expect(isNaN(updated.contributors[0].percentage)).toBe(false);
    });

    it('EDGE CASE: Multi-user pair programming calculates accurate proportional shares', async () => {
      const session = await CollabSession.create({
        project: project._id,
        createdBy: pmUser._id,
        title: 'Multi-User Pair Coding',
        code: '// initial\n',
        contributors: [
          {
            user: pmUser._id,
            name: pmUser.name,
            charactersAdded: 100,
            percentage: 100,
          },
        ],
      });

      // Dave (Frontend Dev) contributes 100 characters
      const daveRes = await request(app)
        .put(`/api/v1/collab/${session._id}/code`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          code: '// initial\nfunction renderUI() { return "<div>Hello</div>"; }',
          activeLine: 2,
          charsDelta: 100,
          linesDelta: 1,
        });

      expect(daveRes.status).toBe(200);
      let contribs = daveRes.body.data.session.contributors;
      expect(contribs.find((c) => c.user.toString() === pmUser._id.toString()).percentage).toBe(50);
      expect(contribs.find((c) => c.user.toString() === devUser._id.toString()).percentage).toBe(50);

      // Quinn (QA Tester) contributes 200 characters (e.g. test specs)
      const qaRes = await request(app)
        .put(`/api/v1/collab/${session._id}/code`)
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          code: '// initial\nfunction renderUI() { return "<div>Hello</div>"; }\ndescribe("UI", () => { it("works", () => expect(true).toBe(true)); });',
          activeLine: 3,
          charsDelta: 200,
          linesDelta: 1,
        });

      expect(qaRes.status).toBe(200);
      contribs = qaRes.body.data.session.contributors;
      // Total = 100 + 100 + 200 = 400. PM: 25%, Dave: 25%, QA: 50%
      expect(contribs.find((c) => c.user.toString() === pmUser._id.toString()).percentage).toBe(25);
      expect(contribs.find((c) => c.user.toString() === devUser._id.toString()).percentage).toBe(25);
      expect(contribs.find((c) => c.user.toString() === qaUser._id.toString()).percentage).toBe(50);
    });

    it('EDGE CASE: Non-project member cannot access or modify collaborative session', async () => {
      const outsider = await User.create({
        name: 'Eve Intruder',
        email: 'eve@example.com',
        password: 'Password123',
        isVerified: true,
      });

      const outsiderLogin = await request(app).post('/api/v1/auth/login').send({
        email: 'eve@example.com',
        password: 'Password123',
      });
      const outsiderToken = outsiderLogin.body.data.accessToken;

      const session = await CollabSession.create({
        project: project._id,
        createdBy: pmUser._id,
        title: 'Confidential Algorithm',
        code: 'const secret = "42";',
      });

      const getRes = await request(app)
        .get(`/api/v1/collab/${session._id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(getRes.status).toBe(403);

      const putRes = await request(app)
        .put(`/api/v1/collab/${session._id}/code`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ code: 'hacked' });

      expect(putRes.status).toBe(403);
    });

    it('EDGE CASE: Role Boundary Guard triggers SecurityAudit and notifies PM on unauthorized domain', async () => {
      // Dave is frontend_developer. Cannot edit database domain!
      const dbSession = await CollabSession.create({
        project: project._id,
        createdBy: pmUser._id,
        title: 'Database Schema Design',
        code: 'CREATE TABLE orders (id INT);',
        language: 'sql',
        domain: 'database',
      });

      const res = await request(app)
        .put(`/api/v1/collab/${dbSession._id}/code`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          code: 'ALTER TABLE orders ADD COLUMN price DECIMAL;',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Compliance Violation/i);

      // Verify a SecurityAudit record was created
      const audit = await SecurityAudit.findOne({
        project: project._id,
        user: devUser._id,
        attemptedAction: 'UNAUTHORIZED_COLLAB_EDIT',
      });
      expect(audit).toBeDefined();
      expect(audit.targetDomain).toBe('database');
      expect(audit.severity).toBe('high');

      // Verify PM was sent a security alert notification
      const notification = await Notification.findOne({
        recipient: pmUser._id,
        type: 'security_violation',
      });
      expect(notification).toBeDefined();
      expect(notification.message).toMatch(/blocked from modifying database/i);
    });

    it('EDGE CASE: Exporting collaborative code with TypeScript/Python syntax generates Code Review successfully without text index crash', async () => {
      const session = await CollabSession.create({
        project: project._id,
        createdBy: pmUser._id,
        title: 'TypeScript Data Pipeline',
        code: 'interface PipelineConfig {\n  batchSize: number;\n  retries: number;\n}\n\nexport const run = (cfg: PipelineConfig) => true;',
        language: 'typescript',
        domain: 'general',
        contributors: [
          { user: pmUser._id, name: pmUser.name, charactersAdded: 60, percentage: 60 },
          { user: devUser._id, name: devUser.name, charactersAdded: 40, percentage: 40 },
        ],
      });

      const res = await request(app)
        .post(`/api/v1/collab/${session._id}/export-review`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          title: 'PR: TypeScript Pipeline Implementation',
          description: 'Tested and verified by pair-programming team',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const review = await Review.findById(res.body.data.review._id);
      expect(review).toBeDefined();
      expect(review.language).toBe('typescript');
      expect(review.reviewers.length).toBe(1);
      expect(review.reviewers[0].toString()).toBe(devUser._id.toString());

      // Verify notification sent to co-author
      const notif = await Notification.findOne({
        recipient: devUser._id,
        type: 'review_assigned',
      });
      expect(notif).toBeDefined();
    });

    it('EDGE CASE: Supports all programming languages (JSX, Java, C++, C#) in Code Reviews without MongoDB language override error', async () => {
      const languages = ['javascript', 'jsx', 'tsx', 'java', 'cpp', 'csharp', 'python', 'go', 'rust'];

      for (const lang of languages) {
        const res = await request(app)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${pmToken}`)
          .send({
            projectId: project._id,
            title: `Review in ${lang.toUpperCase()}`,
            description: `Testing language support for ${lang}`,
            code: `// Sample code for ${lang}\nconsole.log("Working!");`,
            language: lang,
            domain: 'general',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.review.language).toBe(lang);
      }
    });

    it('PROJECT LIFECYCLE: PM can update project status to on_hold, completed, active, and delete project with cascade cleanup', async () => {
      // 1. Put project on hold
      let res = await request(app)
        .patch(`/api/v1/projects/${project._id}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ status: 'on_hold' });
      expect(res.status).toBe(200);
      expect(res.body.data.project.status).toBe('on_hold');

      // 2. Mark project completed
      res = await request(app)
        .patch(`/api/v1/projects/${project._id}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.data.project.status).toBe('completed');

      // 3. Resume active
      res = await request(app)
        .patch(`/api/v1/projects/${project._id}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ status: 'active' });
      expect(res.status).toBe(200);
      expect(res.body.data.project.status).toBe('active');

      // 4. Delete project with cascading cleanup
      res = await request(app)
        .delete(`/api/v1/projects/${project._id}`)
        .set('Authorization', `Bearer ${pmToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deletedProj = await Project.findById(project._id);
      expect(deletedProj).toBeNull();
    });

    it('TEST BOTS: Can seed multi-role test bots to project and verify bot login', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${project._id}/seed-bots`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bots.length).toBe(5);

      // Verify a bot can login with their credentials
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'alex.frontend@devcollab.com',
          password: 'DevCollab123!',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.accessToken).toBeDefined();
      expect(loginRes.body.data.devOtp).toBeUndefined(); // devOtp should not leak!
    });

    it('SECURITY: Forgot password does NOT leak devOtp in response', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: devUser.email });

      expect(res.status).toBe(200);
      expect(res.body.data?.devOtp).toBeUndefined();
    });
  });
});
