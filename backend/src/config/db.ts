import { env } from '../utils/env.js';
import mongoose from 'mongoose';

export const dbConfig = {
  url: env('DB_URL') || env('MONGO_URL'),
  dbName: env('DB_NAME') || 'PollDB',
};

export async function connectToDatabase() {
  try {
    // Runtime validation
    if (typeof dbConfig.url !== 'string') {
      throw new Error(`Invalid DB_URL: expected string, got ${typeof dbConfig.url}`);
    }

    await mongoose.connect(dbConfig.url, {
      dbName: dbConfig.dbName,
    });
    console.log('✅ Connected to MongoDB:', dbConfig.dbName);
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}
