const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['viewer', 'contributor', 'admin'], default: 'contributor' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    visibility: { type: String, enum: ['public', 'private'], default: 'private' },
    tags: [{ type: String, trim: true }],
    coverImage: { type: String, default: '' },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

projectSchema.index({ name: 'text', description: 'text' });

projectSchema.methods.isMember = function (userId) {
  const uid = userId.toString();
  return (
    this.owner.toString() === uid ||
    this.members.some((m) => {
      // m.user may be a populated document or a raw ObjectId
      const memberId = (m.user?._id ?? m.user).toString();
      return memberId === uid;
    })
  );
};

module.exports = mongoose.model('Project', projectSchema);
