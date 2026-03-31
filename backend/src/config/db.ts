import { env } from '../utils/env.js';
import mongoose from 'mongoose';

export const dbConfig = {
  url: env('DB_URL'),
  dbName: env('DB_NAME') || 'PollDB',
};

export async function connectToDatabase() {
  try {
    const dbUrl = dbConfig.url.trim();

    // Runtime validation with actionable guidance for local setup
    if (!dbUrl) {
      throw new Error('Missing DB_URL. Add DB_URL to backend/.env (example: mongodb://127.0.0.1:27017)');
    }

    await mongoose.connect(dbUrl, {
      dbName: dbConfig.dbName,
    });
    console.log('✅ Connected to MongoDB:', dbConfig.dbName);
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}
