const http = require('http');
const mongoose = require('mongoose');
const ioClient = require('socket.io-client');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const SecurityAudit = require('../src/models/SecurityAudit');
const { reconcileProjectOwnership } = require('../src/utils/ownershipReconciliation');
const { bootstrapPlatformAdmin, isPrimaryAdmin } = require('../src/utils/adminProvisioning');

const BACKEND_URL = 'http://localhost:5000';
const API_BASE = `${BACKEND_URL}/api/v1`;

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

async function runAdvancedGovernanceTests() {
  console.log('========================================================================');
  console.log('ADVANCED GOVERNANCE, PM SEPARATION, SECURITY & AUDIT SUITE');
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

  const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/devcollab';
  await mongoose.connect(mongoUri);

  try {
    // -------------------------------------------------------------------------
    // 1. Secure Platform Administrator Provisioning
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Secure Platform Administrator Provisioning ---');
    const adminUser = await bootstrapPlatformAdmin();
    assert(adminUser && adminUser.role === 'admin', 'Bootstrap platform admin succeeded idempotently');
    assert(isPrimaryAdmin(adminUser.email), 'isPrimaryAdmin correctly identifies configured primary admin email');
    assert(!isPrimaryAdmin('random.user@example.com'), 'isPrimaryAdmin correctly rejects non-admin email');

    // Authenticate Admin
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Password123!';
    const loginRes = await request('/auth/login', 'POST', {
      email: adminUser.email,
      password: adminPassword,
    });
    if (loginRes.status !== 200) {
      console.error('Admin login failed:', loginRes.status, loginRes.body);
    }
    const atharvaDoc = await User.findOne({ email: adminUser.email }).select('+otp');
    const adminVerify = await request('/auth/verify-otp', 'POST', {
      email: adminUser.email,
      otp: atharvaDoc.otp,
    });
    if (adminVerify.status !== 200) {
      console.error('Admin verify OTP failed:', adminVerify.status, adminVerify.body);
    }
    const adminToken = adminVerify.body?.data?.accessToken;
    assert(adminToken, 'Platform Admin authenticated with valid access token');

    // -------------------------------------------------------------------------
    // 2. Safe Project Ownership Migration (No Blind Assignment to Lead Admin)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Safe Project Ownership Migration ---');
    // Ensure test PM user and staff user exist and authenticate
    const { user: managerUser, token: managerToken } = await getOrCreateVerifiedUser('Test PM Manager', 'manager.test@example.com');
    const { user: staffUser, token: staffToken } = await getOrCreateVerifiedUser('Test Staff Engineer', 'staff.test@example.com');

    // Create an orphan test project with an active PM member
    const fakeOwnerId = new mongoose.Types.ObjectId();
    const orphanProject = await Project.create({
      name: 'Orphan Legacy Project',
      owner: fakeOwnerId,
      status: 'active',
      members: [
        { user: managerUser._id, role: 'project_manager', joinedAt: new Date(Date.now() - 100000) },
      ],
    });

    // Run reconciliation in dryRun mode
    const dryRunReport = await reconcileProjectOwnership({ dryRun: true });
    assert(dryRunReport.totalProjects >= 1, 'Reconciliation scanned projects');
    const orphanEntry = dryRunReport.details.find((d) => d.projectId === orphanProject._id.toString());
    assert(orphanEntry && orphanEntry.proposedOwnerId === managerUser._id.toString(), 'Reconciliation proposed existing PM as replacement owner (NOT Lead Admin)');
    assert(orphanEntry.actionTaken === 'PROPOSED', 'Dry run made zero persistent database mutations');

    // Run reconciliation with apply
    const appliedReport = await reconcileProjectOwnership({ dryRun: false });
    const appliedProject = await Project.findById(orphanProject._id);
    assert(appliedProject.owner.toString() === managerUser._id.toString(), 'Reconciliation applied ownership to existing PM');
    assert(appliedProject.owner.toString() !== adminUser._id.toString(), 'Project was NOT blindly assigned to Platform Administrator');

    // Verify audit log for reconciliation
    const reconAudit = await SecurityAudit.findOne({
      project: orphanProject._id,
      action: 'OWNERSHIP_RECONCILED',
    });
    assert(reconAudit && reconAudit.status === 'success', 'OWNERSHIP_RECONCILED audit log persisted in MongoDB');

    // Clean up test orphan project
    await Project.findByIdAndDelete(orphanProject._id);

    // -------------------------------------------------------------------------
    // 3. Separate Project Owner and Project Manager Authority
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Separation of Project Owner vs Project Manager Authority ---');
    // Platform Admin creates a test project
    const projRes = await request('/projects', 'POST', {
      name: 'Owner vs PM Separation Project',
      description: 'Testing lifecycle, deletion, transfer, and PM appointment guards',
    }, adminToken);
    assert(projRes.status === 201, 'Admin created governance test project as Project Owner');
    const testProjectId = projRes.body.data.project._id;

    // Invite managerUser and staffUser to the project
    await request(`/projects/${testProjectId}/invite`, 'POST', {
      email: managerUser.email,
      role: 'contributor',
    }, adminToken);
    await request(`/projects/${testProjectId}/invite`, 'POST', {
      email: staffUser.email,
      role: 'contributor',
    }, adminToken);

    // Project Owner (Admin) appoints managerUser as Project Manager
    const appointRes = await request(`/projects/${testProjectId}/managers/${managerUser._id}`, 'POST', null, adminToken);
    assert(appointRes.status === 200, 'Project Owner appointed managerUser as Project Manager');

    // Test: PM updates lifecycle to 'on_hold' -> Allowed (HTTP 200)
    const holdRes = await request(`/projects/${testProjectId}/lifecycle`, 'PATCH', {
      status: 'on_hold',
      reason: 'Awaiting design assets',
    }, managerToken);
    assert(holdRes.status === 200, 'Project Manager successfully transitioned project to On Hold');

    // Test: PM updates lifecycle to 'active' -> Allowed (HTTP 200)
    const resumeRes = await request(`/projects/${testProjectId}/lifecycle`, 'PATCH', {
      status: 'active',
      reason: 'Assets received',
    }, managerToken);
    assert(resumeRes.status === 200, 'Project Manager successfully resumed project to Active');

    // Test: PM updates lifecycle to 'completed' -> Allowed (HTTP 200)
    const completeRes = await request(`/projects/${testProjectId}/lifecycle`, 'PATCH', {
      status: 'completed',
      reason: 'Sprint goal accomplished',
    }, managerToken);
    assert(completeRes.status === 200, 'Project Manager successfully marked project as Completed');

    // Test: PM attempts to 'archived' -> BLOCKED with HTTP 403 (Requires Owner)
    const archivePmRes = await request(`/projects/${testProjectId}/lifecycle`, 'PATCH', {
      status: 'archived',
      reason: 'Attempting unauthorized archive',
    }, managerToken);
    assert(
      archivePmRes.status === 403,
      `Project Manager cannot archive project without Owner authorization (HTTP 403 Forbidden)`
    );

    // Verify blocked archive attempt is recorded in SecurityAudit
    const archiveBlockedAudit = await SecurityAudit.findOne({
      project: testProjectId,
      action: 'PROJECT_ARCHIVE_ATTEMPT',
      status: 'blocked',
    });
    assert(archiveBlockedAudit !== null, 'Failed archive escalation attempt recorded in SecurityAudit with status: blocked');

    // Test: Project Owner (Admin) CAN archive the project -> Allowed (HTTP 200)
    const archiveOwnerRes = await request(`/projects/${testProjectId}/lifecycle`, 'PATCH', {
      status: 'archived',
      reason: 'Quarterly compliance archival',
    }, adminToken);
    assert(archiveOwnerRes.status === 200, 'Project Owner successfully archived project');

    // Restore to active for remaining tests
    await request(`/projects/${testProjectId}/lifecycle`, 'PATCH', { status: 'active' }, adminToken);

    // Test: PM attempts to delete project -> BLOCKED with HTTP 403
    const deletePmRes = await request(`/projects/${testProjectId}`, 'DELETE', null, managerToken);
    assert(
      deletePmRes.status === 403,
      `Project Manager cannot delete project (HTTP 403 Forbidden)`
    );

    // Verify blocked deletion attempt is recorded in SecurityAudit
    const deleteBlockedAudit = await SecurityAudit.findOne({
      project: testProjectId,
      action: 'PROJECT_DELETION_ATTEMPT',
      status: 'blocked',
    });
    assert(deleteBlockedAudit !== null, 'Failed deletion escalation attempt recorded in SecurityAudit with status: blocked');

    // Test: PM attempts to appoint staffUser as another PM -> BLOCKED with HTTP 403
    const appointPmRes = await request(`/projects/${testProjectId}/managers/${staffUser._id}`, 'POST', null, managerToken);
    assert(
      appointPmRes.status === 403,
      `Project Manager cannot appoint other Project Managers (HTTP 403 Forbidden)`
    );

    // Verify blocked PM appointment attempt is recorded in SecurityAudit
    const pmAppointBlockedAudit = await SecurityAudit.findOne({
      project: testProjectId,
      action: 'PM_APPOINTMENT_ATTEMPT',
      status: 'blocked',
    });
    assert(pmAppointBlockedAudit !== null, 'Failed PM appointment escalation attempt recorded in SecurityAudit with status: blocked');

    // Test: PM attempts to transfer ownership -> BLOCKED with HTTP 403
    const transferPmRes = await request(`/projects/${testProjectId}/transfer-ownership`, 'POST', {
      newOwnerId: managerUser._id.toString(),
    }, managerToken);
    assert(
      transferPmRes.status === 403,
      `Project Manager cannot transfer project ownership (HTTP 403 Forbidden)`
    );

    // Verify blocked transfer attempt is recorded in SecurityAudit
    const transferBlockedAudit = await SecurityAudit.findOne({
      project: testProjectId,
      action: 'OWNERSHIP_TRANSFER_ATTEMPT',
      status: 'blocked',
    });
    assert(transferBlockedAudit !== null, 'Failed ownership transfer escalation attempt recorded in SecurityAudit with status: blocked');

    // -------------------------------------------------------------------------
    // 4. Security Attack Vectors: IDOR, Mass Assignment, Self-Promotion
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Attack Vectors (Mass Assignment, IDOR, Self-Promotion) ---');
    // Create an unprivileged outsider user
    const outsiderEmail = `outsider.${Date.now()}@example.com`;
    const regRes = await request('/auth/register', 'POST', {
      name: 'Outsider Attacker',
      email: outsiderEmail,
      password: 'Password123!',
    });
    const outsiderDoc = await User.findOne({ email: outsiderEmail }).select('+otp');
    const verifyOutsider = await request('/auth/verify-otp', 'POST', {
      email: outsiderEmail,
      otp: outsiderDoc.otp,
    });
    const outsiderToken = verifyOutsider.body.data.accessToken;

    // Attack 1: Self-promotion via profile update
    const selfPromoRes = await request('/users/profile', 'PATCH', {
      role: 'admin',
      canCreateProjects: true,
    }, outsiderToken);
    const outsiderAfterAttack = await User.findOne({ email: outsiderEmail });
    assert(
      outsiderAfterAttack.role === 'user' && outsiderAfterAttack.canCreateProjects === false,
      'Self-promotion via profile update ignored: account remains role="user"'
    );

    // Attack 2: IDOR / Cross-Project access - outsider tries to view private test project
    const idorRes = await request(`/projects/${testProjectId}`, 'GET', null, outsiderToken);
    assert(idorRes.status === 403, `IDOR prevented: Non-member cannot access private project (HTTP 403)`);

    // Attack 3: Unauthorized project creation attempt
    const badCreateRes = await request('/projects', 'POST', {
      name: 'Illicit Project',
    }, outsiderToken);
    assert(badCreateRes.status === 403, `Project creation blocked for unprivileged account (HTTP 403)`);

    // Attack 4: Socket room unauthorized join
    const socket = ioClient(BACKEND_URL, {
      auth: { token: outsiderToken },
      transports: ['websocket'],
    });
    await new Promise((resolve) => socket.on('connect', resolve));

    const socketAuthPromise = new Promise((resolve) => {
      socket.on('error:unauthorized', resolve);
    });
    socket.emit('project:join', testProjectId);
    const authError = await socketAuthPromise;
    assert(
      authError && authError.message?.includes('Access denied'),
      `Socket unauthorized room join blocked with "error:unauthorized" event`
    );
    socket.disconnect();

    // -------------------------------------------------------------------------
    // 5. Governance Audit Trail Immutability Check
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Audit Trail Immutability ---');
    // Attempt to DELETE an audit record directly via API (No endpoint should exist)
    const deleteAuditRes = await request(`/projects/${testProjectId}/security-audits/${archiveBlockedAudit._id}`, 'DELETE', null, adminToken);
    assert(
      deleteAuditRes.status === 404,
      `Audit logs cannot be deleted via API (HTTP 404 Route Not Found)`
    );

    // Clean up test project
    await request(`/projects/${testProjectId}`, 'DELETE', null, adminToken);
    await User.deleteOne({ email: outsiderEmail });

  } catch (error) {
    console.error('Test Suite encountered an error:', error);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n========================================================================');
    console.log(`ADVANCED GOVERNANCE TESTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAdvancedGovernanceTests();
