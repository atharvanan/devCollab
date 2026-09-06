const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const logger = require('../utils/logger');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.id).select('name avatar email');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.user.name} (${socket.id})`);

    // Join personal room for user-specific events (notifications)
    socket.join(`user:${socket.user._id}`);

    // Join a project room
    socket.on('project:join', (projectId) => {
      socket.join(`project:${projectId}`);
      logger.info(`${socket.user.name} joined project:${projectId}`);
    });

    socket.on('project:leave', (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    // Join a review room for real-time inline comments
    socket.on('review:join', (reviewId) => {
      socket.join(`review:${reviewId}`);
      socket.to(`review:${reviewId}`).emit('user:joined', {
        user: { _id: socket.user._id, name: socket.user.name, avatar: socket.user.avatar },
      });
    });

    socket.on('review:leave', (reviewId) => {
      socket.leave(`review:${reviewId}`);
      socket.to(`review:${reviewId}`).emit('user:left', { userId: socket.user._id });
    });

    // Typing indicator for review comments
    socket.on('comment:typing', ({ reviewId, lineNumber }) => {
      socket.to(`review:${reviewId}`).emit('comment:typing', {
        user: { _id: socket.user._id, name: socket.user.name },
        lineNumber,
      });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = { initSocket, getIO };
