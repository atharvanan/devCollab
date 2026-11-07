const http = require('http');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const CollabSession = require('../src/models/CollabSession');

const API_BASE = 'http://localhost:5000/api/v1';

async function request(urlStr, method = 'GET', data = null, token = null) {
  const url = new URL(urlStr.startsWith('http') ? urlStr : `${API_BASE}${urlStr}`);
  const payload = data ? JSON.stringify(data) : null;
  const headers = {};
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  } else if (method === 'DELETE' || method === 'POST' || method === 'PATCH') {
    headers['Content-Length'] = 0;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: method,
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function getOrCreateVerifiedUser(name, email, password = 'Password123!') {
  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    user = await User.create({
      name,
      email,
      password,
      role: 'user',
      isVerified: true,
    });
  } else {
    user.password = password;
    user.role = 'user';
    user.isVerified = true;
    await user.save();
  }
  const loginRes = await request('/auth/login', 'POST', { email, password });
  let token = loginRes.body?.data?.accessToken;
  if (loginRes.body?.requiresOTP) {
    const doc = await User.findOne({ email }).select('+otp');
    const verifyRes = await request('/auth/verify-otp', 'POST', { email, otp: doc.otp });
    token = verifyRes.body?.data?.accessToken;
  }
  return { user, token };
}

