const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/job_aggregator',
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/',
  jwtSecret: process.env.JWT_SECRET || 'smartjobs-dev-secret-key-32chars-min',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'support@smartjobs.local',
  resendApiKey: process.env.RESEND_API_KEY || '',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads')),
  env: process.env.NODE_ENV || 'development',
};
