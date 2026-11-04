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

projectSchema.methods.isMember = function (userId) {
  if (!userId) return false;
  const uid = userId.toString();
  if (this.owner && this.owner.toString() === uid) return true;
  return Array.isArray(this.members) && this.members.some((m) => {
    const memberId = (m.user?._id ?? m.user)?.toString();
    return memberId === uid;
  });
};

projectSchema.methods.getUserRole = function (userId) {
  if (!userId) return null;
  const uid = userId.toString();
  if (this.owner && this.owner.toString() === uid) return 'project_manager';
  if (!Array.isArray(this.members)) return null;
  const member = this.members.find((m) => {
    const memberId = (m.user?._id ?? m.user)?.toString();
    return memberId === uid;
  });
  return member ? member.role : null;
};

projectSchema.methods.isProjectManager = function (userId) {
  const uid = userId.toString();
  if (this.owner.toString() === uid) return true;
  const role = this.getUserRole(uid);
  return role === 'project_manager' || role === 'admin';
};

module.exports = mongoose.model('Project', projectSchema);
