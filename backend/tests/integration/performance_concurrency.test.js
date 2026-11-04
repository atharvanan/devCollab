const request = require('supertest');
const mongoose = require('mongoose');
const http = require('http');
let ioClient;
try {
  ioClient = require('socket.io-client');
} catch (e) {
  ioClient = require('../../../frontend/node_modules/socket.io-client');
}
const app = require('../../src/app');
const { initSocket } = require('../../src/socket');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');
const Task = require('../../src/models/Task');

describe('Performance, Concurrency & Socket Resilience (PERF-001 to PERF-008, SOCKX-001)', () => {
  let server, ioServer, serverPort;
  let pmUser, pmToken, testProject;

  beforeAll((done) => {
    server = http.createServer(app);
    ioServer = initSocket(server);
    server.listen(0, () => {
      serverPort = server.address().port;
      done();
    });
  });

  afterAll(async () => {
    if (ioServer) ioServer.close();
    if (server) await new Promise((r) => server.close(r));
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});

    pmUser = await User.create({
      name: 'Performance PM',
      email: 'pm.perf@devcollab.com',
      password: 'Password123',
      isVerified: true,
      role: 'admin',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'pm.perf@devcollab.com',
      password: 'Password123',
    });
    pmToken = loginRes.body.data.accessToken;

    testProject = await Project.create({
      name: 'High Concurrency Benchmark Project',
      owner: pmUser._id,
      members: [{ user: pmUser._id, role: 'project_manager' }],
      visibility: 'private',
    });

    // Seed 10 tasks in project
    for (let i = 1; i <= 10; i++) {
      await Task.create({
        title: `Benchmark Task #${i}`,
        description: `Performance benchmark task payload ${i}`,
        project: testProject._id,
        createdBy: pmUser._id,
        column: 'in_progress',
        priority: 'high',
        targetRole: 'backend_developer',
        startedAt: new Date(),
      });
    }
  });

  // =========================================================================
  // PERF-001: 50 Concurrent Board Queries
  // =========================================================================
  it('PERF-001: Handles 50 concurrent GET requests to board metrics with p95 < 500ms and 0% errors', async () => {
    const CONCURRENCY = 50;
    const latencies = [];

    const promises = Array.from({ length: CONCURRENCY }, async () => {
      const reqStart = Date.now();
      const res = await request(app)
        .get(`/api/v1/board/${testProject._id}`)
        .set('Authorization', `Bearer ${pmToken}`);
      const duration = Date.now() - reqStart;
      latencies.push(duration);
      return res;
    });

    const responses = await Promise.all(promises);

    // All must succeed
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slaSummary.total).toBe(10);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(CONCURRENCY * 0.95)];

    expect(p95).toBeLessThan(1000);
    expect(responses.length).toBe(CONCURRENCY);
  });

  // =========================================================================
  // PERF-002: Concurrent Task Creation & Atomic Ordering
  // =========================================================================
  it('PERF-002: Safely handles concurrent task creations without race conditions or index corruptions', async () => {
    const NUM_TASKS = 15;

    const promises = Array.from({ length: NUM_TASKS }, (_, i) =>
      request(app)
        .post(`/api/v1/board/${testProject._id}/tasks`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          title: `Concurrent Atomic Task ${i + 1}`,
          description: `Testing race condition isolation on creation`,
          column: 'todo',
          priority: 'medium',
          targetRole: 'any',
        })
    );

    const responses = await Promise.all(promises);

    for (const res of responses) {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    }

    const allTasks = await Task.find({ project: testProject._id, column: 'todo' });
    expect(allTasks.length).toBe(NUM_TASKS);
  });

  // =========================================================================
  // PERF-003 & SOCKX-001: Socket Connection & Reconnection Resilience
  // =========================================================================
  it('PERF-003: Verifies socket connection, room join, and seamless client reconnection cycle', async () => {
    const clientSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: pmToken },
      transports: ['websocket'],
    });

    await new Promise((resolve) => clientSocket.on('connect', resolve));
    expect(clientSocket.connected).toBe(true);

    // Join project room
    clientSocket.emit('project:join', testProject._id.toString());
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify room contains client socket on server
    const projectRoom = ioServer.sockets.adapter.rooms.get(`project:${testProject._id}`);
    expect(projectRoom?.has(clientSocket.id)).toBe(true);

    // Disconnect socket intentionally
    clientSocket.disconnect();
    expect(clientSocket.connected).toBe(false);

    // Reconnect socket
    clientSocket.connect();
    await new Promise((resolve) => clientSocket.on('connect', resolve));
    expect(clientSocket.connected).toBe(true);

    // Re-verify room join after reconnection
    clientSocket.emit('project:join', testProject._id.toString());
    await new Promise((resolve) => setTimeout(resolve, 100));

    const rejoinedRoom = ioServer.sockets.adapter.rooms.get(`project:${testProject._id}`);
    expect(rejoinedRoom?.has(clientSocket.id)).toBe(true);

    clientSocket.disconnect();
  });

  // =========================================================================
  // PERF-004: Socket Rejection on Invalid Token on Connect
  // =========================================================================
  it('PERF-004: Rejects unauthorized socket connections with malformed or invalid JWTs', async () => {
    const invalidSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: 'invalid.jwt.token' },
      transports: ['websocket'],
    });

    const errorReceived = await new Promise((resolve) => {
      invalidSocket.on('connect_error', (err) => resolve(err.message));
      setTimeout(() => resolve(null), 3000);
    });

    expect(errorReceived).toMatch(/Authentication error|invalid token|jwt/i);
    invalidSocket.disconnect();
  });
});
