const { server } = require('./src/server');
const { connectDB, mongoose } = require('./src/config/db');
const { connectRabbitMQ } = require('./src/services/rabbitmq');
const User = require('./src/models/User');
const Job = require('./src/models/Job');
const Notification = require('./src/models/Notification');
const jwt = require('jsonwebtoken');
const config = require('./src/config');
const { io: ClientIO } = require('socket.io-client');
const request = require('supertest');
const { spawn } = require('child_process');
const path = require('path');

async function verifyPhase5() {
  console.log('--- RUNNING PHASE 5 ACCEPTANCE CHECK ---');
  await connectDB();
  await connectRabbitMQ();

  const user = await User.findOne({ email: 'resume.test@example.com' });
  if (!user) throw new Error('Test user not found');

  const token = jwt.sign({ userId: user._id }, config.jwtSecret, { expiresIn: '1h' });

  // Clear previous notifications for clean test
  await Notification.deleteMany({ userId: user._id });

  // Find a matching job
  const job = await Job.findOne({ skills: { $in: ['React', 'Python', 'Node.js'] } });
  if (!job) throw new Error('No job found with matching skills');
  console.log(`Testing match for job: "${job.title}" at "${job.company}" (ID: ${job._id})`);

  // Start HTTP server on test port 5002
  const TEST_PORT = 5002;
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test API & Socket.IO server listening on port ${TEST_PORT}`);

  // Connect Socket.IO client
  console.log('Connecting Socket.IO client...');
  const socketClient = ClientIO(`http://localhost:${TEST_PORT}`, {
    auth: { token },
    transports: ['websocket'],
  });

  const notificationReceivedPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for Socket.IO notification event (15s)'));
    }, 15000);

    socketClient.on('connect', () => {
      console.log(`Socket client connected successfully (id: ${socketClient.id})`);
    });

    socketClient.on('notification', (payload) => {
      console.log('\n[Socket.IO Client] >>> REAL-TIME NOTIFICATION RECEIVED! <<<');
      console.log('Payload:', payload);
      clearTimeout(timeout);
      resolve(payload);
    });
  });

  // Wait for socket connection
  await new Promise((r) => setTimeout(r, 1200));

  // Trigger Python matching worker task via python
  console.log('Triggering Python matching task match_job_to_users...');
  const rootDir = path.resolve(__dirname, '..');
  const pythonCmd = `
import sys
sys.path.insert(0, 'worker')
from tasks.notification_tasks import match_job_to_users
res = match_job_to_users('${job._id}')
print('Worker match result:', res)
`;

  await new Promise((resolve, reject) => {
    const py = spawn('python', ['-c', pythonCmd], { cwd: rootDir });
    py.stdout.on('data', (d) => process.stdout.write(`[Python] ${d}`));
    py.stderr.on('data', (d) => process.stderr.write(`[Python err] ${d}`));
    py.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Python process exited with code ${code}`));
    });
  });

  // Await Socket.IO live notification delivery
  const receivedNotif = await notificationReceivedPromise;
  console.log('Verified Socket.IO event received for job:', receivedNotif.jobTitle);

  // Verify MongoDB notification document
  const notifDoc = await Notification.findOne({ userId: user._id, jobId: job._id });
  if (!notifDoc) throw new Error('Notification document not saved in MongoDB');
  console.log(`Verified MongoDB notification document: ID=${notifDoc._id}, Score=${notifDoc.score}`);

  // Verify REST endpoints: GET /api/notifications, PATCH /api/notifications/:id/read
  console.log('Testing GET /api/notifications ...');
  const getRes = await request(server)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${token}`);

  console.log(`GET /api/notifications: status ${getRes.status}, unreadCount: ${getRes.body.unreadCount}`);
  if (getRes.status !== 200 || getRes.body.unreadCount < 1) {
    throw new Error('Notifications list failed or unreadCount < 1');
  }

  console.log(`Testing PATCH /api/notifications/${notifDoc._id}/read ...`);
  const patchRes = await request(server)
    .patch(`/api/notifications/${notifDoc._id}/read`)
    .set('Authorization', `Bearer ${token}`);

  console.log(`PATCH /api/notifications read: status ${patchRes.status}, read=${patchRes.body.notification.read}`);
  if (patchRes.status !== 200 || patchRes.body.notification.read !== true) {
    throw new Error('Mark as read failed');
  }

  console.log('Testing PATCH /api/notifications/read-all ...');
  const readAllRes = await request(server)
    .patch('/api/notifications/read-all')
    .set('Authorization', `Bearer ${token}`);
  console.log(`PATCH /api/notifications/read-all: status ${readAllRes.status}`);

  console.log('\n>>> ALL PHASE 5 ACCEPTANCE CHECKS PASSED SUCCESSFULLY! <<<');
  socketClient.disconnect();
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}

verifyPhase5().catch((err) => {
  console.error('Phase 5 verification failed:', err);
  process.exit(1);
});
