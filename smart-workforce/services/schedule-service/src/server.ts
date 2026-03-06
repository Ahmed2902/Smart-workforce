import { app } from './app';
import { connectRabbit } from './events/rabbit';
import { config } from './config/env';
import { consumeExternalEvents } from './events/consumer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = Number(config.port || 3003);

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
        `[schedule-service] ${label} attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms`,
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
    await retry('RabbitMQ consumer startup', () => consumeExternalEvents());

    const server = app.listen(PORT, () => {
      console.log(`[schedule-service] running on port ${PORT}`);
    });

    const shutdown = async () => {
      server.close();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[schedule-service] failed to start', error);
    process.exit(1);
  }
}

start();
