const mongoose = require('mongoose');

const contributorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  avatar: { type: String, default: '' },
  role: { type: String, default: 'contributor' },
  charactersAdded: { type: Number, default: 0 },
  linesContributed: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
});

const lineAttributionSchema = new mongoose.Schema({
  lineNumber: { type: Number, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String },
  updatedAt: { type: Date, default: Date.now },
});

const sessionMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'contributor' },
  avatar: { type: String, default: '' },
  content: { type: String, required: true, trim: true, maxlength: 1000 },
  timestamp: { type: Date, default: Date.now },
});

const collabSessionSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, maxlength: 500, default: '' },
    code: {
      type: String,
      default: '// DevCollab Real-Time Collaborative Workspace\n// Multiple developers can code together here.\n\nfunction main() {\n  console.log("Welcome to real-time collaboration!");\n}\n',
    },
    language: { type: String, default: 'javascript' },
    domain: {
      type: String,
      enum: ['frontend', 'backend', 'database', 'devops_cloud', 'qa', 'security', 'general'],
      default: 'general',
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
    },
    contributors: [contributorSchema],
    lineAttributions: [lineAttributionSchema],
    messages: [sessionMessageSchema],
    lastEditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    history: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        summary: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

collabSessionSchema.index({ project: 1, updatedAt: -1 });

module.exports = mongoose.model('CollabSession', collabSessionSchema);

