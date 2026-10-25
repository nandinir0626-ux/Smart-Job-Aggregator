const app = require('./src/app');
const { connectDB, mongoose } = require('./src/config/db');
const request = require('supertest');

async function runTests() {
  console.log('--- RUNNING PHASE 1 VERIFICATION ---');
  try {
    await connectDB();
    console.log('DB connected successfully');

    const testEmail = `testuser_${Date.now()}@example.com`;
    const testPassword = 'Password123!';

    // 1. Health check
    console.log('Testing GET /api/health ...');
    const healthRes = await request(app).get('/api/health');
    console.log('Health status:', healthRes.status, healthRes.body);
    if (healthRes.status !== 200) {
      throw new Error(`Health check failed: ${JSON.stringify(healthRes.body)}`);
    }

    // 2. Register
    console.log('Testing POST /api/auth/register ...');
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test Engineer',
        email: testEmail,
        password: testPassword,
        preferences: {
          roles: ['Full Stack Engineer', 'Backend Engineer'],
          remote: true,
        },
      });
    console.log('Register status:', regRes.status, regRes.body.message);
    if (regRes.status !== 201 || !regRes.body.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
    }
    const token = regRes.body.token;

    // 3. Login
    console.log('Testing POST /api/auth/login ...');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });
    console.log('Login status:', loginRes.status, loginRes.body.message);
    if (loginRes.status !== 200 || !loginRes.body.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }

    // 4. Me
    console.log('Testing GET /api/auth/me ...');
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    console.log('Me status:', meRes.status, meRes.body.user.name, meRes.body.user.email);
    if (meRes.status !== 200 || meRes.body.user.email !== testEmail) {
      throw new Error(`Get me failed: ${JSON.stringify(meRes.body)}`);
    }

    console.log('>>> ALL PHASE 1 ACCEPTANCE CHECKS PASSED SUCCESSFULLY! <<<');
  } catch (err) {
    console.error('Phase 1 test error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
