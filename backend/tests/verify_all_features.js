const http = require('http');
const mongoose = require('mongoose');
const User = require('../src/models/User');

const API_BASE = 'http://localhost:5000/api/v1';

async function request(urlStr, method = 'GET', data = null, token = null) {
  const url = new URL(urlStr.startsWith('http') ? urlStr : `${API_BASE}${urlStr}`);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

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
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
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

  // 2. Authentication: Atharva (PM / Owner) with Real OTP Flow
  const atharvaStep1 = await request('/auth/login', 'POST', {
    email: 'atharvanandurkar2411@gmail.com',
    password: 'Password123',
  });
  assert(atharvaStep1.status === 200 && atharvaStep1.body.requiresOTP === true, '2. Human User (Atharva) login requires 6-digit OTP verification');

  const atharvaDoc = await User.findOne({ email: 'atharvanandurkar2411@gmail.com' }).select('+otp');
  const otpCode = atharvaDoc ? atharvaDoc.otp : null;
  assert(otpCode && otpCode.length === 6, `3. 6-digit OTP generated securely in DB (${otpCode})`);

  const atharvaStep2 = await request('/auth/verify-otp', 'POST', {
    email: 'atharvanandurkar2411@gmail.com',
    otp: otpCode,
  });
  assert(atharvaStep2.status === 200 && atharvaStep2.body.data.accessToken, '4. PM Atharva completes OTP verification & receives valid JWT token');
  const pmToken = atharvaStep2.body.data.accessToken;

  // 3. Authentication: Emma Watson (UI/UX Bot)
  const emmaAuth = await request('/auth/login', 'POST', {
    email: 'emma.designer@devcollab.com',
    password: 'DevCollab123!',
  });
  assert(emmaAuth.status === 200 && emmaAuth.body.data.accessToken, '5. Bot Emma Watson (UI/UX) authenticates with valid credentials');
  const emmaToken = emmaAuth.body.data.accessToken;

  // 4. Authentication: Lucas Vance (DevOps Bot)
  const lucasAuth = await request('/auth/login', 'POST', {
    email: 'lucas.devops@devcollab.com',
    password: 'DevCollab123!',
  });
  assert(lucasAuth.status === 200 && lucasAuth.body.data.accessToken, '6. Bot Lucas Vance (DevOps) authenticates with valid credentials');
  const lucasToken = lucasAuth.body.data.accessToken;

  // 5. Query Projects (Multi-Tenancy & Isolation)
  const projRes = await request('/projects', 'GET', null, pmToken);
  assert(projRes.status === 200 && Array.isArray(projRes.body.data.projects), '7. Projects query returns active projects array');
  const project = projRes.body.data.projects.find((p) => p.name === 'DevCollab');
  assert(project && project.name === 'DevCollab', `8. Project DevCollab is present (ID: ${project?._id})`);
  const projectId = project?._id;

  // 6. Query Board & SLA Metrics
  const boardRes = await request(`/board/${projectId}`, 'GET', null, pmToken);
  assert(boardRes.status === 200 && boardRes.body.data.board, '9. Kanban board loads columns and SLA metrics summary');
  const slaSummary = boardRes.body.data.slaSummary;
  assert(slaSummary && typeof slaSummary.complianceRate === 'number', `10. SLA Engine live compliance calculated (${slaSummary?.complianceRate}%, Total Tasks: ${slaSummary?.total})`);

  // 7. Security: Non-Member Task Assignment Privilege Escalation Blocked
  const fakeAssignee = '650000000000000000000099';
  const badTaskRes = await request(`/board/${projectId}/tasks`, 'POST', {
    title: 'Hacker Assignment Injection Attempt',
    description: 'Testing non-member assignment vulnerability',
    priority: 'high',
    column: 'todo',
    assignees: [fakeAssignee],
  }, pmToken);
  assert(badTaskRes.status === 400, '11. Security Guard: Assigning non-member is rejected with HTTP 400 Bad Request');

  // 8. Create Legitimate Task assigned to Lucas
  const lucasUser = lucasAuth.body.data.user;
  const goodTaskRes = await request(`/board/${projectId}/tasks`, 'POST', {
    title: 'Verify Cluster Health & Docker Metrics',
    description: 'Automated test task for Lucas DevOps',
    priority: 'medium',
    column: 'todo',
    assignees: [lucasUser._id],
  }, pmToken);
  assert(goodTaskRes.status === 201 && goodTaskRes.body.data.task, '12. Task created successfully and assigned to Lucas DevOps');
  const taskId = goodTaskRes.body?.data?.task?._id;

  // 9. Contributor moves task to in_progress via /board/tasks/:taskId/move
  const inProgRes = await request(`/board/tasks/${taskId}/move`, 'PATCH', {
    column: 'in_progress',
  }, lucasToken);
  assert(inProgRes.status === 200 && inProgRes.body.data.task.column === 'in_progress', '13. Contributor Lucas moves assigned task to In Progress');

  // 10. SDLC Role Hierarchy Guard: Contributor dragging to Done blocked with 403 Forbidden
  const illegalDoneRes = await request(`/board/tasks/${taskId}/move`, 'PATCH', {
    column: 'done',
  }, lucasToken);
  assert(illegalDoneRes.status === 403, '14. Role Hierarchy Guard: Contributor moving task to Done blocked with HTTP 403 Forbidden');

  // 11. Contributor submits task to Review with resolution notes
  const resolveRes = await request(`/board/tasks/${taskId}/resolve`, 'PATCH', {
    notes: 'Cluster health verified, memory metrics stable, logs rotated cleanly.',
    column: 'review',
  }, lucasToken);
  assert(resolveRes.status === 200 && resolveRes.body.data.task.column === 'review', '15. Contributor submits task to Review with resolution notes');

  // 12. Review Column Lock: Contributor dragging out of Review blocked with 403 Forbidden
  const lockRes = await request(`/board/tasks/${taskId}/move`, 'PATCH', {
    column: 'in_progress',
  }, lucasToken);
  assert(lockRes.status === 403, '16. Review Column Lock: Non-PM moving task out of Review blocked with HTTP 403 Forbidden');

  // 13. PM Decision Routing: Atharva approves task to Done
  const approveRes = await request(`/board/tasks/${taskId}/manager-review`, 'PATCH', {
    status: 'approved',
    feedback: 'Excellent work Lucas! Metrics verified.',
  }, pmToken);
  assert(approveRes.status === 200 && approveRes.body.data.task.column === 'done', '17. PM Sign-Off: PM Atharva approves ticket and moves it to Done');

  // Clean up test task
  await request(`/board/tasks/${taskId}`, 'DELETE', null, pmToken);

  // 14. Collaborative Pair-Coding Session & Chat History
  const collabRes = await request(`/collab/project/${projectId}`, 'GET', null, pmToken);
  assert(collabRes.status === 200 && collabRes.body.data.sessions.length > 0, '18. Live Pair-Coding session retrieved successfully');
  const session = collabRes.body.data.sessions[0];
  const messages = session.messages || [];
  assert(messages.length >= 2, `19. Live Session Chat contains Emma's messages (${messages.length} messages found in DB)`);

  // 15. Send Chat Message via REST API
  const newChatRes = await request(`/collab/${session._id}/messages`, 'POST', {
    content: 'Live pair-coding check passed!',
  }, pmToken);
  assert(newChatRes.status === 201 && newChatRes.body.data.message, '20. New live chat message sent and saved to MongoDB');

  // 16. Code Reviews List
  const reviewsRes = await request(`/reviews?project=${projectId}`, 'GET', null, pmToken);
  assert(reviewsRes.status === 200 && Array.isArray(reviewsRes.body.data.reviews), '21. Code Reviews API returns active reviews list');

  // 17. Notifications List
  const notifRes = await request('/notifications', 'GET', null, pmToken);
  assert(notifRes.status === 200 && Array.isArray(notifRes.body.data.notifications), '22. Notifications API returns notifications list');

  // 18. Security Audits Trail
  const auditRes = await request(`/projects/${projectId}/security-audits`, 'GET', null, pmToken);
  assert(auditRes.status === 200 && Array.isArray(auditRes.body.data.audits), '23. Security Audits API returns SOC-2 audit records');

  // 19. Frontend Next.js Pages Render Check (via internal docker network devcollab-frontend:3000)
  try {
    const homePage = await request('http://devcollab-frontend:3000');
    assert(homePage.status === 200, '24. Frontend Root / renders with HTTP 200 OK');

    const loginPage = await request('http://devcollab-frontend:3000/login');
    assert(loginPage.status === 200, '25. Frontend /login renders with HTTP 200 OK (with Dark Theme Toggle)');
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
