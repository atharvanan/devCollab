const http = require('http');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const SecurityAudit = require('../src/models/SecurityAudit');
const { generateAccessToken } = require('../src/utils/jwt');

const API_BASE = 'http://localhost:5000/api/v1';

async function request(urlStr, method = 'GET', data = null, token = null) {
  const url = new URL(urlStr.startsWith('http') ? urlStr : `${API_BASE}${urlStr}`);
  const payload = data ? JSON.stringify(data) : null;
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (payload) {
    options.headers['Content-Length'] = Buffer.byteLength(payload);
  }
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
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runGovernanceTests() {
  console.log('========================================================================');
  console.log('PROJECT OWNERSHIP, PM AUTHORIZATION & GOVERNANCE TEST SUITE');
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

  async function getOrCreateUser(name, email, role = 'user', canCreateProjects = false) {
    let u = await User.findOne({ email });
    if (!u) {
      u = await User.create({ name, email, password: 'Password123!', role, canCreateProjects, isVerified: true });
    } else {
      u.role = role;
      u.canCreateProjects = canCreateProjects;
      u.isVerified = true;
      await u.save();
    }
    const token = generateAccessToken(u._id);
    return { user: u.toPublicJSON(), token };
  }

  // Authenticate Platform Administrator
  const adminAccount = await getOrCreateUser('Workspace Administrator', 'admin@devcollab.com', 'admin', true);
  const adminToken = adminAccount.token;
  const adminUser = adminAccount.user;
  assert(adminToken && adminUser.role === 'admin', '1. Platform Administrator authenticated with elevated privileges');

  // Authenticate Team Members for multi-role governance testing
  const alexAccount = await getOrCreateUser('Alex Test', 'alex.test@example.com', 'user', false);
  const alexToken = alexAccount.token;
  const alexUser = alexAccount.user;

  const sarahAccount = await getOrCreateUser('Sarah Test', 'sarah.test@example.com', 'user', false);
  const sarahToken = sarahAccount.token;
  const sarahUser = sarahAccount.user;

  // -------------------------------------------------------------------------
  // SECTION 1: Default Registration & Privilege Escalation Defense
  // -------------------------------------------------------------------------
  const attackEmail = `attacker.${Date.now()}@example.com`;
  const privEscPayload = {
    name: 'Malicious PrivEsc Attacker',
    email: attackEmail,
    password: 'Password123!',
    role: 'admin', // Attack vector: trying to register as admin
    canCreateProjects: true, // Attack vector: trying to claim project creation
  };

  const privEscRes = await request('/auth/register', 'POST', privEscPayload);
  assert(
    privEscRes.status === 400,
    '2. Defensive Security: Attempt to register with elevated privilege fields (role, canCreateProjects) is strictly rejected by server validation (HTTP 400)'
  );

  // Standard legitimate registration without privilege injection
  const testEmail = `new.dev.${Date.now()}@example.com`;
  const regPayload = {
    name: 'Junior Developer',
    email: testEmail,
    password: 'Password123!',
  };

  const regRes = await request('/auth/register', 'POST', regPayload);
  assert(regRes.status === 201, '3. Standard user registration succeeds with HTTP 201');

  // Verify DB state: account must strictly be regular user and can create projects as PM
  const registeredUserInDB = await User.findOne({ email: testEmail });
  assert(
    registeredUserInDB &&
    registeredUserInDB.role === 'user' &&
    registeredUserInDB.canCreateProjects === true,
    '4. DB Verification: Account assigned default role "user" with project creation rights enabled'
  );

  // Verify OTP for this new user to get token
  const userWithOtp = await User.findOne({ email: testEmail }).select('+otp');
  const otpRes = await request('/auth/verify-otp', 'POST', {
    email: testEmail,
    otp: userWithOtp.otp,
  });
  const newDevToken = otpRes.body.data.accessToken;

  // -------------------------------------------------------------------------
  // SECTION 2: Project Creation & Creator as Project Manager
  // -------------------------------------------------------------------------
  // When an explicitly restricted user attempts to create a project
  await User.updateOne({ _id: registeredUserInDB._id }, { $set: { canCreateProjects: false } });
  const badCreateRes = await request('/projects', 'POST', {
    name: 'Unauthorized Project Attempt',
    description: 'Should fail with 403',
  }, newDevToken);

  assert(
    badCreateRes.status === 403,
    '5. Authorization Guard: Restricted user cannot create projects (HTTP 403 Forbidden)'
  );

  // Re-enable permission and verify creator becomes Owner and PM
  await User.updateOne({ _id: registeredUserInDB._id }, { $set: { canCreateProjects: true } });

  // Legitimate creation by Platform Admin
  const goodCreateRes = await request('/projects', 'POST', {
    name: 'Enterprise Governance Core',
    description: 'Mission critical enterprise banking portal with strict PM authorization',
    visibility: 'private',
    tags: ['FinTech', 'Security', 'Audit'],
  }, adminToken);

  assert(goodCreateRes.status === 201 && goodCreateRes.body.data.project, '5. Authorized creation: Platform Admin creates project successfully (HTTP 201)');
  const project = goodCreateRes.body.data.project;
  const projectId = project._id;

  assert(
    project.owner._id.toString() === adminUser._id.toString(),
    '6. Ownership Assignment: Creator is automatically assigned as Project Owner'
  );

  // Verify PROJECT_CREATED governance audit in DB
  const createAudit = await SecurityAudit.findOne({
    project: projectId,
    attemptedAction: 'PROJECT_CREATED',
  });
  assert(
    createAudit && createAudit.user.toString() === adminUser._id.toString(),
    '7. Audit Trail: PROJECT_CREATED immutable audit record saved to MongoDB'
  );

  // -------------------------------------------------------------------------
  // SECTION 3: Project Manager Appointment & Revocation
  // -------------------------------------------------------------------------
  // Invite Alex and Sarah as legitimate team members
  await request(`/projects/${projectId}/invite`, 'POST', {
    email: alexUser.email,
    role: 'frontend_developer',
  }, adminToken);

  await request(`/projects/${projectId}/invite`, 'POST', {
    email: sarahUser.email,
    role: 'backend_developer',
  }, adminToken);

  const updatedProject = (await request(`/projects/${projectId}`, 'GET', null, adminToken)).body.data.project;
  const alexMember = updatedProject.members.find((m) => (m.user?._id || m.user).toString() === alexUser._id.toString());
  assert(alexMember !== undefined, '8. Member Alex is active in project team');

  // Attack vector: Contributor Alex attempts to appoint Sarah as Project Manager
  const illegalAppointRes = await request(`/projects/${projectId}/managers/${sarahUser._id}`, 'POST', {}, alexToken);
  assert(
    illegalAppointRes.status === 403,
    '9. Privilege Escalation Guard: Non-owner member cannot appoint Project Managers (HTTP 403 Forbidden)'
  );

  // Authorized appointment by Project Owner
  const goodAppointRes = await request(`/projects/${projectId}/managers/${alexUser._id}`, 'POST', {}, adminToken);
  assert(
    goodAppointRes.status === 200,
    '10. PM Appointment: Project Owner appoints Alex Chen as Project Manager (HTTP 200 OK)'
  );

  // Verify PM_APPOINTED audit record
  const pmAudit = await SecurityAudit.findOne({
    project: projectId,
    attemptedAction: 'PM_APPOINTED',
  });
  assert(
    pmAudit && pmAudit.targetUser.toString() === alexUser._id.toString(),
    '11. Audit Trail: PM_APPOINTED audit record logged with actor and target'
  );

  // Attack vector: Newly appointed PM Alex tries to appoint Sarah as another PM
  const pmAppointOtherRes = await request(`/projects/${projectId}/managers/${sarahUser._id}`, 'POST', {}, alexToken);
  assert(
    pmAppointOtherRes.status === 403,
    '12. Hierarchy Guard: Project Manager cannot appoint other Project Managers (Owner authority required)'
  );

  // Attack vector: PM Alex tries to revoke Project Owner
  const revokeOwnerRes = await request(`/projects/${projectId}/managers/${adminUser._id}`, 'DELETE', {}, alexToken);
  assert(
    revokeOwnerRes.status === 403 || revokeOwnerRes.status === 400,
    '13. Owner Protection: Project Owner cannot be revoked from PM position'
  );

  // Attack vector: PM Alex tries to remove PM Alex or demote via updateMemberRole
  const demoteOwnerRes = await request(`/projects/${projectId}/members/${adminUser._id}/role`, 'PATCH', {
    role: 'contributor',
  }, alexToken);
  assert(
    demoteOwnerRes.status === 400 || demoteOwnerRes.status === 403,
    '14. Owner Protection: Project Owner cannot be demoted by team members'
  );

  // Authorized revocation of Alex's PM status by Project Owner
  const revokePmRes = await request(`/projects/${projectId}/managers/${alexUser._id}`, 'DELETE', {
    newRole: 'frontend_developer',
  }, adminToken);
  if (revokePmRes.status !== 200) {
    console.error('revokePmRes DEBUG:', revokePmRes.status, JSON.stringify(revokePmRes.body));
  }
  assert(
    revokePmRes.status === 200,
    '15. PM Revocation: Project Owner revokes PM status from Alex, resetting role to frontend_developer'
  );

  // Verify PM_REVOKED audit record
  const revokeAudit = await SecurityAudit.findOne({
    project: projectId,
    attemptedAction: 'PM_REVOKED',
  });
  assert(
    revokeAudit && revokeAudit.targetUser.toString() === alexUser._id.toString(),
    '16. Audit Trail: PM_REVOKED audit record saved in DB'
  );

  // -------------------------------------------------------------------------
  // SECTION 4: Ownership Transfer Workflows
  // -------------------------------------------------------------------------
  // Attack vector: Non-owner Alex attempts to transfer ownership to Sarah
  const illegalTransferRes = await request(`/projects/${projectId}/transfer-ownership`, 'POST', {
    newOwnerId: sarahUser._id,
    reason: 'Hostile takeover attempt',
  }, alexToken);
  assert(
    illegalTransferRes.status === 403,
    '17. Ownership Guard: Non-owner cannot transfer project ownership (HTTP 403 Forbidden)'
  );

  // Attack vector: Transfer ownership to a non-member
  const nonMemberId = new mongoose.Types.ObjectId().toString();
  const badTransferNonMember = await request(`/projects/${projectId}/transfer-ownership`, 'POST', {
    newOwnerId: nonMemberId,
  }, adminToken);
  assert(
    badTransferNonMember.status === 400,
    '18. Integrity Guard: Cannot transfer ownership to a non-member of the project (HTTP 400 Bad Request)'
  );

  // Legitimate ownership transfer: Owner transfers project to Sarah Chen
  const validTransferRes = await request(`/projects/${projectId}/transfer-ownership`, 'POST', {
    newOwnerId: sarahUser._id,
    reason: 'Handover to Lead Backend Architect for Phase 2',
  }, adminToken);
  assert(
    validTransferRes.status === 200 && validTransferRes.body.data.project,
    '19. Ownership Transfer: Project Owner transfers ownership to Sarah Chen (HTTP 200 OK)'
  );

  // Verify in MongoDB: Sarah is now owner, previous owner is retained as PM, project not ownerless
  const updatedProjectInDB = await Project.findById(projectId);
  assert(
    updatedProjectInDB.owner.toString() === sarahUser._id.toString(),
    '20. DB Verification: Project owner field updated to Sarah Chen'
  );

  const prevOwnerInMembers = updatedProjectInDB.members.find(
    (m) => (m.user?._id || m.user).toString() === adminUser._id.toString()
  );
  assert(
    prevOwnerInMembers && prevOwnerInMembers.role === 'project_manager',
    '21. DB Verification: Previous owner retained as Project Manager in project.members'
  );

  // Verify OWNERSHIP_TRANSFERRED audit in DB
  const transferAudit = await SecurityAudit.findOne({
    project: projectId,
    attemptedAction: 'OWNERSHIP_TRANSFERRED',
  });
  assert(
    transferAudit &&
    transferAudit.targetUser.toString() === sarahUser._id.toString() &&
    transferAudit.severity === 'critical',
    '22. Audit Trail: OWNERSHIP_TRANSFERRED critical governance record saved with metadata'
  );

  // -------------------------------------------------------------------------
  // SECTION 5: Project Lifecycle Management (Active, On Hold, Completed, Archived)
  // -------------------------------------------------------------------------
  // New Owner Sarah puts project on hold
  const holdRes = await request(`/projects/${projectId}/lifecycle`, 'PATCH', {
    status: 'on_hold',
    reason: 'Waiting on third-party security certification',
  }, sarahToken);
  assert(
    holdRes.status === 200 && holdRes.body.data.project.status === 'on_hold',
    '23. Lifecycle Transition: Project Manager transitions project status to On Hold (HTTP 200 OK)'
  );

  // Resume project
  const resumeRes = await request(`/projects/${projectId}/lifecycle`, 'PATCH', {
    status: 'active',
    reason: 'Security certification approved, resuming development',
  }, sarahToken);
  assert(
    resumeRes.status === 200 && resumeRes.body.data.project.status === 'active',
    '24. Lifecycle Transition: Project Manager resumes active project status (HTTP 200 OK)'
  );

  // -------------------------------------------------------------------------
  // SECTION 6: Project Governance Summary API
  // -------------------------------------------------------------------------
  const govSummaryRes = await request(`/projects/${projectId}/governance`, 'GET', null, sarahToken);
  assert(
    govSummaryRes.status === 200 &&
    govSummaryRes.body.data.currentUserPermissions.isOwner === true &&
    govSummaryRes.body.data.currentUserPermissions.canTransferOwnership === true,
    '25. Governance Summary: /projects/:id/governance returns structured ownership & permission matrix'
  );

  // Clean up test project and user
  await request(`/projects/${projectId}`, 'DELETE', null, adminToken);
  await User.deleteOne({ email: testEmail });

  console.log('\n========================================================================');
  console.log(`GOVERNANCE TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runGovernanceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
