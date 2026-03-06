import app from './app';
import { connectRabbit } from './events/rabbit';
import prisma from './prismaClient';
import { initRedis, closeRedis } from '@swma/shared';

const PORT = Number(process.env.PORT || 3001);

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
        `[auth-service] ${label} attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms`,
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

    try {
      await retry('Redis connection', () => initRedis(), 5, 1500);
    } catch (error) {
      console.warn(
        '[auth-service] Redis unavailable, continuing without cache',
        String(error),
      );
    }

    const server = app.listen(PORT, () => {
      console.log(`[auth-service] running on port ${PORT}`);
    });

    const shutdown = async () => {
      server.close();
      await prisma.$disconnect();
      try {
        await closeRedis();
      } catch (error) {
        console.warn('[auth-service] failed to close Redis cleanly', error);
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[auth-service] failed to start', error);
    process.exit(1);
  }
}

start();
