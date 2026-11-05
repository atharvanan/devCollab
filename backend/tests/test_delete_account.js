const http = require('http');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Task = require('../src/models/Task');
const Notification = require('../src/models/Notification');

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

async function runDeleteAccountTests() {
  console.log('========================================================================');
  console.log('DEVCOLLAB ACCOUNT DELETION & GOVERNANCE TEST SUITE');
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

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/devcollab';
    await mongoose.connect(mongoUri);

    // 1. Authenticate Admin
    console.log('\n--- 1. Testing Admin Account Deletion Protection ---');
    const adminEmail = process.env.PRIMARY_ADMIN_EMAIL || 'admin@devcollab.com';
    const adminPassword = 'Password123!';
    await request('/auth/login', 'POST', {
      email: adminEmail,
      password: adminPassword,
    });
    const adminDoc = await User.findOne({ email: adminEmail }).select('+otp');
    const adminVerify = await request('/auth/verify-otp', 'POST', {
      email: adminEmail,
      otp: adminDoc.otp,
    });
    const adminToken = adminVerify.body.data?.accessToken;
    const adminUserId = adminVerify.body.data?.user?._id || adminVerify.body.data?.user?.id;
    assert(adminToken && adminVerify.body.data?.user?.role === 'admin', 'Admin login and 2FA OTP verification succeeded');

    // Test 1: Admin account deletion must be blocked with HTTP 403
    const deleteAdminRes = await request('/users/account', 'DELETE', {
      password: adminPassword,
    }, adminToken);
    assert(
      deleteAdminRes.status === 403,
      `Primary Platform Admin account deletion strictly rejected with 403 Forbidden (Got: ${deleteAdminRes.status})`
    );

    // 2. Register a new user for account deletion testing
    console.log('\n--- 2. Register Test User for Deletion ---');
    const testEmail = `del.user.${Date.now()}@example.com`;
    const testPassword = 'Password123!';
    const regRes = await request('/auth/register', 'POST', {
      name: 'Delete Test User',
      email: testEmail,
      password: testPassword,
    });
    if (regRes.status !== 201) {
      console.error('Registration failed:', regRes.status, regRes.body);
    }
    assert(regRes.status === 201, `Test user registered successfully (HTTP 201)`);

    const userWithOtp = await User.findOne({ email: testEmail }).select('+otp');
    const verifyRes = await request('/auth/verify-otp', 'POST', {
      email: testEmail,
      otp: userWithOtp.otp,
    });
    const userToken = verifyRes.body.data?.accessToken;
    const userId = verifyRes.body.data?.user?._id || verifyRes.body.data?.user?.id;
    assert(userToken && userId, 'Test user authenticated with valid access token');

    // 3. Test: Missing password confirmation
    console.log('\n--- 3. Testing Password Confirmation Enforcement ---');
    const noPassRes = await request('/users/account', 'DELETE', {}, userToken);
    assert(
      noPassRes.status === 400,
      `Deletion request without password confirmation rejected with HTTP 400 (Got: ${noPassRes.status})`
    );

    // 4. Test: Incorrect password confirmation
    const wrongPassRes = await request('/users/account', 'DELETE', {
      password: 'WrongPassword999!',
    }, userToken);
    assert(
      wrongPassRes.status === 401,
      `Deletion request with incorrect password rejected with HTTP 401 (Got: ${wrongPassRes.status})`
    );

    // 5. Test: Governance Ownership Guard
    console.log('\n--- 4. Testing Project Ownership Governance Guard ---');
    // Grant project creation permission to this user via Admin
    await request(`/users/${userId}/project-creation-permission`, 'PATCH', {
      canCreateProjects: true,
    }, adminToken);

    // User creates a team project
    const createProjRes = await request('/projects', 'POST', {
      name: 'Deletion Guard Project',
      description: 'Project to test ownership block during account deletion',
    }, userToken);
    assert(createProjRes.status === 201, 'Test user created project as Project Owner');
    const projId = createProjRes.body.data?.project?._id || createProjRes.body.data?.project?.id;

    // Invite another human member (Admin) to this project to test team project ownership restriction
    const inviteRes = await request(`/projects/${projId}/invite`, 'POST', {
      email: adminEmail,
      role: 'contributor',
    }, userToken);
    assert(inviteRes.status === 200, 'Human team member invited to project');

    // Now user attempts to delete account while owning an active project with team members
    const deleteBlockedRes = await request('/users/account', 'DELETE', {
      password: testPassword,
    }, userToken);
    assert(
      deleteBlockedRes.status === 400 &&
      deleteBlockedRes.body.message?.includes('Governance Restriction'),
      `Project Owner account deletion strictly blocked when project has active members (HTTP 400 Governance Restriction)`
    );

    // 6. Test: Valid Account Deletion & Cascading Cleanup
    console.log('\n--- 5. Testing Valid Account Deletion & Cascading Cleanup ---');
    // Delete the team project so user can delete account
    await request(`/projects/${projId}`, 'DELETE', null, userToken);

    // Create a solo project for the user (to verify solo projects get auto-deleted)
    const soloProjRes = await request('/projects', 'POST', {
      name: 'Solo Deletion Project',
      description: 'This project should be deleted when owner deletes account',
    }, userToken);
    assert(soloProjRes.status === 201, 'Solo project created');
    const soloProjId = soloProjRes.body.data?.project?._id || soloProjRes.body.data?.project?.id;

    // Add user as a member to an existing project owned by Admin (DevCollab project)
    let devCollabProj = await Project.findOne({ name: 'DevCollab' });
    if (!devCollabProj) {
      devCollabProj = await Project.create({
        name: 'DevCollab',
        description: 'Commercial Engineering Workspace',
        owner: adminUserId,
        status: 'active',
        members: [{ user: adminUserId, role: 'project_manager' }],
      });
    }
    if (devCollabProj) {
      await Project.findByIdAndUpdate(devCollabProj._id, {
        $addToSet: { members: { user: userId, role: 'contributor' } },
      });
      // Assign user to a test task
      await Task.create({
        title: 'Task for Deletion User',
        project: devCollabProj._id,
        createdBy: adminUserId,
        assignees: [userId],
      });
    }

    // Create a personal notification for the user
    await Notification.create({
      recipient: userId,
      sender: adminUserId,
      type: 'task_assigned',
      title: 'Welcome Notification',
      message: 'This notification should be cleaned up upon account deletion',
    });

    // Execute account deletion with correct password
    const deleteSuccessRes = await request('/users/account', 'DELETE', {
      password: testPassword,
    }, userToken);
    assert(
      deleteSuccessRes.status === 200 && deleteSuccessRes.body.success === true,
      `Account deletion succeeded with HTTP 200 (Message: ${deleteSuccessRes.body.message})`
    );

    // 7. Verify In-Database State
    console.log('\n--- 6. Verifying Database State After Deletion ---');
    const dbUser = await User.findById(userId);
    assert(dbUser === null, 'User document is permanently purged from MongoDB User collection');

    const dbSoloProj = await Project.findById(soloProjId);
    assert(dbSoloProj === null, 'Solo project owned by user was cleaned up automatically');

    if (devCollabProj) {
      const updatedProj = await Project.findById(devCollabProj._id);
      const stillMember = updatedProj.members.some(
        (m) => (m.user?._id || m.user)?.toString() === userId.toString()
      );
      assert(!stillMember, 'User was cleanly purged from project members list in other projects');

      const assignedTasks = await Task.find({
        project: devCollabProj._id,
        assignees: userId,
      });
      assert(assignedTasks.length === 0, 'User was cleanly unassigned from all tasks');

      // Clean up the test task
      await Task.deleteMany({ title: 'Task for Deletion User' });
    }

    const remainingNotifications = await Notification.find({ recipient: userId });
    assert(remainingNotifications.length === 0, 'Personal notifications were cleanly deleted');

    // 8. Verify Token Invalidation
    console.log('\n--- 7. Verifying Authentication Invalidation ---');
    const testAfterDelete = await request('/users/me/permissions', 'GET', null, userToken);
    assert(
      testAfterDelete.status === 401,
      `Deleted user JWT token is immediately rejected with HTTP 401 Unauthorized (Got: ${testAfterDelete.status})`
    );

  } catch (error) {
    console.error('Test Suite encountered an error:', error);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n========================================================================');
    console.log(`DELETION TESTS COMPLETED: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runDeleteAccountTests();
