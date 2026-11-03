const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000, default: '' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    column: {
      type: String,
      enum: ['backlog', 'todo', 'in_progress', 'review', 'done'],
      default: 'backlog',
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    targetRole: {
      type: String,
      enum: [
        'any',
        'frontend_developer',
        'backend_developer',
        'db_developer',
        'devops',
        'cloud_admin',
        'qa_tester',
        'ui_ux_designer',
        'security_engineer',
      ],
      default: 'any',
    },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    order: { type: Number, default: 0 },
    labels: [{ type: String }],
    attachments: [{ url: String, publicId: String, name: String }],
    linkedReview: { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
    completedByAssignee: { type: Boolean, default: false },
    completedAt: { type: Date },
    resolutionNotes: { type: String, default: '' },
    activityNotes: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        authorName: { type: String },
        role: { type: String },
        action: { type: String, enum: ['created', 'submitted', 'changes_requested', 'approved', 'comment'], default: 'comment' },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    managerReview: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      feedback: { type: String, default: '' },
      reviewedAt: { type: Date },
    },
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, column: 1, order: 1 });

module.exports = mongoose.model('Task', taskSchema);
