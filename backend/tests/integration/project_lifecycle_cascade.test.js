const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');
const Task = require('../../src/models/Task');
const Review = require('../../src/models/Review');
const CollabSession = require('../../src/models/CollabSession');
const Notification = require('../../src/models/Notification');

describe('Project Lifecycle & Cascading Integrity (PROJX-001 to PROJX-012)', () => {
  let owner, member, invitee, stranger;
  let ownerToken, memberToken, inviteeToken, strangerToken;

  beforeAll(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await Review.deleteMany({});
    await CollabSession.deleteMany({});
    await Notification.deleteMany({});

    owner = await User.create({ name: 'Project Owner', email: 'owner@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    member = await User.create({ name: 'Team Member', email: 'member@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    invitee = await User.create({ name: 'Invitee Candidate', email: 'invitee@devcollab.com', password: 'Password123!', role: 'user', isVerified: true });
    stranger = await User.create({ name: 'Stranger Danger', email: 'stranger@external.com', password: 'Password123!', role: 'user', isVerified: true });

    const oRes = await request(app).post('/api/v1/auth/login').send({ email: owner.email, password: 'Password123!' });
    ownerToken = oRes.body.data.accessToken;

    const mRes = await request(app).post('/api/v1/auth/login').send({ email: member.email, password: 'Password123!' });
    memberToken = mRes.body.data.accessToken;

    const iRes = await request(app).post('/api/v1/auth/login').send({ email: invitee.email, password: 'Password123!' });
    inviteeToken = iRes.body.data.accessToken;

    const sRes = await request(app).post('/api/v1/auth/login').send({ email: stranger.email, password: 'Password123!' });
    strangerToken = sRes.body.data.accessToken;
  });

  describe('Project Creation & Membership Management (PROJX-001 to PROJX-006)', () => {
    let projectId;

    it('PROJX-001: Owner creates private project with PM privileges and automated test bot team', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'FinTech Payment Microservice',
          description: 'Payment gateway integration with stripe and paypal',
          visibility: 'private',
          tags: ['payments', 'node', 'security'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.project.name).toBe('FinTech Payment Microservice');
      expect(res.body.data.project.owner.toString()).toBe(owner._id.toString());
      projectId = res.body.data.project._id;
    });

    it('PROJX-002: Project Manager invites new team member with specific role', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: member.email, role: 'contributor' });

      expect(res.status).toBe(200);
      const isMember = res.body.data.project.members.some(
        (m) => (m.user?._id || m.user).toString() === member._id.toString()
      );
      expect(isMember).toBe(true);

      // Verifies notification was dispatched
      const notif = await Notification.findOne({ recipient: member._id, type: 'project_invite' });
      expect(notif).toBeDefined();
    });

    it('PROJX-003: Prevents duplicate member invitation', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: member.email, role: 'contributor' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already a member/i);
    });

    it('PROJX-004: Non-owner member cannot add other members (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/invite`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ email: invitee.email, role: 'contributor' });

      expect(res.status).toBe(403);
    });

    it('PROJX-005: Project Manager updates project status (active -> on_hold -> active)', async () => {
      const holdRes = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'on_hold' });

      expect(holdRes.status).toBe(200);
      expect(holdRes.body.data.project.status).toBe('on_hold');

      const resumeRes = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'active' });

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.data.project.status).toBe('active');
    });

    it('PROJX-006: Stranger non-member cannot view private project details (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Project Deletion & Cascading Record Cleanup (PROJX-007 to PROJX-012)', () => {
    let cascadeProjectId;

    beforeAll(async () => {
      const proj = await Project.create({
        name: 'Cascade Deletion Target',
        owner: owner._id,
        members: [{ user: owner._id, role: 'project_manager' }],
      });
      cascadeProjectId = proj._id;

      // Seed child records
      await Task.create({
        title: 'Cascade Task',
        project: cascadeProjectId,
        createdBy: owner._id,
      });

      await Review.create({
        title: 'Cascade Review',
        project: cascadeProjectId,
        author: owner._id,
        code: 'const x = 1;',
      });

      await CollabSession.create({
        title: 'Cascade Collab',
        project: cascadeProjectId,
        createdBy: owner._id,
        code: 'console.log()',
      });
    });

    it('PROJX-007: Non-owner cannot delete project (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${cascadeProjectId}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
    });

    it('PROJX-008: Owner deletes project and cascades all dependent records', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${cascadeProjectId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);

      // Verify cascading integrity
      const tasksRemaining = await Task.countDocuments({ project: cascadeProjectId });
      const reviewsRemaining = await Review.countDocuments({ project: cascadeProjectId });
      const collabsRemaining = await CollabSession.countDocuments({ project: cascadeProjectId });

      expect(tasksRemaining).toBe(0);
      expect(reviewsRemaining).toBe(0);
      expect(collabsRemaining).toBe(0);
    });
  });
});
