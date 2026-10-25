const http = require('http');
const app = require('./app');
const config = require('./config');
const { connectDB } = require('./config/db');
const { initSocket } = require('./services/socket');
const { connectRabbitMQ } = require('./services/rabbitmq');

const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Connect to RabbitMQ (non-fatal if broker is starting up)
    connectRabbitMQ().catch((err) => {
      console.warn('[RabbitMQ] Initial connection deferred:', err.message);
    });

    server.listen(config.port, () => {
      console.log(`[SmartJobs API] Server listening on http://localhost:${config.port}`);
      console.log(`[SmartJobs API] Health check at http://localhost:${config.port}/api/health`);
    });
  } catch (err) {
    console.error('[SmartJobs API] Failed to start server:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SmartJobs API] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SmartJobs API] SIGINT received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

module.exports = { server, startServer };
