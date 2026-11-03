const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const CollabSession = require('../models/CollabSession');
const logger = require('../utils/logger');

let io;

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const allowed = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''));
  const cleanOrigin = origin.replace(/\/+$/, '');
  return (
    allowed.includes(cleanOrigin) ||
    allowed.includes('*') ||
    cleanOrigin.endsWith('.vercel.app') ||
    cleanOrigin === 'http://localhost:3000'
  );
};

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          logger.warn(`Socket CORS blocked origin: ${origin}`);
          callback(new Error(`Socket CORS origin not allowed: ${origin}`));
        }
      },
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

    // ==========================================
    // Real-Time Collaborative Coding Workspace
    // ==========================================
    socket.on('collab:join', ({ sessionId }, callback) => {
      if (!sessionId) return;
      const room = `collab:${sessionId}`;
      socket.join(room);
      socket.collabRoom = sessionId;

      logger.info(`[COLLAB] ${socket.user.name} joined ${room}`);

      socket.emit('collab:joined', { sessionId });
      if (typeof callback === 'function') callback({ success: true, room });

      // Notify others in the room
      socket.to(room).emit('collab:userJoined', {
        user: {
          _id: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
          email: socket.user.email,
        },
      });
    });

    socket.on('collab:leave', ({ sessionId }) => {
      if (!sessionId) return;
      const room = `collab:${sessionId}`;
      socket.leave(room);
      delete socket.collabRoom;
      socket.to(room).emit('collab:userLeft', { userId: socket.user._id });
    });

    socket.on('collab:codeChange', ({ sessionId, code, language, activeLine, delta }) => {
      if (!sessionId) return;
      const room = `collab:${sessionId}`;
      socket.to(room).emit('collab:codeSync', {
        code,
        language,
        activeLine,
        delta,
        author: {
          _id: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
      });
    });

    socket.on('collab:cursor', ({ sessionId, line, col }) => {
      if (!sessionId) return;
      const room = `collab:${sessionId}`;
      socket.to(room).emit('collab:cursorMoved', {
        user: {
          _id: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
        line,
        col,
      });
    });

    socket.on('collab:typing', ({ sessionId, isTyping, line }) => {
      if (!sessionId) return;
      const room = `collab:${sessionId}`;
      socket.to(room).emit('collab:userTyping', {
        user: {
          _id: socket.user._id,
          name: socket.user.name,
        },
        isTyping,
        line,
      });
    });

    // Real-Time Pair Coding Chat Message
    socket.on('collab:chat', async ({ sessionId, message }) => {
      if (!sessionId || !message || !message.trim()) return;
      const room = `collab:${sessionId}`;
      const chatItem = {
        _id: new Date().getTime().toString() + Math.random().toString(36).substring(2, 7),
        user: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar || '',
        role: socket.user.role || 'member',
        content: message.trim(),
        timestamp: new Date(),
      };

      try {
        await CollabSession.findByIdAndUpdate(sessionId, {
          $push: { messages: chatItem },
        });
      } catch (err) {
        logger.error(`Error saving collab chat: ${err.message}`);
      }

      io.to(room).emit('collab:chatMessage', chatItem);
    });

    socket.on('disconnect', () => {
      if (socket.collabRoom) {
        socket.to(`collab:${socket.collabRoom}`).emit('collab:userLeft', { userId: socket.user._id });
      }
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
