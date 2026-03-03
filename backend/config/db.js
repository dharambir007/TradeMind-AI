const mongoose = require('mongoose');

const MAX_RETRIES = Number(process.env.MONGO_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.MONGO_RETRY_DELAY_MS || 3000);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Please add it to your backend .env');
  }

  let attempt = 1;
  while (attempt <= MAX_RETRIES) {
    try {
      const conn = await mongoose.connect(uri);
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`MongoDB connection error (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      await delay(RETRY_DELAY_MS);
      attempt += 1;
    }
  }
};

module.exports = connectDB;
