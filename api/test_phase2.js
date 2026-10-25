const app = require('./src/app');
const { connectDB, mongoose } = require('./src/config/db');
const request = require('supertest');

async function testJobsApi() {
  console.log('--- TESTING JOBS SEARCH API (PHASE 2) ---');
  await connectDB();

  // 1. List jobs
  const res1 = await request(app).get('/api/jobs?page=1&limit=10');
  console.log(`Jobs list status: ${res1.status}, total found: ${res1.body.pagination.total}`);
  if (res1.status !== 200 || res1.body.jobs.length === 0) {
    throw new Error('Failed to retrieve jobs list');
  }

  const sampleJob = res1.body.jobs[0];
  console.log(`Sample job: "${sampleJob.title}" at "${sampleJob.company}"`);

  // 2. Query search
  const res2 = await request(app).get('/api/jobs?q=Engineer');
  console.log(`Query 'Engineer' status: ${res2.status}, returned: ${res2.body.jobs.length}`);
  if (res2.status !== 200) throw new Error('Search failed');

  // 3. Remote filter
  const res3 = await request(app).get('/api/jobs?remote=true');
  console.log(`Remote filter status: ${res3.status}, count: ${res3.body.jobs.length}`);
  if (res3.status !== 200 || !res3.body.jobs.every((j) => j.remote === true)) {
    throw new Error('Remote filter mismatch');
  }

  // 4. Skills filter
  const res4 = await request(app).get('/api/jobs?skills=React');
  console.log(`Skills 'React' status: ${res4.status}, count: ${res4.body.jobs.length}`);
  if (res4.status !== 200 || !res4.body.jobs.every((j) => j.skills.includes('React'))) {
    throw new Error('Skills filter mismatch');
  }

  // 5. Job by ID
  const res5 = await request(app).get(`/api/jobs/${sampleJob._id}`);
  console.log(`Job by ID status: ${res5.status}, title: ${res5.body.job.title}`);
  if (res5.status !== 200 || res5.body.job._id !== sampleJob._id) {
    throw new Error('Get job by ID failed');
  }

  console.log('>>> ALL JOBS API FILTERS VERIFIED SUCCESSFULLY! <<<');
  await mongoose.disconnect();
  process.exit(0);
}

testJobsApi().catch((err) => {
  console.error('Job API test error:', err);
  process.exit(1);
});
