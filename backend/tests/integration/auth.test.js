const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => { await User.deleteMany({}); });

  it('registers a new user successfully', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User', email: 'test@example.com', password: 'Password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    await User.create({ name: 'Existing', email: 'dupe@example.com', password: 'Password123', isVerified: true });
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'New', email: 'dupe@example.com', password: 'Password123',
    });
    expect(res.status).toBe(400);
  });

  it('validates required fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects short passwords', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Test', email: 'short@example.com', password: '123',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  let userId;

  beforeEach(async () => {
    await User.deleteMany({});
    const user = await User.create({
      name: 'Login Test', email: 'login@example.com', password: 'Password123', isVerified: true,
    });
    userId = user._id;
  });

  it('logs in a verified user', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com', password: 'Password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com', password: 'WrongPassword',
    });
    expect(res.status).toBe(401);
  });

  it('rejects unverified user', async () => {
    await User.create({ name: 'Unverified', email: 'unverified@example.com', password: 'Password123', isVerified: false });
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'unverified@example.com', password: 'Password123',
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns user data with valid token', async () => {
    const user = await User.create({ name: 'Me Test', email: 'me@example.com', password: 'Password123', isVerified: true });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'me@example.com', password: 'Password123' });
    const token = loginRes.body.data.accessToken;

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me@example.com');
  });

  it('rejects without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/forgot-password & reset-password', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('generates a reset OTP for registered user', async () => {
    await User.create({
      name: 'Reset User',
      email: 'reset@example.com',
      password: 'OldPassword123',
      isVerified: true,
    });

    const res = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'reset@example.com',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const user = await User.findOne({ email: 'reset@example.com' }).select('+resetPasswordOtp +resetPasswordExpires');
    expect(user.resetPasswordOtp).toBeDefined();
    expect(user.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns safe response for non-existent email', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'ghost@example.com',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects reset-password with invalid OTP', async () => {
    await User.create({
      name: 'Reset User',
      email: 'reset2@example.com',
      password: 'OldPassword123',
      isVerified: true,
      resetPasswordOtp: '123456',
      resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app).post('/api/v1/auth/reset-password').send({
      email: 'reset2@example.com',
      otp: '999999',
      password: 'NewPassword123',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or incorrect/i);
  });

  it('resets password successfully and allows login with new password', async () => {
    const user = await User.create({
      name: 'Reset User',
      email: 'reset3@example.com',
      password: 'OldPassword123',
      isVerified: true,
      resetPasswordOtp: '654321',
      resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app).post('/api/v1/auth/reset-password').send({
      email: 'reset3@example.com',
      otp: '654321',
      password: 'NewSuperPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Old password should fail
    const oldLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'reset3@example.com',
      password: 'OldPassword123',
    });
    expect(oldLogin.status).toBe(401);

    // New password should succeed
    const newLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'reset3@example.com',
      password: 'NewSuperPassword123',
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.accessToken).toBeDefined();
  });
});

describe('Health check', () => {
  it('returns 200 on /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
