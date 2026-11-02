const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');
const CollabSession = require('../../src/models/CollabSession');
const Review = require('../../src/models/Review');

describe('Collaborative Coding & Share Tracking API', () => {
  let userA, userB, tokenA, tokenB, project;

  beforeEach(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    await CollabSession.deleteMany({});
    await Review.deleteMany({});

    userA = await User.create({
      name: 'Alice PM',
      email: 'alice@example.com',
      password: 'Password123',
      isVerified: true,
    });

    userB = await User.create({
      name: 'Bob Frontend',
      email: 'bob@example.com',
      password: 'Password123',
      isVerified: true,
    });

    const loginA = await request(app).post('/api/v1/auth/login').send({
      email: 'alice@example.com',
      password: 'Password123',
    });
    tokenA = loginA.body.data.accessToken;

    const loginB = await request(app).post('/api/v1/auth/login').send({
      email: 'bob@example.com',
      password: 'Password123',
    });
    tokenB = loginB.body.data.accessToken;

    project = await Project.create({
      name: 'Alpha Collab Project',
      owner: userA._id,
      members: [{ user: userB._id, role: 'frontend_developer' }],
    });
  });

  it('scaffolds an initial collaborative session when none exists', async () => {
    const res = await request(app)
      .get(`/api/v1/collab/project/${project._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessions.length).toBe(1);
    expect(res.body.data.sessions[0].title).toBe('Main Collaborative Scratchpad');
  });

  it('creates a new collaborative coding session', async () => {
    const res = await request(app)
      .post(`/api/v1/collab/project/${project._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Authentication Module Live Session',
        description: 'Pair programming on login and JWT verification',
        code: 'function verifyToken() { return true; }',
        language: 'javascript',
        domain: 'general',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session.title).toBe('Authentication Module Live Session');
    expect(res.body.data.session.contributors.length).toBe(1);
  });

  it('updates code and accurately computes contribution share percentages', async () => {
    const session = await CollabSession.create({
      project: project._id,
      createdBy: userA._id,
      title: 'Realtime Share Test',
      code: 'console.log("hello");',
      contributors: [
        {
          user: userA._id,
          name: userA.name,
          charactersAdded: 50,
          linesContributed: 2,
          percentage: 100,
        },
      ],
    });

    // User B (Bob) contributes 50 characters to the code
    const res = await request(app)
      .put(`/api/v1/collab/${session._id}/code`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        code: 'console.log("hello");\nconst greet = (name) => `Hi ${name}`;',
        activeLine: 2,
        charsDelta: 50,
        linesDelta: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = res.body.data.session;
    expect(updated.contributors.length).toBe(2);

    const contribA = updated.contributors.find((c) => c.user.toString() === userA._id.toString());
    const contribB = updated.contributors.find((c) => c.user.toString() === userB._id.toString());

    expect(contribA).toBeDefined();
    expect(contribB).toBeDefined();
    // 50 chars each -> 50% each
    expect(contribA.percentage).toBe(50);
    expect(contribB.percentage).toBe(50);

    // Check line attribution
    const attrLine2 = updated.lineAttributions.find((l) => l.lineNumber === 2);
    expect(attrLine2).toBeDefined();
    expect(attrLine2.authorName).toBe(userB.name);
  });

  it('exports a collaborative session to a formal Code Review with contributors tagged', async () => {
    const session = await CollabSession.create({
      project: project._id,
      createdBy: userA._id,
      title: 'Review Export Session',
      code: 'export const util = () => true;',
      language: 'typescript',
      domain: 'general',
      contributors: [
        { user: userA._id, name: userA.name, charactersAdded: 30, percentage: 50 },
        { user: userB._id, name: userB.name, charactersAdded: 30, percentage: 50 },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/collab/${session._id}/export-review`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'PR: Exported Collaborative Utils',
        description: 'Exported from our live pair-programming session',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.review).toBeDefined();
    expect(res.body.data.review.code).toBe('export const util = () => true;');
    expect(res.body.data.review.reviewers.length).toBe(1);
    expect(res.body.data.review.reviewers[0].toString()).toBe(userB._id.toString());
  });

  it('enforces role compliance when a member attempts unauthorized domain edits', async () => {
    // Bob is frontend_developer. If session is database domain:
    const dbSession = await CollabSession.create({
      project: project._id,
      createdBy: userA._id,
      title: 'Database Schema Session',
      code: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
      language: 'sql',
      domain: 'database',
    });

    const res = await request(app)
      .put(`/api/v1/collab/${dbSession._id}/code`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        code: 'DROP TABLE users;',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Compliance Violation/i);
  });
});
