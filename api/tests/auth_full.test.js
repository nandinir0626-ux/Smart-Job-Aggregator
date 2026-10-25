const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const { connectDB, mongoose } = require('../src/config/db');
const User = require('../src/models/User');

describe('Production Authentication & Security Test Suite', () => {
  const timestamp = Date.now();
  const testEmail = `test.developer.${timestamp}@gmail.com`;
  const testPassword = 'StrongPassword123!';
  let verificationCode = '';
  let authToken = '';
  let resetRawToken = '';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /test\.developer\./ } });
    await mongoose.disconnect();
  });

  describe('1. Registration & Input Validation', () => {
    it('rejects weak password (< 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Candidate',
          email: testEmail,
          password: 'short',
          confirmPassword: 'short',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/at least 8 characters/i);
    });

    it('rejects password without numbers', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Candidate',
          email: testEmail,
          password: 'OnlyLettersPassword',
          confirmPassword: 'OnlyLettersPassword',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/at least one letter and one number/i);
    });

    it('rejects password and confirmPassword mismatch', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Candidate',
          email: testEmail,
          password: testPassword,
          confirmPassword: 'DifferentPassword123!',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/passwords do not match/i);
    });

    it('registers user and creates a single-use 6-digit verification code', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Candidate',
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.requiresVerification).toBe(true);
      expect(res.body.email).toBe(testEmail);

      const savedUser = await User.findOne({ email: testEmail });
      expect(savedUser).toBeDefined();
      expect(savedUser.isVerified).toBe(false);
      expect(savedUser.verificationCode).toHaveLength(6);
      expect(savedUser.verificationCodeExpires).toBeDefined();
      verificationCode = savedUser.verificationCode;
    });

    it('blocks login before email is verified', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });
      expect(res.status).toBe(403);
      expect(res.body.requiresVerification).toBe(true);
    });
  });

  describe('2. Email Verification & OTP Gating', () => {
    it('rejects incorrect 6-digit verification code', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: testEmail,
          code: '000000',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid 6-digit/i);
    });

    it('accepts correct code, activates account, and clears single-use OTP', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: testEmail,
          code: verificationCode,
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      authToken = res.body.token;

      const updatedUser = await User.findOne({ email: testEmail });
      expect(updatedUser.isVerified).toBe(true);
      expect(updatedUser.verificationCode).toBeNull();
      expect(updatedUser.verificationCodeExpires).toBeNull();
    });

    it('rejects duplicate registration for verified account', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: testEmail,
          password: testPassword,
        });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  describe('3. Email/Password Login & Session Management', () => {
    it('rejects login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword999!',
        });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('logs in successfully with valid credentials and returns JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
    });

    it('allows access to protected GET /api/auth/me with Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testEmail);
    });

    it('rejects protected routes without valid token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('4. Forgot Password & Secure Reset Flow', () => {
    it('generates SHA-256 hashed reset token and returns generic response', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: testEmail,
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await User.findOne({ email: testEmail });
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpires).toBeDefined();
      expect(user.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());

      // Set a test raw token and store its SHA-256 hash
      resetRawToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto.createHash('sha256').update(resetRawToken).digest('hex');
      await user.save();
    });

    it('returns generic response for non-existent email (anti-harvesting)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent.user.999@gmail.com',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects password reset with invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid_token_12345',
          email: testEmail,
          password: 'NewStrongPassword456!',
          confirmPassword: 'NewStrongPassword456!',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or has expired/i);
    });

    it('resets password with valid token and sets new password', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetRawToken,
          email: testEmail,
          password: 'NewStrongPassword456!',
          confirmPassword: 'NewStrongPassword456!',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify token was invalidated (single-use)
      const user = await User.findOne({ email: testEmail });
      expect(user.resetPasswordToken).toBeNull();
      expect(user.resetPasswordExpires).toBeNull();

      // Verify user can log in with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'NewStrongPassword456!',
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('rejects second attempt with same reset token (single-use verification)', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetRawToken,
          email: testEmail,
          password: 'AnotherPassword789!',
          confirmPassword: 'AnotherPassword789!',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or has expired/i);
    });
  });
});
