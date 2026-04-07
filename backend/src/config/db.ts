import { env } from '../utils/env.js';
import mongoose from 'mongoose';

export const dbConfig = {
  // ✅ FIXED: use correct env variable
  url: env('MONGO_URI'),
  dbName: env('DB_NAME') || 'PollDB',
};

export async function connectToDatabase() {
  try {
    // ✅ Strong validation
    if (!dbConfig.url || typeof dbConfig.url !== 'string') {
      throw new Error(`Invalid MONGO_URI: ${dbConfig.url}`);
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