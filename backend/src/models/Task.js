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
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    order: { type: Number, default: 0 },
    labels: [{ type: String }],
    attachments: [{ url: String, publicId: String, name: String }],
    linkedReview: { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, column: 1, order: 1 });

module.exports = mongoose.model('Task', taskSchema);
