import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const get = (k: string, fallback?: string) => process.env[k] ?? fallback;

export default {
  PORT: Number(get('PORT', '3002')),
  DATABASE_URL: get(
    'DATABASE_URL',
    'postgres://postgres:postgres@localhost:5432/userdb',
  ),
  RABBITMQ_URL: get('RABBITMQ_URL', 'amqp://localhost'),
  JWT_SECRET: get('JWT_SECRET', 'change-me'),
  NODE_ENV: get('NODE_ENV', 'development'),
};
