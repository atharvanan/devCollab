const request = require('supertest');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
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
const Review = require('../../src/models/Review');
const CollabSession = require('../../src/models/CollabSession');
const Notification = require('../../src/models/Notification');

describe('E2E Multi-Role Bot Collaboration & Communication System', () => {
  let server, ioServer, serverPort;
  let pmUser, pmToken;
  let testProject;
  let botTokens = {};
  let botUsers = {};

  const BOTS = [
    { role: 'frontend_developer', email: 'alex.frontend@devcollab.com', name: 'Alex Rivers' },
    { role: 'backend_developer', email: 'sarah.backend@devcollab.com', name: 'Sarah Chen' },
    { role: 'qa_tester', email: 'david.qa@devcollab.com', name: 'David Miller' },
    { role: 'ui_ux_designer', email: 'emma.designer@devcollab.com', name: 'Emma Watson' },
    { role: 'devops', email: 'lucas.devops@devcollab.com', name: 'Lucas Vance' },
    { role: 'security_engineer', email: 'frank.security@devcollab.com', name: 'Frank Miller' },
    { role: 'db_developer', email: 'grace.db@devcollab.com', name: 'Grace Hopper' },
  ];

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
    await Review.deleteMany({});
    await CollabSession.deleteMany({});
    await Notification.deleteMany({});

    // 1. Create Project Manager
    pmUser = await User.create({
      name: 'Engineering Director',
      email: 'director@devcollab.com',
      password: 'Password123!',
      isVerified: true,
      role: 'admin',
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'director@devcollab.com',
      password: 'Password123!',
    });
    pmToken = loginRes.body.data.accessToken;

    // 2. Create Project
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        name: 'OmniFlow Engineering Suite',
        description: 'End-to-end multi-role real-time collaboration ecosystem.',
      });
    testProject = projRes.body.data.project;
  });

  async function ensureTeamMembers() {
    for (const b of BOTS) {
      let u = await User.findOne({ email: b.email });
      if (!u) {
        u = await User.create({
          name: b.name,
          email: b.email,
          password: 'Password123!',
          isVerified: true,
          role: 'user',
        });
      }
      const isMem = testProject.members?.some((m) => (m.user?._id || m.user)?.toString() === u._id.toString());
      if (!isMem) {
        await request(app)
          .post(`/api/v1/projects/${testProject._id}/invite`)
          .set('Authorization', `Bearer ${pmToken}`)
          .send({ email: b.email, role: b.role });
      }
      const login = await request(app).post('/api/v1/auth/login').send({
        email: b.email,
        password: 'Password123!',
      });
      botTokens[b.role] = login.body.data.accessToken;
      botUsers[b.role] = login.body.data.user;
    }
  }

  // =========================================================================
  // SUITE 1: Bot Team Seeding & Multi-Role Authentication Verification
  // =========================================================================
  it('1. Seeds 5 engineering role bots and verifies all bots authenticate with valid JWTs', async () => {
    await ensureTeamMembers();

    // Verify Project Membership (1 PM owner + 7 seeded bots = 8 total members)
    const updatedProj = await Project.findById(testProject._id).populate('members.user');
    expect(updatedProj.members.length).toBe(8);

    // Test login for EVERY bot role
    for (const b of BOTS) {
      expect(botTokens[b.role]).toBeDefined();
      expect(botUsers[b.role].email).toBe(b.email);

      // Role check in project
      const roleInProject = updatedProj.getUserRole(botUsers[b.role]._id);
      expect(roleInProject).toBe(b.role);
    }
  });

  // =========================================================================
  // SUITE 2: Kanban Board Multi-Role Collaboration, Comments & Review Cycle
  // =========================================================================
  it('2. Multi-role bots collaborate on Kanban tickets with notes, comments, and PM sign-off', async () => {
    await ensureTeamMembers();

    // Step A: PM creates tickets targeted for different roles
    const frontendTaskRes = await request(app)
      .post(`/api/v1/board/${testProject._id}/tasks`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        title: 'Build Responsive React Dashboard Navigation',
        description: 'Implement dark-mode responsive top-bar, mobile menu drawer, and active tab highlights.',
        column: 'todo',
        priority: 'high',
        targetRole: 'frontend_developer',
        assignees: [botUsers['frontend_developer']._id],
      });
    expect(frontendTaskRes.status).toBe(201);
    const frontendTask = frontendTaskRes.body.data.task;

    const backendTaskRes = await request(app)
      .post(`/api/v1/board/${testProject._id}/tasks`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        title: 'Implement Microservice Session Cache',
        description: 'Configure Redis connection pooling and session invalidation hooks.',
        column: 'todo',
        priority: 'critical',
        targetRole: 'backend_developer',
        assignees: [botUsers['backend_developer']._id],
      });
    expect(backendTaskRes.status).toBe(201);
    const backendTask = backendTaskRes.body.data.task;

    // Step B: Alex (Frontend Dev) moves task to in_progress
    const alexProgress = await request(app)
      .put(`/api/v1/board/tasks/${frontendTask._id}`)
      .set('Authorization', `Bearer ${botTokens['frontend_developer']}`)
      .send({ column: 'in_progress' });
    expect(alexProgress.status).toBe(200);
    expect(alexProgress.body.data.task.column).toBe('in_progress');

    // Step C: David (QA Tester) posts a collaborative QA note on the task
    const qaCommentRes = await request(app)
      .post(`/api/v1/board/tasks/${frontendTask._id}/comments`)
      .set('Authorization', `Bearer ${botTokens['qa_tester']}`)
      .send({
        message: 'QA Automated Check: Validated across iOS Safari, Android Chrome, and Desktop viewports. 0 layout shifts.',
      });
    expect(qaCommentRes.status).toBe(201);
    expect(qaCommentRes.body.data.note.role).toBe('qa_tester');

    // Step D: Emma (UI/UX Designer) posts design feedback note on the task
    const designerCommentRes = await request(app)
      .post(`/api/v1/board/tasks/${frontendTask._id}/comments`)
      .set('Authorization', `Bearer ${botTokens['ui_ux_designer']}`)
      .send({
        message: 'UI/UX Sign-off: Color contrast ratios meet WCAG AAA accessibility standards.',
      });
    expect(designerCommentRes.status).toBe(201);

    // Step E: Alex (Frontend Dev) completes work and submits resolution notes to PM
    const alexSubmit = await request(app)
      .patch(`/api/v1/board/tasks/${frontendTask._id}/resolve`)
      .set('Authorization', `Bearer ${botTokens['frontend_developer']}`)
      .send({
        notes: 'Implemented navigation component with Tailwind dark mode tokens, tested edge cases, submitted for PM sign-off.',
        column: 'review',
      });
    expect(alexSubmit.status).toBe(200);
    expect(alexSubmit.body.data.task.column).toBe('review');
    expect(alexSubmit.body.data.task.completedByAssignee).toBe(true);

    // Step F: PM reviews Sarah's backend task and requests revisions
    const pmRejectRes = await request(app)
      .patch(`/api/v1/board/tasks/${backendTask._id}/manager-review`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        status: 'rejected',
        feedback: 'Please wrap Redis connection in retry backoff to survive broker blips.',
        routeToColumn: 'in_progress',
      });
    expect(pmRejectRes.status).toBe(200);
    expect(pmRejectRes.body.data.task.column).toBe('in_progress');
    expect(pmRejectRes.body.data.task.managerReview.status).toBe('rejected');

    // Sarah resubmits backend task with fix
    const sarahResubmit = await request(app)
      .patch(`/api/v1/board/tasks/${backendTask._id}/resolve`)
      .set('Authorization', `Bearer ${botTokens['backend_developer']}`)
      .send({
        notes: 'Added exponential backoff retries with circuit breaker pattern.',
        column: 'review',
      });
    expect(sarahResubmit.status).toBe(200);
    expect(sarahResubmit.body.data.task.column).toBe('review');

    // Step G: PM approves both tasks and moves them to Done
    const pmApproveFrontend = await request(app)
      .patch(`/api/v1/board/tasks/${frontendTask._id}/manager-review`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        status: 'approved',
        feedback: 'Clean implementation and thorough QA notes. Approved!',
      });
    expect(pmApproveFrontend.status).toBe(200);
    expect(pmApproveFrontend.body.data.task.column).toBe('done');
    expect(pmApproveFrontend.body.data.task.managerReview.status).toBe('approved');

    const pmApproveBackend = await request(app)
      .patch(`/api/v1/board/tasks/${backendTask._id}/manager-review`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        status: 'approved',
        feedback: 'Resilience verified. Approved!',
      });
    expect(pmApproveBackend.status).toBe(200);
    expect(pmApproveBackend.body.data.task.column).toBe('done');

    // Verify task history contains all activity notes
    const finalFrontendTask = await Task.findById(frontendTask._id);
    expect(finalFrontendTask.activityNotes.length).toBeGreaterThanOrEqual(4);
  });

  // =========================================================================
  // SUITE 3: Real-Time Pair-Coding Studio, Live Chat & JSX Export
  // =========================================================================
  it('3. Real-time pair-coding session with live socket sync, team chat messages, and JSX export', async () => {
    // Ensure team members & login
    await ensureTeamMembers();

    const alexToken = botTokens['frontend_developer'];
    const sarahToken = botTokens['backend_developer'];

    // Step A: Get or scaffold collaborative session
    const sessionRes = await request(app)
      .get(`/api/v1/collab/project/${testProject._id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    const session = sessionRes.body.data.sessions[0];
    expect(session).toBeDefined();

    // Step B: Sockets for Alex and Sarah connect to the live server
    const alexSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: alexToken },
      transports: ['websocket'],
    });

    const sarahSocket = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: sarahToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((resolve) => alexSocket.on('connect', resolve)),
      new Promise((resolve) => sarahSocket.on('connect', resolve)),
    ]);

    // Join room with acknowledgment
    await new Promise((resolve) => alexSocket.emit('collab:join', { sessionId: session._id }, resolve));
    await new Promise((resolve) => sarahSocket.emit('collab:join', { sessionId: session._id }, resolve));

    // Step C: Real-Time Team Chat exchange over socket
    const receivedMessages = [];
    sarahSocket.on('collab:chatMessage', (msg) => {
      receivedMessages.push(msg);
    });

    // Alex sends chat message
    alexSocket.emit('collab:chat', {
      sessionId: session._id,
      message: 'Hey Sarah, starting pair-coding on the React JSX UserDashboard component.',
    });

    // Wait for message receipt
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0].content).toContain('React JSX UserDashboard');
    expect(receivedMessages[0].name).toContain('Alex');

    // Step D: Send chat message via REST API as well
    const apiChatRes = await request(app)
      .post(`/api/v1/collab/${session._id}/messages`)
      .set('Authorization', `Bearer ${sarahToken}`)
      .send({
        content: 'Sounds great Alex! I am ready with the JSON payload format.',
      });
    expect(apiChatRes.status).toBe(201);
    expect(apiChatRes.body.data.message.content).toContain('JSON payload format');

    // Step E: Alex contributes React JSX code
    const jsxCode = `import React, { useState } from 'react';

export function UserDashboard({ user, stats }) {
  const [active, setActive] = useState(true);
  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl">
      <h1 className="text-2xl font-bold">{user.name}</h1>
      <p className="text-sm text-slate-400">Total Contributions: {stats.commits}</p>
    </div>
  );
}`;

    const updateRes = await request(app)
      .put(`/api/v1/collab/${session._id}/code`)
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        code: jsxCode,
        language: 'jsx',
        title: 'React JSX Live Pair Programming',
        activeLine: 5,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.session.language).toBe('jsx');
    expect(updateRes.body.data.session.contributors.length).toBeGreaterThanOrEqual(1);

    // Step F: Export session to Code Review in JSX format (0 MongoDB text index error)
    const exportRes = await request(app)
      .post(`/api/v1/collab/${session._id}/export-review`)
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        title: 'Review: React JSX UserDashboard Component',
      });

    expect(exportRes.status).toBe(201);
    expect(exportRes.body.success).toBe(true);
    expect(exportRes.body.data.review.language).toBe('jsx');
    expect(exportRes.body.data.review.code).toContain('UserDashboard');

    // Disconnect sockets cleanly
    alexSocket.disconnect();
    sarahSocket.disconnect();
  });

  // =========================================================================
  // SUITE 4: Code Review Communication, Line Comments & Approval Loop
  // =========================================================================
  it('4. Multi-role bots collaborate on Code Reviews with inline line comments and approval', async () => {
    // Ensure team members & login
    await ensureTeamMembers();

    const alexToken = botTokens['frontend_developer'];
    const davidToken = botTokens['qa_tester'];

    // Alex creates a code review
    const reviewRes = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        projectId: testProject._id,
        title: 'TypeScript Interface & Data Layer',
        description: 'New typing and async data fetchers.',
        code: `export interface UserProfile {\n  id: string;\n  name: string;\n  email: string;\n}\n\nexport async function fetchProfile(id: string): Promise<UserProfile> {\n  return { id, name: "Alex", email: "alex@devcollab.com" };\n}`,
        language: 'typescript',
        domain: 'general',
      });
    expect(reviewRes.status).toBe(201);
    const review = reviewRes.body.data.review;

    // David (QA Engineer) adds an inline comment on line 7
    const inlineCommentRes = await request(app)
      .post(`/api/v1/reviews/${review._id}/comments/inline`)
      .set('Authorization', `Bearer ${davidToken}`)
      .send({
        lineNumber: 7,
        content: 'QA Suggestion: Please add null check for undefined user IDs.',
      });
    expect(inlineCommentRes.status).toBe(201);
    const commentId = inlineCommentRes.body.data.comment._id;

    // Alex resolves the inline comment
    const resolveRes = await request(app)
      .patch(`/api/v1/reviews/${review._id}/comments/${commentId}/resolve`)
      .set('Authorization', `Bearer ${alexToken}`);
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.comment.resolved).toBe(true);

    // David posts general review comment
    const generalCommentRes = await request(app)
      .post(`/api/v1/reviews/${review._id}/comments/general`)
      .set('Authorization', `Bearer ${davidToken}`)
      .send({
        content: 'All unit test cases pass and edge cases are handled cleanly.',
      });
    expect(generalCommentRes.status).toBe(201);

    // David / PM approves review
    const approveRes = await request(app)
      .patch(`/api/v1/reviews/${review._id}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ status: 'approved' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.review.status).toBe('approved');
  });

  // =========================================================================
  // SUITE 5: Project Lifecycle Management & Dashboard Metric Counters
  // =========================================================================
  it('5. Project status transitions (hold, resume, complete) and open review counter tracking', async () => {
    // 1. Check open reviews count initially
    const countOpenInitial = await Review.countDocuments({
      project: testProject._id,
      status: { $in: ['open', 'in_review', 'changes_requested'] },
    });
    expect(countOpenInitial).toBe(0);

    // 2. Create open review
    const rev = await Review.create({
      project: testProject._id,
      author: pmUser._id,
      title: 'Active Open Review',
      code: 'function test() { return true; }',
      language: 'javascript',
      status: 'open',
    });

    const countOpenAfter = await Review.countDocuments({
      project: testProject._id,
      status: { $in: ['open', 'in_review', 'changes_requested'] },
    });
    expect(countOpenAfter).toBe(1);

    // 3. Mark review approved
    rev.status = 'approved';
    await rev.save();

    const countOpenFinal = await Review.countDocuments({
      project: testProject._id,
      status: { $in: ['open', 'in_review', 'changes_requested'] },
    });
    expect(countOpenFinal).toBe(0);

    // 4. Project status transitions
    const holdRes = await request(app)
      .patch(`/api/v1/projects/${testProject._id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ status: 'on_hold' });
    expect(holdRes.status).toBe(200);
    expect(holdRes.body.data.project.status).toBe('on_hold');

    const resumeRes = await request(app)
      .patch(`/api/v1/projects/${testProject._id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ status: 'active' });
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.project.status).toBe('active');

    const finishRes = await request(app)
      .patch(`/api/v1/projects/${testProject._id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ status: 'completed' });
    expect(finishRes.status).toBe(200);
    expect(finishRes.body.data.project.status).toBe('completed');
  });
});
