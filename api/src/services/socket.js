const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Accept configured frontend origin or local dev
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        // Allow anonymous connection for public views if needed, or reject
        return next();
      }
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      console.warn(`[Socket.IO] Auth verification warning: ${err.message}`);
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}, User: ${socket.userId || 'guest'}`);

    if (socket.userId) {
      const room = `user:${socket.userId}`;
      socket.join(room);
      console.log(`[Socket.IO] Socket ${socket.id} joined room ${room}`);
    }

    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[Socket.IO] Explicitly joined user room user:${userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  return io;
};

const emitToUser = (userId, event, payload) => {
  if (!io) return;
  const room = `user:${userId}`;
  io.to(room).emit(event, payload);
  console.log(`[Socket.IO] Emitted event '${event}' to room ${room}`);
};

const emitBroadcast = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

module.exports = { initSocket, getIO, emitToUser, emitBroadcast };
