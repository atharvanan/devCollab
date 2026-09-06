const mongoose = require('mongoose');

const inlineCommentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lineNumber: { type: Number, required: true },
    content: { type: String, required: true, maxlength: 2000 },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String },
      },
    ],
  },
  { timestamps: true }
);

const reviewSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000, default: '' },
    code: { type: String, required: true },
    language: { type: String, default: 'javascript' },
    status: {
      type: String,
      enum: ['open', 'in_review', 'approved', 'changes_requested', 'closed'],
      default: 'open',
    },
    inlineComments: [inlineCommentSchema],
    generalComments: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: { type: String, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    reviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    attachments: [{ url: String, publicId: String, name: String }],
  },
  { timestamps: true }
);

reviewSchema.index({ project: 1, createdAt: -1 });
reviewSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Review', reviewSchema);
