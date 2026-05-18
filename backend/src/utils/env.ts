import dotenv from 'dotenv';
import path from 'path';

// force correct .env path
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

export function env(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Invalid ${key}: ${value}`);
  }

  return value;
}