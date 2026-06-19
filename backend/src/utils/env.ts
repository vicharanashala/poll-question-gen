import * as dotenv from 'dotenv';
dotenv.config(); // { path: `.env.${process.env.NODE_ENV}` }

export function env(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue;
}

export function envOrFail(key: string): string {
  if (typeof process.env[key] === 'undefined') {
    throw new Error(`Environment variable ${key} is not set.`);
  }

  return process.env[key] as string;
}