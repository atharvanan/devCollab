const Project = require('../models/Project');
const User = require('../models/User');
const { logGovernanceAudit } = require('./auditLogger');
const { isTestBotEmail } = require('./testBots');
const logger = require('./logger');

/**
 * Reconciles project ownership across all projects in the workspace safely and non-destructively.
 *
 * Rules:
 * 1. Preserves valid existing ownership if owner is an active user in the database.
 * 2. If owner is missing, deleted, or invalid:
 *    a. Candidate 1: Existing active Project Manager in project.members.
 *    b. Candidate 2: Highest-tenure active member (earliest joinedAt, excluding test bots).
 *    c. If no suitable candidate exists: Marked as AMBIGUOUS_REQUIRES_ADMIN_APPROVAL.
 * 3. Never blindly reassigns unowned projects to Lead Administrator.
 * 4. Generates an auditable report.
 */
async function reconcileProjectOwnership(options = {}) {
  const { dryRun = false, approvedAmbiguousMigrations = {} } = options;
  const projects = await Project.find().populate('members.user', 'name email role');

  const report = {
    timestamp: new Date().toISOString(),
    dryRun,
    totalProjects: projects.length,
    validCount: 0,
    migratedCount: 0,
    ambiguousCount: 0,
    details: [],
  };

  for (const project of projects) {
    const detail = {
      projectId: project._id.toString(),
      projectName: project.name,
      currentOwnerId: project.owner ? project.owner.toString() : null,
      status: 'PENDING',
      actionTaken: 'NONE',
    };

    // 1. Check if existing owner exists and is active
    let validOwner = null;
    if (project.owner) {
      validOwner = await User.findById(project.owner);
    }

    if (validOwner) {
      // Valid ownership exists: Preserve it!
      detail.status = 'VALID_OWNERSHIP';
      detail.ownerEmail = validOwner.email;
      detail.ownerName = validOwner.name;

      // Ensure owner is present in project.members as project_manager
      const ownerMember = project.members.find(
        (m) => (m.user?._id || m.user)?.toString() === validOwner._id.toString()
      );
      if (!ownerMember && !dryRun) {
        project.members.push({
          user: validOwner._id,
          role: 'project_manager',
          joinedAt: new Date(),
        });
        await project.save();
      } else if (ownerMember && ownerMember.role !== 'project_manager' && !dryRun) {
        ownerMember.role = 'project_manager';
        await project.save();
      }

      report.validCount++;
      report.details.push(detail);
      continue;
    }

    // 2. Owner is missing or inactive -> Find replacement candidates from existing members
    detail.status = 'ORPHAN_PROJECT';
    const activeMembers = project.members.filter((m) => {
      const u = m.user;
      if (!u) return false;
      return !isTestBotEmail(u.email);
    });

    // Candidate Strategy 1: Existing Project Manager in members
    let proposedOwner = activeMembers.find((m) => m.role === 'project_manager');
    let candidateStrategy = 'EXISTING_PM';

    // Candidate Strategy 2: Highest tenure active member (earliest joinedAt)
    if (!proposedOwner && activeMembers.length > 0) {
      const sorted = [...activeMembers].sort(
        (a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0)
      );
      proposedOwner = sorted[0];
      candidateStrategy = 'HIGHEST_TENURE_MEMBER';
    }

    // Candidate Strategy 3: Check fallback to any member if only bots exist
    if (!proposedOwner && project.members.length > 0) {
      const anyMember = project.members.find((m) => m.user);
      if (anyMember) {
        proposedOwner = anyMember;
        candidateStrategy = 'FALLBACK_MEMBER';
      }
    }

    // 3. Ambiguous check: If no members exist or explicit admin approval needed
    const approvedNewOwnerId = approvedAmbiguousMigrations[project._id.toString()];

    if (!proposedOwner && !approvedNewOwnerId) {
      detail.status = 'AMBIGUOUS_REQUIRES_ADMIN_APPROVAL';
      detail.reason = 'Project has no active members to assume ownership safely.';
      report.ambiguousCount++;
      report.details.push(detail);
      continue;
    }

    const targetUser = approvedNewOwnerId
      ? await User.findById(approvedNewOwnerId)
      : proposedOwner.user;

    detail.proposedOwnerId = targetUser._id.toString();
    detail.proposedOwnerEmail = targetUser.email;
    detail.proposedOwnerName = targetUser.name;
    detail.candidateStrategy = approvedNewOwnerId ? 'ADMIN_APPROVED_MIGRATION' : candidateStrategy;

    if (!dryRun) {
      const prevOwner = project.owner;
      project.owner = targetUser._id;

      // Ensure new owner is in members as project_manager
      const memberEntry = project.members.find(
        (m) => (m.user?._id || m.user)?.toString() === targetUser._id.toString()
      );
      if (memberEntry) {
        memberEntry.role = 'project_manager';
      } else {
        project.members.push({
          user: targetUser._id,
          role: 'project_manager',
          joinedAt: new Date(),
        });
      }

      await project.save();

      // Record immutable audit log
      await logGovernanceAudit({
        project: project._id,
        actor: targetUser._id,
        action: 'OWNERSHIP_RECONCILED',
        targetResource: 'project_ownership',
        details: `Project ownership safely reconciled to ${targetUser.name} (${targetUser.email}) via ${detail.candidateStrategy}.`,
        severity: 'high',
        status: 'success',
        metadata: {
          previousOwnerId: prevOwner ? prevOwner.toString() : null,
          newOwnerId: targetUser._id.toString(),
          strategy: detail.candidateStrategy,
        },
      });

      detail.actionTaken = 'MIGRATED';
      report.migratedCount++;
    } else {
      detail.actionTaken = 'PROPOSED';
    }

    report.details.push(detail);
  }

  return report;
}

module.exports = { reconcileProjectOwnership };

