const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Project = require('../../src/models/Project');
const SecurityAudit = require('../../src/models/SecurityAudit');

describe('Security Audit Trail & Compliance Verification (AUD-001 to AUD-012)', () => {
  let pm, secEng, contributor, viewer, outsider;
  let pmToken, secToken, contribToken, viewerToken, outsiderToken;
  let projectA, projectB;
  let auditA;

  beforeAll(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    await SecurityAudit.deleteMany({});

    pm = await User.create({ name: 'Alice PM', email: 'alice.pm@secure.com', password: 'Password123!', role: 'user', isVerified: true });
    secEng = await User.create({ name: 'Frank Security', email: 'frank.sec@secure.com', password: 'Password123!', role: 'user', isVerified: true });
    contributor = await User.create({ name: 'Bob Dev', email: 'bob.dev@secure.com', password: 'Password123!', role: 'user', isVerified: true });
    viewer = await User.create({ name: 'Dave Viewer', email: 'dave.view@secure.com', password: 'Password123!', role: 'user', isVerified: true });
    outsider = await User.create({ name: 'Eve Outsider', email: 'eve.hacker@dark.com', password: 'Password123!', role: 'user', isVerified: true });

    const pmLog = await request(app).post('/api/v1/auth/login').send({ email: pm.email, password: 'Password123!' });
    pmToken = pmLog.body.data.accessToken;

    const secLog = await request(app).post('/api/v1/auth/login').send({ email: secEng.email, password: 'Password123!' });
    secToken = secLog.body.data.accessToken;

    const cLog = await request(app).post('/api/v1/auth/login').send({ email: contributor.email, password: 'Password123!' });
    contribToken = cLog.body.data.accessToken;

    const vLog = await request(app).post('/api/v1/auth/login').send({ email: viewer.email, password: 'Password123!' });
    viewerToken = vLog.body.data.accessToken;

    const oLog = await request(app).post('/api/v1/auth/login').send({ email: outsider.email, password: 'Password123!' });
    outsiderToken = oLog.body.data.accessToken;

    projectA = await Project.create({
      name: 'Project Alpha (Audited)',
      owner: pm._id,
      members: [
        { user: pm._id, role: 'project_manager' },
        { user: secEng._id, role: 'security_engineer' },
        { user: contributor._id, role: 'contributor' },
        { user: viewer._id, role: 'viewer' },
      ],
      visibility: 'private',
    });

    projectB = await Project.create({
      name: 'Project Beta (Tenant Isolated)',
      owner: outsider._id,
      members: [{ user: outsider._id, role: 'project_manager' }],
      visibility: 'private',
    });

    auditA = await SecurityAudit.create({
      project: projectA._id,
      user: contributor._id,
      userRole: 'contributor',
      attemptedAction: 'unauthorized_domain_mutation',
      targetResource: 'code_review',
      targetDomain: 'security',
      details: 'Attempted to edit security domain code without proper privilege',
      severity: 'high',
    });
  });

  it('AUD-001: Verifies audit record metadata format and attributes', async () => {
    const audit = await SecurityAudit.findById(auditA._id);
    expect(audit).toBeDefined();
    expect(audit.userRole).toBe('contributor');
    expect(audit.targetResource).toBe('code_review');
    expect(audit.severity).toBe('high');
    expect(audit.resolved).toBe(false);
  });

  it('AUD-002: Tenant Isolation — Project B manager cannot see Project A audits', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectB._id}/security-audits`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(200);
    // Project B must have 0 audits; cannot leak Project A audits
    expect(res.body.data.audits.length).toBe(0);

    const crossRes = await request(app)
      .get(`/api/v1/projects/${projectA._id}/security-audits`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(crossRes.status).toBe(403);
  });

  it('AUD-003: Contributor and Viewer roles are blocked from accessing audit records (403)', async () => {
    const contribRes = await request(app)
      .get(`/api/v1/projects/${projectA._id}/security-audits`)
      .set('Authorization', `Bearer ${contribToken}`);
    expect(contribRes.status).toBe(403);

    const viewerRes = await request(app)
      .get(`/api/v1/projects/${projectA._id}/security-audits`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewerRes.status).toBe(403);
  });

  it('AUD-004: Security Engineer can view audit list but cannot resolve audits (403)', async () => {
    const viewRes = await request(app)
      .get(`/api/v1/projects/${projectA._id}/security-audits`)
      .set('Authorization', `Bearer ${secToken}`);

    expect(viewRes.status).toBe(200);
    expect(viewRes.body.data.audits.length).toBe(1);

    const resolveRes = await request(app)
      .patch(`/api/v1/projects/${projectA._id}/security-audits/${auditA._id}/resolve`)
      .set('Authorization', `Bearer ${secToken}`);

    expect(resolveRes.status).toBe(403);
    expect(resolveRes.body.message).toMatch(/Only Project Managers can acknowledge/i);
  });

  it('AUD-005: Project Manager resolves audit record with resolvedBy and resolvedAt timestamps', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectA._id}/security-audits/${auditA._id}/resolve`)
      .set('Authorization', `Bearer ${pmToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.audit.resolved).toBe(true);
    expect(res.body.data.audit.resolvedBy).toBeDefined();
    expect(res.body.data.audit.resolvedAt).toBeDefined();
  });

  it('AUD-006: PM cannot resolve audit record belonging to another project (403/404)', async () => {
    // Cross-project attempt by PM of A against Project B is denied with 403
    const crossRes = await request(app)
      .patch(`/api/v1/projects/${projectB._id}/security-audits/${auditA._id}/resolve`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(crossRes.status).toBe(403);

    // Non-existent audit ID on Project A returns 404
    const fakeId = new mongoose.Types.ObjectId();
    const notFoundRes = await request(app)
      .patch(`/api/v1/projects/${projectA._id}/security-audits/${fakeId}/resolve`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(notFoundRes.status).toBe(404);
  });
});
