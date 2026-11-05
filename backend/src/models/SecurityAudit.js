const mongoose = require('mongoose');

const securityAuditSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: false, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userRole: { type: String, required: true },
    attemptedAction: { type: String, required: true },
    action: { type: String },
    targetResource: { type: String, required: true }, // 'code_review', 'task', 'project', 'membership', etc.
    targetDomain: { type: String }, // 'frontend', 'backend', 'database', 'devops_cloud', etc.
    targetId: { type: mongoose.Schema.Types.ObjectId },
    previousRole: { type: String },
    newRole: { type: String },
    details: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'high' },
    status: { type: String, enum: ['success', 'blocked', 'failed'], default: 'success' },
    metadata: { type: mongoose.Schema.Types.Mixed },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    // Compliance Retention Policy: Security audits are retained even after project deletion
    projectDeleted: { type: Boolean, default: false },
    projectDeletedAt: { type: Date },
  },
  { timestamps: true }
);

securityAuditSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model('SecurityAudit', securityAuditSchema);
