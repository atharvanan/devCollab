const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  logger.info(`MongoDB connected: ${conn.connection.host}`);

  // Auto-heal text indexes to support any programming language (jsx, tsx, c++, etc.)
  try {
    const Review = require('../models/Review');
    const indexes = await Review.collection.indexes().catch(() => []);
    const textIdx = indexes.find((idx) => idx.key?._fts === 'text' || idx.name?.includes('text'));
    if (textIdx && textIdx.language_override !== 'none') {
      await Review.collection.dropIndex(textIdx.name).catch(() => {});
      logger.info('Reset legacy Review text index for universal programming language support');
    }
    await Review.syncIndexes().catch(() => {});
  } catch (e) {
    logger.warn('Index sync notice:', e.message);
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  logger.info('MongoDB disconnected');
};

module.exports = { connectDB, disconnectDB };