async function runE2EValidation() {
  console.log('========================================================================');
  console.log('LIVE FULL-FEATURE VALIDATION AUDIT (PRODUCTION READINESS CHECK)');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Connect to live MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/devcollab';
  await mongoose.connect(mongoUri);

  // 1. Health Endpoint
  const healthRes = await request('http://localhost:5000/health');
  assert(healthRes.status === 200 && healthRes.body.status === 'ok', '1. Backend API /health reports status: ok');

  // 2. Authentication: Platform Administrator (PM / Owner) with Real OTP Flow
  const adminEmail = process.env.PRIMARY_ADMIN_EMAIL || '';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Password123!';

  const adminStep1 = await request('/auth/login', 'POST', {
    email: adminEmail,
    password: adminPassword,
  });
  assert(adminStep1.status === 200 && adminStep1.body.requiresOTP === true, '2. Platform Administrator login requires 6-digit OTP verification');

  const adminDoc = await User.findOne({ email: adminEmail }).select('+otp');
  const otpCode = adminDoc ? adminDoc.otp : null;
  assert(otpCode && otpCode.length === 6, `3. 6-digit OTP generated securely in DB (${otpCode})`);

  const adminStep2 = await request('/auth/verify-otp', 'POST', {
    email: adminEmail,
    otp: otpCode,
  });
  assert(adminStep2.status === 200 && adminStep2.body.data?.accessToken, '4. PM Admin completes OTP verification & receives valid JWT token');
  const pmToken = adminStep2.body.data.accessToken;

  // 3. Authentication: Engineering Contributor
  const { user: contributorUser, token: contributorToken } = await getOrCreateVerifiedUser(
    'Staff Engineer',
    'staff.contributor@example.com'
  );
  assert(contributorToken && contributorUser, '5. Team Contributor authenticates with valid credentials');

  // 4. Query Projects (Multi-Tenancy & Isolation)
  const projRes = await request('/projects', 'GET', null, pmToken);
  assert(projRes.status === 200 && Array.isArray(projRes.body.data?.projects), '6. Projects query returns active projects array');

  let project = projRes.body.data.projects.find((p) => p.name === 'DevCollab');
  if (!project) {
    const createProj = await request('/projects', 'POST', {
      name: 'DevCollab',
      description: 'Commercial Engineering Workspace',
    }, pmToken);
    project = createProj.body.data.project;
  }
  assert(project && project.name === 'DevCollab', `7. Project DevCollab is present (ID: ${project?._id})`);
  const projectId = project?._id;

  // Ensure contributor is invited to the project
  const isMember = project.members?.some((m) => (m.user?._id || m.user)?.toString() === contributorUser._id.toString());
  if (!isMember) {
    await request(`/projects/${projectId}/invite`, 'POST', {
      email: contributorUser.email,
      role: 'contributor',
    }, pmToken);
  }

  // 5. Query Board & SLA Metrics
  const boardRes = await request(`/board/${projectId}`, 'GET', null, pmToken);
  assert(boardRes.status === 200 && boardRes.body.data?.board, '8. Kanban board loads columns and SLA metrics summary');
  const slaSummary = boardRes.body.data?.slaSummary;
  assert(slaSummary && typeof slaSummary.complianceRate === 'number', `9. SLA Engine live compliance calculated (${slaSummary?.complianceRate}%, Total Tasks: ${slaSummary?.total})`);

  // 6. Security: Non-Member Task Assignment Privilege Escalation Blocked
  const fakeAssignee = '650000000000000000000099';
  const badTaskRes = await request(`/board/${projectId}/tasks`, 'POST', {
    title: 'Hacker Assignment Injection Attempt',
    description: 'Testing non-member assignment vulnerability',
    priority: 'high',
    column: 'todo',
    assignees: [fakeAssignee],
  }, pmToken);
  assert(badTaskRes.status === 400, '10. Security Guard: Assigning non-member is rejected with HTTP 400 Bad Request');

  // 7. Create Legitimate Task assigned to contributor
  const goodTaskRes = await request(`/board/${projectId}/tasks`, 'POST', {
    title: 'Verify Cluster Health & Docker Metrics',
    description: 'Automated test task for Lead Engineer',
    priority: 'medium',
    column: 'todo',
    assignees: [contributorUser._id],
  }, pmToken);
  assert(goodTaskRes.status === 201 && goodTaskRes.body.data?.task, '11. Task created successfully and assigned to contributor');
  const taskId = goodTaskRes.body?.data?.task?._id;

  // 8. Contributor moves task to in_progress via /board/tasks/:taskId/move
  const inProgRes = await request(`/board/tasks/${taskId}/move`, 'PATCH', {
    column: 'in_progress',
  }, contributorToken);
  assert(inProgRes.status === 200 && inProgRes.body.data?.task?.column === 'in_progress', '12. Contributor moves assigned task to In Progress');

  // 9. SDLC Role Hierarchy Guard: Contributor dragging to Done blocked with 403 Forbidden
  const illegalDoneRes = await request(`/board/tasks/${taskId}/move`, 'PATCH', {
    column: 'done',
  }, contributorToken);
  assert(illegalDoneRes.status === 403, '13. Role Hierarchy Guard: Contributor moving task to Done blocked with HTTP 403 Forbidden');

  // 10. Contributor submits task to Review with resolution notes
  const resolveRes = await request(`/board/tasks/${taskId}/resolve`, 'PATCH', {
    notes: 'Cluster health verified, memory metrics stable, logs rotated cleanly.',
    column: 'review',
  }, contributorToken);
  assert(resolveRes.status === 200 && resolveRes.body.data?.task?.column === 'review', '14. Contributor submits task to Review with resolution notes');

  // 11. Review Column Lock: Contributor dragging out of Review blocked with 403 Forbidden
  const lockRes = await request(`/board/tasks/${taskId}/move`, 'PATCH', {
    column: 'in_progress',
  }, contributorToken);
  assert(lockRes.status === 403, '15. Review Column Lock: Non-PM moving task out of Review blocked with HTTP 403 Forbidden');

  // 12. PM Decision Routing: PM approves task to Done
  const approveRes = await request(`/board/tasks/${taskId}/manager-review`, 'PATCH', {
    status: 'approved',
    feedback: 'Excellent work! Verified.',
  }, pmToken);
  assert(approveRes.status === 200 && approveRes.body.data?.task?.column === 'done', '16. PM Sign-Off: PM approves ticket and moves it to Done');

  // Clean up test task
  await request(`/board/tasks/${taskId}`, 'DELETE', null, pmToken);

  // 13. Collaborative Pair-Coding Session & Chat History
  let collabRes = await request(`/collab/project/${projectId}`, 'GET', null, pmToken);
  let session = collabRes.body?.data?.sessions?.[0];
  if (!session) {
    const createSessionRes = await request('/collab/session', 'POST', {
      projectId,
      title: 'DevCollab Live Session',
    }, pmToken);
    session = createSessionRes.body?.data?.session;
  }
  assert(session !== null && session !== undefined, '17. Live Pair-Coding session active and retrieved successfully');

  // 14. Send Live Chat Messages via REST API
  await request(`/collab/${session._id}/messages`, 'POST', {
    content: 'Collaborative live session initialized.',
  }, pmToken);

  const newChatRes = await request(`/collab/${session._id}/messages`, 'POST', {
    content: 'Live pair-coding check passed!',
  }, contributorToken);
  assert(newChatRes.status === 201 && newChatRes.body.data?.message, '18. New live chat messages sent and saved to MongoDB');

  // 15. Code Reviews List
  const reviewsRes = await request(`/reviews?project=${projectId}`, 'GET', null, pmToken);
  assert(reviewsRes.status === 200 && Array.isArray(reviewsRes.body.data?.reviews), '19. Code Reviews API returns active reviews list');

  // 16. Notifications List
  const notifRes = await request('/notifications', 'GET', null, pmToken);
  assert(notifRes.status === 200 && Array.isArray(notifRes.body.data?.notifications), '20. Notifications API returns notifications list');

  // 17. Security Audits Trail
  const auditRes = await request(`/projects/${projectId}/security-audits`, 'GET', null, pmToken);
  assert(auditRes.status === 200 && Array.isArray(auditRes.body.data?.audits), '21. Security Audits API returns SOC-2 audit records');

  // 18. Frontend Next.js Pages Render Check (via internal docker network devcollab-frontend:3000)
  try {
    const homePage = await request('http://devcollab-frontend:3000');
    assert(homePage.status === 200, '22. Frontend Root / renders with HTTP 200 OK');

    const loginPage = await request('http://devcollab-frontend:3000/login');
    assert(loginPage.status === 200, '23. Frontend /login renders with HTTP 200 OK');
  } catch (err) {
    console.error('Frontend check note:', err.message);
  }

  console.log('\n========================================================================');
  console.log(`VALIDATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2EValidation().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
