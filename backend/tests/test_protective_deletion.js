const mongoose = require('mongoose');

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api/v1';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return { status: res.status, data };
}

async function run() {
  console.log('========================================================================');
  console.log('TEST SUITE: PROTECTIVE PROJECT DELETION & MEMBER CONSENSUS VOTING');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://devcollab-mongo:27017/devcollab';
  await mongoose.connect(mongoUri);

  const User = require('../src/models/User');
  const Project = require('../src/models/Project');
  const { generateAccessToken } = require('../src/utils/jwt');

  const timestamp = Date.now();
  const pmUser = await User.create({
    name: `PM Tester ${timestamp}`,
    email: `pm_${timestamp}@devcollab.io`,
    password: 'Password123!',
    role: 'user',
    canCreateProjects: true,
    isEmailVerified: true,
  });

  const memberUser = await User.create({
    name: `Dev Member ${timestamp}`,
    email: `dev_${timestamp}@devcollab.io`,
    password: 'Password123!',
    role: 'user',
    canCreateProjects: false,
    isEmailVerified: true,
  });

  const pmToken = generateAccessToken(pmUser._id);
  const memberToken = generateAccessToken(memberUser._id);

  const pmHeaders = { Authorization: `Bearer ${pmToken}` };
  const memberHeaders = { Authorization: `Bearer ${memberToken}` };

  try {
    // Step 1: Create a project with PM as owner
    const createRes = await request('/projects', {
      method: 'POST',
      headers: pmHeaders,
      body: {
        name: `Protective Deletion Test Project ${timestamp}`,
        description: 'Verifying unanimous member upvoting requirement for project deletion',
        visibility: 'private',
      },
    });
    const projectId = createRes.data.data.project._id;
    console.log(`[PASS] 1. PM created test project ${projectId}`);

    // Step 2: Add member to project
    await request(`/projects/${projectId}/invite`, {
      method: 'POST',
      headers: pmHeaders,
      body: {
        email: memberUser.email,
        role: 'frontend_developer',
      },
    });
    console.log('[PASS] 2. Invited second member into project (now 2 members)');

    // Step 3: PM attempts unilateral deletion without member voting
    try {
      await request(`/projects/${projectId}`, {
        method: 'DELETE',
        headers: pmHeaders,
      });
      console.error('[FAIL] 3. Unilateral deletion was allowed without member consensus!');
      process.exit(1);
    } catch (err) {
      if (err.status === 403) {
        console.log(`[PASS] 3. Protective Deletion Guard: Unilateral deletion rejected (HTTP 403): "${err.data.message}"`);
      } else {
        console.error('[FAIL] 3. Unexpected error:', err.message);
        process.exit(1);
      }
    }

    // Step 4: PM initiates a deletion vote
    const initiateRes = await request(`/projects/${projectId}/deletion-vote/initiate`, {
      method: 'POST',
      headers: pmHeaders,
      body: {
        reason: 'Sprint finished, decommissioning project environment',
      },
    });
    console.log(`[PASS] 4. PM initiated deletion vote: "${initiateRes.data.message}"`);

    // Step 5: Check vote status in project
    let proj = await Project.findById(projectId);
    if (proj.deletionVote.status !== 'pending') {
      console.error(`[FAIL] 5. Expected deletionVote.status to be pending, got ${proj.deletionVote.status}`);
      process.exit(1);
    }
    console.log('[PASS] 5. Project deletionVote status is "pending" with PM approval recorded');

    // Step 6: Member casts a 'reject' vote
    await request(`/projects/${projectId}/deletion-vote/vote`, {
      method: 'POST',
      headers: memberHeaders,
      body: {
        vote: 'reject',
        comment: 'Hold on, I still have unmerged code reviews!',
      },
    });
    proj = await Project.findById(projectId);
    if (proj.deletionVote.status !== 'rejected') {
      console.error(`[FAIL] 6. Expected deletionVote.status to be rejected, got ${proj.deletionVote.status}`);
      process.exit(1);
    }
    console.log('[PASS] 6. Member rejected vote -> deletionVote status is now "rejected"');

    // Step 7: Deletion still blocked when rejected
    try {
      await request(`/projects/${projectId}`, {
        method: 'DELETE',
        headers: pmHeaders,
      });
      console.error('[FAIL] 7. Deletion allowed when vote status was rejected!');
      process.exit(1);
    } catch (err) {
      if (err.status === 403) {
        console.log('[PASS] 7. Deletion blocked while vote is rejected (HTTP 403)');
      }
    }

    // Step 8: PM re-initiates deletion vote and Member votes 'approve'
    await request(`/projects/${projectId}/deletion-vote/initiate`, {
      method: 'POST',
      headers: pmHeaders,
      body: {
        reason: 'Sprint finished, team agreed to decommissioning',
      },
    });

    await request(`/projects/${projectId}/deletion-vote/vote`, {
      method: 'POST',
      headers: memberHeaders,
      body: {
        vote: 'approve',
        comment: 'Code merged, all good to decommission!',
      },
    });
    proj = await Project.findById(projectId);
    if (proj.deletionVote.status !== 'approved') {
      console.error(`[FAIL] 8. Expected deletionVote.status to be approved after unanimous votes, got ${proj.deletionVote.status}`);
      process.exit(1);
    }
    console.log('[PASS] 8. Member approved -> All members voted approve -> deletionVote status is "approved"');

    // Step 9: PM executes deletion
    const delRes = await request(`/projects/${projectId}`, {
      method: 'DELETE',
      headers: pmHeaders,
    });
    console.log(`[PASS] 9. PM successfully executed deletion with member consensus: "${delRes.data.message}"`);

    // Step 10: Verify project is deleted from DB
    const deletedProj = await Project.findById(projectId);
    if (deletedProj) {
      console.error('[FAIL] 10. Project was not deleted from MongoDB!');
      process.exit(1);
    }
    console.log('[PASS] 10. Project permanently removed from MongoDB database');

    console.log('\n========================================================================');
    console.log('PROTECTIVE DELETION TEST RESULT: 10 PASSED, 0 FAILED');
    console.log('========================================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err.data || err.message);
    process.exit(1);
  } finally {
    await User.deleteMany({ email: { $in: [pmUser.email, memberUser.email] } });
    await mongoose.disconnect();
  }
}

run();
