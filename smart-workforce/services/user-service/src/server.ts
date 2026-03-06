import app from './app';
import { connectRabbit } from './events/rabbit';
import { consumeUserEvents } from './events/userConsumer';
import { PrismaClient } from '@prisma/client';
import config from './utils/config';
import { initRedis, closeRedis } from '@swma/shared';

const prisma = new PrismaClient();
const PORT = config.PORT || 3002;

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
        `[user-service] ${label} attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function start() {
  try {
    await retry('database connection', () => prisma.$connect());
    await retry('RabbitMQ connection', () => connectRabbit());
    await retry('RabbitMQ consumer startup', () => consumeUserEvents());

    try {
      await retry('Redis connection', () => initRedis(), 5, 1500);
    } catch (error) {
      console.warn(
        '[user-service] Redis unavailable, continuing without cache',
        String(error),
      );
    }

    const server = app.listen(PORT, () => {
      console.log(`[user-service] running on port ${PORT}`);
    });

    const shutdown = async () => {
      server.close();
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.warn('[user-service] failed to close prisma cleanly', error);
      }
      try {
        await closeRedis();
      } catch (error) {
        console.warn('[user-service] failed to close redis cleanly', error);
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[user-service] failed to start', error);
    process.exit(1);
  }
}

start();
