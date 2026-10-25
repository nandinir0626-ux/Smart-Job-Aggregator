const amqplib = require('amqplib');
const crypto = require('crypto');
const config = require('../config');
const socketService = require('./socket');

let connection = null;
let channel = null;

const connectRabbitMQ = async (retryCount = 5, delayMs = 3000) => {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`[RabbitMQ] Connecting to ${config.rabbitmqUrl} (attempt ${attempt}/${retryCount})...`);
      connection = await amqplib.connect(config.rabbitmqUrl);
      connection.on('error', (err) => {
        console.error('[RabbitMQ] Connection error:', err.message);
      });
      connection.on('close', () => {
        console.warn('[RabbitMQ] Connection closed. Reconnecting in 3s...');
        channel = null;
        connection = null;
        setTimeout(() => connectRabbitMQ(), 3000);
      });

      channel = await connection.createChannel();
      channel.on('error', (err) => {
        console.error('[RabbitMQ] Channel error:', err.message);
      });
      channel.on('close', () => {
        console.warn('[RabbitMQ] Channel closed');
        channel = null;
      });

      // Ensure 'events' exchange exists (topic exchange)
      await channel.assertExchange('events', 'topic', { durable: true });

      // Create a dedicated queue for the API server to consume notifications and events
      const queueName = 'api_events_queue';
      await channel.assertQueue(queueName, { durable: true });
      await channel.bindQueue(queueName, 'events', 'notification.created');
      await channel.bindQueue(queueName, 'events', 'resume.processed');
      await channel.bindQueue(queueName, 'events', 'job.crawled');

      // Consume events from RabbitMQ and forward to Socket.IO
      channel.consume(queueName, (msg) => {
        if (!msg) return;
        try {
          const content = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey;
          console.log(`[RabbitMQ Consumer] Received event '${routingKey}':`, content);

          if (routingKey === 'notification.created') {
            const userId = content.userId;
            if (userId) {
              socketService.emitToUser(userId, 'notification', content);
            }
          } else if (routingKey === 'resume.processed') {
            const userId = content.userId;
            if (userId) {
              socketService.emitToUser(userId, 'resume_status', content);
            }
          }

          channel.ack(msg);
        } catch (err) {
          console.error('[RabbitMQ Consumer] Error processing event:', err);
          channel.nack(msg, false, false);
        }
      });

      // Ensure default 'celery' exchange and queue exist for background workers
      await channel.assertExchange('celery', 'direct', { durable: true });
      await channel.assertQueue('celery', { durable: true });
      await channel.bindQueue('celery', 'celery', 'celery');

      console.log('[RabbitMQ] Connected and listeners attached successfully');
      return channel;
    } catch (err) {
      console.error(`[RabbitMQ] Connection attempt ${attempt} failed: ${err.message}`);
      if (attempt === retryCount) {
        console.warn('[RabbitMQ] Could not connect to RabbitMQ after retries; continuing in fallback mode');
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

/**
 * Publishes a task message in Celery v2 protocol format to the RabbitMQ celery queue.
 */
const sendCeleryTask = async (taskName, args = [], kwargs = {}) => {
  if (!channel) {
    console.warn(`[RabbitMQ] Channel not ready. Attempting reconnect before sending task '${taskName}'`);
    await connectRabbitMQ(2, 1000);
    if (!channel) {
      throw new Error(`RabbitMQ channel not available to send task ${taskName}`);
    }
  }

  const taskId = crypto.randomUUID();
  // Celery v2 message body is a 3-element tuple: [args, kwargs, embed]
  const bodyPayload = [
    args,
    kwargs,
    { callbacks: null, errbacks: null, chain: null, chord: null },
  ];
  const bodyJson = JSON.stringify(bodyPayload);

  const properties = {
    correlationId: taskId,
    contentType: 'application/json',
    contentEncoding: 'utf-8',
    deliveryMode: 2, // persistent
    headers: {
      lang: 'py',
      task: taskName,
      id: taskId,
      shadow: null,
      eta: null,
      expires: null,
      group: null,
      group_index: null,
      retries: 0,
      timelimit: [null, null],
      root_id: taskId,
      parent_id: null,
      argsrepr: JSON.stringify(args),
      kwargsrepr: JSON.stringify(kwargs),
      origin: 'node@api',
    },
  };

  channel.publish('celery', 'celery', Buffer.from(bodyJson, 'utf-8'), properties);
  console.log(`[RabbitMQ] Enqueued Celery task '${taskName}' (id: ${taskId})`);
  return taskId;
};

/**
 * Publishes an event to the 'events' topic exchange
 */
const publishEvent = async (routingKey, message) => {
  if (!channel) {
    console.warn(`[RabbitMQ] Channel not ready to publish event ${routingKey}`);
    return false;
  }
  const payload = Buffer.from(JSON.stringify(message), 'utf-8');
  channel.publish('events', routingKey, payload, { persistent: true });
  return true;
};

module.exports = {
  connectRabbitMQ,
  sendCeleryTask,
  publishEvent,
  getChannel: () => channel,
};
