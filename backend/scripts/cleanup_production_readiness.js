const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Task = require('../src/models/Task');
const CollabSession = require('../src/models/CollabSession');
const Review = require('../src/models/Review');
const Notification = require('../src/models/Notification');
const SecurityAudit = require('../src/models/SecurityAudit');
const { bootstrapPlatformAdmin } = require('../src/utils/adminProvisioning');

const BOT_EMAILS = [
  'alex.frontend@devcollab.com',
  'sarah.backend@devcollab.com',
  'david.qa@devcollab.com',
  'emma.designer@devcollab.com',
  'lucas.devops@devcollab.com',
  'frank.security@devcollab.com',
  'grace.db@devcollab.com',
];

async function runCleanup() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devcollab';
  console.log(`[CLEANUP] Connecting to MongoDB: ${mongoURI}`);
  await mongoose.connect(mongoURI);

  console.log('[CLEANUP] Step 1: Purging all test bot accounts...');
  const botUsers = await User.find({ email: { $in: BOT_EMAILS } });
  const botUserIds = botUsers.map((u) => u._id);

  if (botUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: botUserIds } });
    console.log(`[CLEANUP] Removed ${botUserIds.length} bot user accounts.`);

    // Remove bot memberships from projects
    await Project.updateMany(
      {},
      { $pull: { members: { user: { $in: botUserIds } } } }
    );

    // Remove bot assignees from tasks
    await Task.updateMany(
      {},
      { $pull: { assignees: { $in: botUserIds } } }
    );
  } else {
    console.log('[CLEANUP] No bot user accounts found.');
  }

  console.log('[CLEANUP] Step 2: Cleaning synthetic/bot chat messages in CollabSessions...');
  await CollabSession.updateMany(
    {},
    {
      $pull: {
        messages: {
          $or: [
            { user: { $in: botUserIds } },
            { name: { $regex: /Emma Watson|Alex Rivera|Sarah Chen|David Kim|Lucas Vance/i } }
          ]
        },
        contributors: {
          $or: [
            { user: { $in: botUserIds } },
            { name: { $regex: /Emma Watson|Alex Rivera|Sarah Chen|David Kim|Lucas Vance/i } }
          ]
        }
      }
    }
  );

  console.log('[CLEANUP] Step 3: Resetting / Re-provisioning Platform Administrator...');
  // Ensure default commercial admin exists: admin@devcollab.com / Password123!
  const admin = await bootstrapPlatformAdmin();
  console.log(`[CLEANUP] Platform Administrator active: ${admin.email}`);

  // Reconcile project ownership for any projects owned by bots or personal accounts
  const personalUsers = await User.find({
    email: { $in: ['atharvanandurkar2411@gmail.com', 'nandurkaratharva2411@gmail.com'] }
  });
  const reassignUserIds = [...botUserIds, ...personalUsers.map(u => u._id)];

  const projectsToReassign = await Project.find({
    $or: [
      { owner: { $in: reassignUserIds } },
      { name: 'DevCollab' }
    ]
  });

  for (const proj of projectsToReassign) {
    proj.owner = admin._id;
    // Remove old personal/bot users from members
    proj.members = proj.members.filter(m => !reassignUserIds.some(uid => uid.toString() === (m.user?._id || m.user)?.toString()));
    const hasAdminMember = proj.members.some((m) => (m.user?._id || m.user)?.toString() === admin._id.toString());
    if (!hasAdminMember) {
      proj.members.push({ user: admin._id, role: 'project_manager', joinedAt: new Date() });
    } else {
      const adminMember = proj.members.find((m) => (m.user?._id || m.user)?.toString() === admin._id.toString());
      if (adminMember) adminMember.role = 'project_manager';
    }
    await proj.save();
    console.log(`[CLEANUP] Reassigned project "${proj.name}" to platform administrator (${admin.email}).`);
  }

  // Purge personal test profiles to ensure pure commercial SaaS state
  if (personalUsers.length > 0) {
    await User.deleteMany({ _id: { $in: personalUsers.map(u => u._id) } });
    console.log(`[CLEANUP] Purged ${personalUsers.length} personal profile(s) from MongoDB.`);
  }

  console.log('[CLEANUP] Cleanup completed successfully!');
  await mongoose.disconnect();
}

runCleanup().catch((err) => {
  console.error('[CLEANUP] Failed:', err);
  process.exit(1);
});
