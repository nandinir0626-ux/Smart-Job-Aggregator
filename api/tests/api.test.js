const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { connectDB, mongoose } = require('../src/config/db');
const User = require('../src/models/User');

describe('REST API Test Suite', () => {
  let authToken = '';
  let testUserEmail = '';

  beforeAll(async () => {
    await connectDB();
    testUserEmail = `jest_user_${Date.now()}@example.com`;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /^jest_user_/ } });
    await mongoose.disconnect();
  });

  describe('1. Health Check', () => {
    it('GET /api/health returns 200 and healthy status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.services.mongodb).toBe('connected');
    });
  });

  describe('2. Authentication Flow', () => {
    it('POST /api/auth/register registers a new user with hashed password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jest Engineer',
          email: testUserEmail,
          password: 'SecurePassword123!',
          preferences: { roles: ['Frontend Developer'], remote: true },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testUserEmail);
      expect(res.body.user.passwordHash).toBeUndefined(); // Should not leak password hash
      authToken = res.body.token;
    });

    it('POST /api/auth/register rejects duplicate email with 409', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate Engineer',
          email: testUserEmail,
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/login logs in user and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it('GET /api/auth/me returns authenticated user details', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testUserEmail);
    });
  });

  describe('3. Jobs Search & Filtering', () => {
    it('GET /api/jobs returns paginated job listings', async () => {
      const res = await request(app).get('/api/jobs?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.jobs.length).toBeLessThanOrEqual(5);
      expect(res.body.pagination.total).toBeGreaterThan(0);
    });

    it('GET /api/jobs?remote=true filters only remote positions', async () => {
      const res = await request(app).get('/api/jobs?remote=true&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.jobs.every((j) => j.remote === true)).toBe(true);
    });
  });

  describe('4. Resume Upload Validation', () => {
    it('POST /api/resumes rejects non-PDF/DOCX file formats', async () => {
      const fakeTxtPath = path.join(__dirname, 'test.txt');
      fs.writeFileSync(fakeTxtPath, 'Fake resume content');

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('resume', fakeTxtPath);

      if (fs.existsSync(fakeTxtPath)) fs.unlinkSync(fakeTxtPath);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid file type|PDF and DOCX/);
    });

    it('POST /api/resumes accepts valid PDF document', async () => {
      const pdfPath = path.resolve(__dirname, '../../data/sample_resume.pdf');

      const res = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('resume', pdfPath);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.resume.status).toBe('processing');
    });
  });
});
