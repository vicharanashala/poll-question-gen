import * as dotenv from 'dotenv';
dotenv.config();
console.log('DB_URL type:', typeof process.env.DB_URL);
console.log('DB_URL value:', process.env.DB_URL);
