const mongoose = require('mongoose');
const rabbitmq = require('../services/rabbitmq');

const getHealth = async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const rabbitmqStatus = rabbitmq.getChannel() ? 'connected' : 'disconnected';

  const isHealthy = mongoStatus === 'connected';

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      mongodb: mongoStatus,
      rabbitmq: rabbitmqStatus,
    },
  });
};

module.exports = { getHealth };
