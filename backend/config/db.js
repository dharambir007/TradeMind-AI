const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MAX_RETRIES = Number(process.env.MONGO_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.MONGO_RETRY_DELAY_MS || 3000);
const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let connectPromise = null;

mongoose.set('bufferCommands', false);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Please add it to your backend .env');
  }

  connectPromise = (async () => {
    let attempt = 1;
    while (attempt <= MAX_RETRIES) {
      try {
        const conn = await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          heartbeatFrequencyMS: 10000,
          maxPoolSize: 10,
        });
        logger.info(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      } catch (error) {
        logger.error(`MongoDB connection error (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
        if (attempt === MAX_RETRIES) {
          throw error;
        }
        await delay(RETRY_DELAY_MS);
        attempt += 1;
      }
    }
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
};

function getDbState() {
  const readyState = mongoose.connection.readyState;
  return {
    ready: readyState === 1,
    readyState,
    status: READY_STATES[readyState] || 'unknown',
  };
}

module.exports = {
  connectDB,
  getDbState,
};
