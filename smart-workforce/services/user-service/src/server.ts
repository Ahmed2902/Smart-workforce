import app from './app';
import { connectRabbit } from './events/rabbit';
import { consumeUserEvents } from './events/userConsumer';
import { PrismaClient } from '@prisma/client';
import config from './utils/config';
import { initRedis, closeRedis } from '@swma/shared';

const prisma = new PrismaClient();

const PORT = config.PORT || 4000;

async function start() {
  try {
    // Initialize Redis connection (optional, continues without if unavailable)
    try {
      await initRedis();
      console.log('✅ Redis connected');
    } catch (err) {
      console.warn(
        '⚠️  Redis unavailable, continuing without caching:',
        String(err),
      );
    }

    // connect to rabbit and start consuming
    await connectRabbit();
    await consumeUserEvents();

    const server = app.listen(PORT, () => {
      console.log(`🚀 User service running on port ${PORT}`);
    });

    const shutdown = async () => {
      console.log('Shutting down gracefully...');
      server.close();
      try {
        await prisma.$disconnect();
      } catch (e) {
        console.error('Error disconnecting prisma', e);
      }
      try {
        await closeRedis();
      } catch (e) {
        console.error('Error disconnecting redis', e);
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
