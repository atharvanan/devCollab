const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: {
          type: String,
          enum: [
            'project_manager',
            'frontend_developer',
            'backend_developer',
            'db_developer',
            'devops',
            'cloud_admin',
            'qa_tester',
            'ui_ux_designer',
            'security_engineer',
            'admin',
            'contributor',
            'viewer',
          ],
          default: 'contributor',
        },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    visibility: { type: String, enum: ['public', 'private'], default: 'private' },
    tags: [{ type: String, trim: true }],
    coverImage: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'on_hold', 'completed', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
);

projectSchema.index({ name: 'text', description: 'text' });

projectSchema.methods.isOwner = function (userId) {
  if (!userId) return false;
  const uid = (userId._id || userId).toString();
  const ownerId = (this.owner?._id || this.owner)?.toString();
  return !!ownerId && ownerId === uid;
};

projectSchema.methods.getProjectManagers = function () {
  const pms = [];
  const seen = new Set();
  const ownerId = (this.owner?._id || this.owner)?.toString();
  if (this.owner) {
    pms.push(this.owner);
    if (ownerId) seen.add(ownerId);
  }
  if (Array.isArray(this.members)) {
    this.members.forEach((m) => {
      if (m.role === 'project_manager' || m.role === 'admin') {
        const uId = (m.user?._id || m.user)?.toString();
        if (uId && !seen.has(uId) && m.user) {
          pms.push(m.user);
          seen.add(uId);
        }
      }
    });
  }
  return pms;
};

projectSchema.methods.isMember = function (userId) {
  if (!userId) return false;
  const uid = userId.toString();
  const ownerId = (this.owner?._id || this.owner)?.toString();
  if (ownerId && ownerId === uid) return true;
  return Array.isArray(this.members) && this.members.some((m) => {
    const memberId = (m.user?._id ?? m.user)?.toString();
    return memberId === uid;
  });
};

projectSchema.methods.getUserRole = function (userId) {
  if (!userId) return null;
  const uid = userId.toString();
  const ownerId = (this.owner?._id || this.owner)?.toString();
  if (ownerId && ownerId === uid) return 'project_manager';
  if (!Array.isArray(this.members)) return null;
  const member = this.members.find((m) => {
    const memberId = (m.user?._id ?? m.user)?.toString();
    return memberId === uid;
  });
  return member ? member.role : null;
};

projectSchema.methods.isProjectManager = function (userId) {
  if (!userId) return false;
  const uid = userId.toString();
  const ownerId = (this.owner?._id || this.owner)?.toString();
  if (ownerId && ownerId === uid) return true;
  const role = this.getUserRole(uid);
  return role === 'project_manager' || role === 'admin';
};

projectSchema.methods.hasAccess = function (user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (this.visibility === 'public') return true;
  const uid = (user._id || user).toString();
  return this.isOwner(uid) || this.isMember(uid);
};

module.exports = mongoose.model('Project', projectSchema);
