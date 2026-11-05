const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_32_chars_minimum';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_minimum';
process.env.CLOUDINARY_CLOUD_NAME = 'test';
process.env.CLOUDINARY_API_KEY = 'test';
process.env.CLOUDINARY_API_SECRET = 'test';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'test';

jest.setTimeout(30000);

let mongoServer;

beforeAll(async () => {
  // If running in Docker or environment with an existing MongoDB instance (e.g., Alpine where MongoMemoryServer is unsupported)
  const existingUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  if (existingUri && !existingUri.includes('127.0.0.1')) {
    const testUri = existingUri.replace(/\/devcollab(\?.*)?$/, '/devcollab_test$1');
    await mongoose.connect(testUri);
    return;
  }

  try {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        launchTimeout: 60000,
      },
    });
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (err) {
    // Fallback to local or Docker mongo if binary download fails
    const fallbackUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/devcollab_test';
    await mongoose.connect(fallbackUri);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop({ doCleanup: true });
  }
});
