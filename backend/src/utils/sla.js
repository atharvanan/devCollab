/**
 * Enterprise Service Level Agreement (SLA) Engine
 * Standard SDLC & ITSM Policies:
 * - Critical (P1): 2h Response / 8h Resolution
 * - High (P2): 6h Response / 24h Resolution
 * - Medium (P3): 24h Response / 72h Resolution
 * - Low (P4): 48h Response / 168h Resolution
 */

const SLA_POLICIES = {
  critical: {
    priority: 'critical',
    code: 'P1-CRITICAL',
    label: 'Critical (P1)',
    responseHours: 2,
    resolutionHours: 8,
    color: '#ef4444',
  },
  high: {
    priority: 'high',
    code: 'P2-HIGH',
    label: 'High (P2)',
    responseHours: 6,
    resolutionHours: 24,
    color: '#f97316',
  },
  medium: {
    priority: 'medium',
    code: 'P3-MEDIUM',
    label: 'Medium (P3)',
    responseHours: 24,
    resolutionHours: 72,
    color: '#eab308',
  },
  low: {
    priority: 'low',
    code: 'P4-LOW',
    label: 'Low (P4)',
    responseHours: 48,
    resolutionHours: 168,
    color: '#3b82f6',
  },
};

/**
 * Compute response and resolution deadlines from creation timestamp
 */
function computeSlaDeadlines(priority = 'medium', createdAt = new Date()) {
  const policy = SLA_POLICIES[priority] || SLA_POLICIES.medium;
  const baseTime = new Date(createdAt).getTime();

  const responseDeadline = new Date(baseTime + policy.responseHours * 60 * 60 * 1000);
  const resolutionDeadline = new Date(baseTime + policy.resolutionHours * 60 * 60 * 1000);

  return {
    policy,
    responseDeadline,
    resolutionDeadline,
  };
}

/**
 * Format milliseconds into human-readable duration (e.g., "3h 45m" or "45m")
 */
function formatDuration(ms) {
  const absMs = Math.abs(ms);
  const totalMinutes = Math.floor(absMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Calculate dynamic real-time SLA status for a task
 */
function evaluateTaskSla(task) {
  const priority = task.priority || 'medium';
  const policy = SLA_POLICIES[priority] || SLA_POLICIES.medium;
  const now = new Date();
  const createdAt = task.createdAt ? new Date(task.createdAt) : now;

  const responseDeadline = task.sla?.responseDeadline
    ? new Date(task.sla.responseDeadline)
    : new Date(createdAt.getTime() + policy.responseHours * 3600000);

  const resolutionDeadline = task.sla?.resolutionDeadline
    ? new Date(task.sla.resolutionDeadline)
    : new Date(createdAt.getTime() + policy.resolutionHours * 3600000);

  const column = task.column || 'backlog';
  const isStarted = ['in_progress', 'review', 'done'].includes(column);
  const isDone = column === 'done';

  // 1. Response SLA
  let responseBreached = Boolean(task.sla?.responseBreached);
  let responseRemainingMs = responseDeadline.getTime() - (task.startedAt ? new Date(task.startedAt).getTime() : now.getTime());

  if (!isStarted && now > responseDeadline) {
    responseBreached = true;
  }

  // 2. Resolution SLA
  let resolutionBreached = Boolean(task.sla?.resolutionBreached);
  const completedTime = task.completedAt ? new Date(task.completedAt).getTime() : (task.closedAt ? new Date(task.closedAt).getTime() : now.getTime());
  let resolutionRemainingMs = resolutionDeadline.getTime() - completedTime;

  if (!isDone && now > resolutionDeadline) {
    resolutionBreached = true;
  } else if (isDone && (task.completedAt || task.closedAt)) {
    resolutionBreached = completedTime > resolutionDeadline.getTime();
  }

  // Overall SLA state: 'fulfilled' | 'breached' | 'at_risk' | 'healthy'
  let state = 'healthy';
  let label = '';
  let badgeColor = 'emerald';

  if (isDone) {
    if (resolutionBreached) {
      state = 'breached';
      label = `Resolved Post-Breach (${formatDuration(completedTime - createdAt.getTime())})`;
      badgeColor = 'rose';
    } else {
      state = 'fulfilled';
      label = `SLA Met (${formatDuration(completedTime - createdAt.getTime())})`;
      badgeColor = 'emerald';
    }
  } else if (resolutionBreached) {
    state = 'breached';
    label = `SLA BREACHED (-${formatDuration(now.getTime() - resolutionDeadline.getTime())})`;
    badgeColor = 'rose';
  } else if (responseBreached) {
    state = 'breached';
    label = `Response Breached (-${formatDuration(now.getTime() - responseDeadline.getTime())})`;
    badgeColor = 'rose';
  } else {
    // Check if at risk: less than 25% of resolution time left or less than 2h
    const totalResolutionTime = resolutionDeadline.getTime() - createdAt.getTime();
    const isAtRisk = resolutionRemainingMs < Math.max(2 * 3600000, totalResolutionTime * 0.25);

    if (isAtRisk) {
      state = 'at_risk';
      label = `SLA At Risk (${formatDuration(resolutionRemainingMs)} left)`;
      badgeColor = 'amber';
    } else {
      state = 'healthy';
      label = `SLA: ${formatDuration(resolutionRemainingMs)} left`;
      badgeColor = 'sky';
    }
  }

  return {
    policy,
    responseDeadline,
    resolutionDeadline,
    responseBreached,
    resolutionBreached,
    state,
    label,
    badgeColor,
    remainingMs: resolutionRemainingMs,
  };
}

module.exports = {
  SLA_POLICIES,
  computeSlaDeadlines,
  evaluateTaskSla,
  formatDuration,
};

