const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');

let token, userId;

beforeAll(async () => {
  await User.deleteMany({});
  await Project.deleteMany({});

  const user = await User.create({ name: 'Project Tester', email: 'proj@test.com', password: 'Password123', isVerified: true, canCreateProjects: true });
  userId = user._id;
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'proj@test.com', password: 'Password123' });
  token = res.body.data.accessToken;
});


describe('Projects CRUD', () => {
  let projectId;

  it('creates a project', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Project', description: 'A test project', visibility: 'private' });
    expect(res.status).toBe(201);
    expect(res.body.data.project.name).toBe('Test Project');
    projectId = res.body.data.project._id;
  });

  it('lists user projects', async () => {
    const res = await request(app).get('/api/v1/projects').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.projects.length).toBeGreaterThan(0);
  });

  it('gets a single project', async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.project._id).toBe(projectId);
  });

  it('updates a project', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Project' });
    expect(res.status).toBe(200);
    expect(res.body.data.project.name).toBe('Updated Project');
  });

  it('deletes a project', async () => {
    const res = await request(app).delete(`/api/v1/projects/${projectId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
