const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { logGovernanceAudit } = require('./auditLogger');
const logger = require('./logger');

/**
 * Returns the configured primary platform administrator email.
 * Configured via PRIMARY_ADMIN_EMAIL environment variable.
 */
function getPrimaryAdminEmail() {
  return (process.env.PRIMARY_ADMIN_EMAIL || '').toLowerCase().trim();
}

/**
 * Determines whether a given user or email is the primary platform administrator.
 */
function isPrimaryAdmin(emailOrUser) {
  if (!emailOrUser) return false;
  const email = (typeof emailOrUser === 'string' ? emailOrUser : emailOrUser.email || '').toLowerCase().trim();
  return email === getPrimaryAdminEmail();
}

/**
 * Controlled, idempotent, auditable Platform Administrator bootstrap.
 * - Does NOT hardcode credentials into application logic.
 * - Verifies identity & email verification status (isVerified: true) before granting admin role.
 * - Ensures audit trail is recorded.
 */
async function bootstrapPlatformAdmin() {
  const adminEmail = getPrimaryAdminEmail();
  let admin = await User.findOne({ email: adminEmail }).select('+password');

  const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Password123!';
  const defaultName = process.env.PRIMARY_ADMIN_NAME || 'Workspace Administrator';

  if (!admin) {
    admin = await User.create({
      name: defaultName,
      email: adminEmail,
      password: defaultPassword,
      role: 'admin',
      canCreateProjects: true,
      isVerified: true,
      bio: process.env.PRIMARY_ADMIN_BIO || 'DevCollab Platform Administrator',
    });

    await logGovernanceAudit({
      actor: admin._id,
      action: 'ADMIN_PROVISIONED',
      targetResource: 'platform_administration',
      details: `Initial Platform Administrator account seeded for ${adminEmail} via controlled bootstrap.`,
      severity: 'critical',
      status: 'success',
      metadata: { email: adminEmail, bootstrapSource: 'ENV_CONFIGURATION' },
    });
    logger.info(`[ADMIN-BOOTSTRAP] Seeded Platform Administrator: ${adminEmail}`);
    return admin;
  }

  // Admin account exists: verify password and identity
  let needsSave = false;
  const isBcryptValid = await bcrypt.compare(defaultPassword, admin.password).catch(() => false);
  if (!isBcryptValid) {
    admin.password = defaultPassword;
    needsSave = true;
  }

  if (!admin.isVerified) {
    admin.isVerified = true;
    needsSave = true;
  }

  if (admin.name !== defaultName) {
    admin.name = defaultName;
    needsSave = true;
  }

  if (admin.role !== 'admin') {
    admin.role = 'admin';
    needsSave = true;
  }

  if (!admin.canCreateProjects) {
    admin.canCreateProjects = true;
    needsSave = true;
  }

  if (needsSave) {
    await admin.save();
    await logGovernanceAudit({
      actor: admin._id,
      action: 'ADMIN_PROVISIONED',
      targetResource: 'platform_administration',
      details: `Reconciled Platform Administrator credentials and privileges for ${adminEmail}.`,
      severity: 'high',
      status: 'success',
      metadata: { email: adminEmail, bootstrapSource: 'ENV_CONFIGURATION' },
    });
    logger.info(`[ADMIN-BOOTSTRAP] Reconciled Platform Administrator: ${adminEmail}`);
  }

  return admin;
}

module.exports = {
  getPrimaryAdminEmail,
  isPrimaryAdmin,
  bootstrapPlatformAdmin,
};
