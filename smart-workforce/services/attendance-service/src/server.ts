import app from './app';
import dotenv from 'dotenv';
import { connectRabbit } from './events/rabbit';
import { consumeExternalEvents } from './events/consumer';
import { initRedis, closeRedis } from '@swma/shared';
import prisma from './prismaClient';

dotenv.config();

const PORT = Number(process.env.PORT || 3004);

async function retry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 15,
  delayMs = 2000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      console.warn(
        `[attendance-service] ${label} attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function startServer() {
  try {
    await retry('database connection', () => prisma.$connect());
    await retry('Redis connection', () => initRedis(), 10, 1500);
    await retry('RabbitMQ connection', () => connectRabbit());
    await retry('RabbitMQ consumer startup', () => consumeExternalEvents());

    const server = app.listen(PORT, () => {
      console.log(`[attendance-service] running on port ${PORT}`);
    });

    const shutdown = async () => {
      server.close();
      await prisma.$disconnect();
      try {
        await closeRedis();
      } catch (error) {
        console.warn('[attendance-service] failed to close redis cleanly', error);
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('[attendance-service] failed to start', err);
    process.exit(1);
  }
}

startServer();
