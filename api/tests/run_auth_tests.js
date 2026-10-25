const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const { connectDB, mongoose } = require('../src/config/db');
const User = require('../src/models/User');

const API_BASE = 'http://localhost:5000/api';

async function post(endpoint, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function get(endpoint, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   PRODUCTION AUTHENTICATION VERIFICATION SUITE');
  console.log('======================================================\n');

  await connectDB();

  const timestamp = Date.now();
  const testEmail = `test.developer.${timestamp}@gmail.com`;
  const strongPassword = 'StrongPassword123!';
  let verificationCode = '';
  let authToken = '';
  let resetRawToken = '';

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Weak Password Validation
  await test('Reject password < 8 characters', async () => {
    const res = await post('/auth/register', {
      name: 'Test Candidate',
      email: testEmail,
      password: 'short',
      confirmPassword: 'short',
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /at least 8 characters/i);
  });

  // 2. Missing Number Validation
  await test('Reject password without numbers', async () => {
    const res = await post('/auth/register', {
      name: 'Test Candidate',
      email: testEmail,
      password: 'NoNumbersPassword',
      confirmPassword: 'NoNumbersPassword',
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /at least one letter and one number/i);
  });

  // 3. Password Mismatch
  await test('Reject password & confirmPassword mismatch', async () => {
    const res = await post('/auth/register', {
      name: 'Test Candidate',
      email: testEmail,
      password: strongPassword,
      confirmPassword: 'MismatchPassword999!',
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /passwords do not match/i);
  });

  // 4. Successful Registration & OTP Generation
  await test('Register account & generate 6-digit verification code', async () => {
    const res = await post('/auth/register', {
      name: 'Test Candidate',
      email: testEmail,
      password: strongPassword,
      confirmPassword: strongPassword,
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.requiresVerification, true);
    assert.strictEqual(res.body.email, testEmail);

    const user = await User.findOne({ email: testEmail });
    assert.ok(user, 'User must exist in MongoDB');
    assert.strictEqual(user.isVerified, false);
    assert.strictEqual(user.verificationCode.length, 6);
    assert.ok(user.verificationCodeExpires > new Date());
    verificationCode = user.verificationCode;
  });

  // 5. Unverified Login Gating
  await test('Block unverified user from logging in (HTTP 403)', async () => {
    const res = await post('/auth/login', {
      email: testEmail,
      password: strongPassword,
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.requiresVerification, true);
  });

  // 6. Invalid Code Rejection
  await test('Reject incorrect 6-digit verification code', async () => {
    const res = await post('/auth/verify-email', {
      email: testEmail,
      code: '000000',
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /invalid 6-digit/i);
  });

  // 7. Successful Verification & Single-Use Clear
  await test('Verify email with correct code & activate account', async () => {
    const res = await post('/auth/verify-email', {
      email: testEmail,
      code: verificationCode,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'Must return JWT token');
    authToken = res.body.token;

    const user = await User.findOne({ email: testEmail });
    assert.strictEqual(user.isVerified, true);
    assert.strictEqual(user.verificationCode, null);
    assert.strictEqual(user.verificationCodeExpires, null);
  });

  // 8. Duplicate Account Rejection
  await test('Reject duplicate registration for verified account (HTTP 409)', async () => {
    const res = await post('/auth/register', {
      name: 'Another Name',
      email: testEmail,
      password: strongPassword,
      confirmPassword: strongPassword,
    });
    assert.strictEqual(res.status, 409);
    assert.match(res.body.error, /already exists/i);
  });

  // 9. Incorrect Password Rejection
  await test('Reject login with incorrect password (HTTP 401)', async () => {
    const res = await post('/auth/login', {
      email: testEmail,
      password: 'WrongPassword999!',
    });
    assert.strictEqual(res.status, 401);
    assert.match(res.body.error, /invalid email or password/i);
  });

  // 10. Successful Login
  await test('Log in successfully with valid password and return JWT session', async () => {
    const res = await post('/auth/login', {
      email: testEmail,
      password: strongPassword,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'JWT token must be present');
    assert.strictEqual(res.body.user.email, testEmail);
  });

  // 11. Protected Route Access
  await test('Access protected GET /api/auth/me with Bearer token', async () => {
    const res = await get('/auth/me', authToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, testEmail);
  });

  // 12. Protected Route Rejection Without Token
  await test('Reject protected route without authorization header (HTTP 401)', async () => {
    const res = await get('/auth/me');
    assert.strictEqual(res.status, 401);
  });

  // 13. Forgot Password Request
  await test('Generate SHA-256 hashed reset token for forgot password request', async () => {
    const res = await post('/auth/forgot-password', {
      email: testEmail,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const user = await User.findOne({ email: testEmail });
    assert.ok(user.resetPasswordToken, 'Hashed reset token must be stored');
    assert.ok(user.resetPasswordExpires > new Date(), 'Must have valid expiration');

    // Create a known test raw token and store its hash in DB
    resetRawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetRawToken).digest('hex');
    await user.save();
  });

  // 14. Anti-Harvesting Generic Response
  await test('Return generic 200 for non-existent email (anti-harvesting)', async () => {
    const res = await post('/auth/forgot-password', {
      email: 'nonexistent.engineer.999@gmail.com',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  // 15. Invalid Token Rejection
  await test('Reject reset-password with invalid token', async () => {
    const res = await post('/auth/reset-password', {
      token: 'bad_token_hex',
      email: testEmail,
      password: 'NewStrongPassword456!',
      confirmPassword: 'NewStrongPassword456!',
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /invalid or has expired/i);
  });

  // 16. Successful Password Reset
  await test('Reset password with valid token, update hash, and invalidate token', async () => {
    const res = await post('/auth/reset-password', {
      token: resetRawToken,
      email: testEmail,
      password: 'NewStrongPassword456!',
      confirmPassword: 'NewStrongPassword456!',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const user = await User.findOne({ email: testEmail });
    assert.strictEqual(user.resetPasswordToken, null);
    assert.strictEqual(user.resetPasswordExpires, null);

    // Verify login with new password
    const loginRes = await post('/auth/login', {
      email: testEmail,
      password: 'NewStrongPassword456!',
    });
    assert.strictEqual(loginRes.status, 200);
  });

  // 17. Single-Use Token Enforcement
  await test('Reject second use of same reset token (single-use token security)', async () => {
    const res = await post('/auth/reset-password', {
      token: resetRawToken,
      email: testEmail,
      password: 'AnotherPassword789!',
      confirmPassword: 'AnotherPassword789!',
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /invalid or has expired/i);
  });

  // 18. Logout Endpoint
  await test('Call POST /api/auth/logout to invalidate session', async () => {
    const res = await post('/auth/logout', {});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  console.log('\n======================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('======================================================\n');

  // Clean up test user
  await User.deleteOne({ email: testEmail });
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
