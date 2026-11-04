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
  {
    name: 'Frank Miller (Security)',
    email: 'frank.security@devcollab.com',
    password: 'DevCollab123!',
    role: 'security_engineer',
    bio: 'Application Security Engineer specializing in OWASP compliance, vulnerability triage, and audit trails.',
  },
  {
    name: 'Grace Hopper (Database)',
    email: 'grace.db@devcollab.com',
    password: 'DevCollab123!',
    role: 'db_developer',
    bio: 'Database Reliability Engineer managing schema performance, indexing, and replication integrity.',
  },
];

const TEST_BOT_EMAILS = TEST_BOTS.map((b) => b.email.toLowerCase());

/**
 * Validates whether an email belongs to a designated test bot.
 * STRICT SECURITY REQUIREMENT:
 * In production (NODE_ENV=production), test bot bypasses are COMPLETELY DISABLED.
 * Also strictly matches only the exact predefined bot email list.
 */
const isTestBotEmail = (email) => {
  if (!email) return false;
  if (process.env.NODE_ENV === 'production') return false;
  const clean = email.toLowerCase().trim();
  return TEST_BOT_EMAILS.includes(clean);
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
      role: 'user',
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
 * Ensures a user or bot has valid membership access to a project.
 * Only explicit members or the owner have access to private projects.
 */
async function ensureProjectAccess(project, user) {
  if (!project || !user) return false;
  const userId = (user._id || user).toString();
  const ownerId = (project.owner?._id || project.owner)?.toString();
  if (ownerId && ownerId === userId) return true;

  const isMember = project.members.some(
    (m) => (m.user?._id || m.user)?.toString() === userId
  );
  if (isMember) return true;

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
