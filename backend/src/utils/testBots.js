const User = require('../models/User');

const TEST_BOTS = [
  {
    name: 'Alex Rivera (Frontend)',
    email: 'alex.frontend@devcollab.com',
    password: 'DevCollab123!',
    role: 'frontend_developer',
    bio: 'Senior Frontend Engineer specializing in Next.js, React, Tailwind, and WebSockets.',
  },
  {
    name: 'Sarah Chen (Backend)',
    email: 'sarah.backend@devcollab.com',
    password: 'DevCollab123!',
    role: 'backend_developer',
    bio: 'Distributed Systems & API Specialist with Node.js, Express, and MongoDB.',
  },
  {
    name: 'David Kim (QA Tester)',
    email: 'david.qa@devcollab.com',
    password: 'DevCollab123!',
    role: 'qa_tester',
    bio: 'Lead QA Automation Engineer focusing on E2E testing, Jest, and edge case discovery.',
  },
  {
    name: 'Emma Watson (UI/UX)',
    email: 'emma.designer@devcollab.com',
    password: 'DevCollab123!',
    role: 'ui_ux_designer',
    bio: 'Product Designer dedicated to accessible typography, dark mode ergonomics, and micro-interactions.',
  },
  {
    name: 'Lucas Vance (DevOps)',
    email: 'lucas.devops@devcollab.com',
    password: 'DevCollab123!',
    role: 'devops',
    bio: 'Cloud & Infrastructure Architect managing Docker, CI/CD pipelines, and cluster health.',
  },
];

const TEST_BOT_EMAILS = TEST_BOTS.map((b) => b.email.toLowerCase());

const isTestBotEmail = (email) => {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return TEST_BOT_EMAILS.includes(clean) || clean.endsWith('@devcollab.com');
};

/**
 * Ensures a test bot user exists in the database
 */
async function ensureBotUser(bot) {
  let user = await User.findOne({ email: bot.email });
  if (!user) {
    user = await User.create({
      name: bot.name,
      email: bot.email,
      password: bot.password,
      bio: bot.bio,
      isVerified: true,
    });
  }
  return user;
}

/**
 * Auto-seeds all test bots into a project's members list
 */
async function autoSeedBotsToProject(project) {
  let modified = false;
  for (const bot of TEST_BOTS) {
    const botUser = await ensureBotUser(bot);
    const existing = project.members.find(
      (m) => (m.user?._id || m.user)?.toString() === botUser._id.toString()
    );
    if (!existing) {
      project.members.push({ user: botUser._id, role: bot.role });
      modified = true;
    }
  }
  if (modified) {
    await project.save();
  }
}

/**
 * Ensures a user or bot has valid membership access to a project
 */
async function ensureProjectAccess(project, user) {
  if (!project || !user) return false;
  const userId = (user._id || user).toString();
  if (project.owner.toString() === userId) return true;

  const isMember = project.members.some(
    (m) => (m.user?._id || m.user)?.toString() === userId
  );
  if (isMember) return true;

  // Auto-heal if user is a test bot
  const userEmail = user.email || '';
  const isBot = isTestBotEmail(userEmail);
  if (isBot) {
    const bot = TEST_BOTS.find((b) => b.email.toLowerCase() === userEmail.toLowerCase());
    const role = bot?.role || 'contributor';
    project.members.push({ user: user._id || user, role });
    await project.save().catch(() => {});
    return true;
  }

  // Auto-heal if user has an assigned task in this project
  try {
    const Task = require('../models/Task');
    const hasAssignedTask = await Task.exists({ project: project._id, assignees: user._id || user });
    if (hasAssignedTask) {
      project.members.push({ user: user._id || user, role: user.role || 'contributor' });
      await project.save().catch(() => {});
      return true;
    }
  } catch (e) {}

  return project.visibility === 'public';
}

module.exports = {
  TEST_BOTS,
  TEST_BOT_EMAILS,
  isTestBotEmail,
  ensureBotUser,
  autoSeedBotsToProject,
  ensureProjectAccess,
};
