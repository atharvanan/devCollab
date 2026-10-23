require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/database');
const { initSocket } = require('./socket');
const logger = require('./utils/logger');
const { validateEnv } = require('./config/validateEnv');
const { verifySMTPConnection } = require('./services/email.service');

validateEnv();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initSocket(server);

const start = async () => {
  try {
    await connectDB();
    server.listen(PORT, async () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      // Verify SMTP on startup so misconfiguration is immediately visible in logs
      await verifySMTPConnection();
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

start();
