const mongoose = require('mongoose');

const securityAuditSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, required: true },
    attemptedAction: { type: String, required: true },
    targetResource: { type: String, required: true }, // 'code_review', 'task', etc.
    targetDomain: { type: String }, // 'frontend', 'backend', 'database', 'devops_cloud', etc.
    targetId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'high' },
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
