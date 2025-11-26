import app from './app';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { connectRabbit } from './events/rabbit';
import { consumeExternalEvents } from './events/consumer';
import { initRedis, closeRedis } from '@swma/shared';

dotenv.config();

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3003;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('[Attendance Service] Database connected successfully');

    // Initialize Redis client
    await initRedis();
    console.log('[Attendance Service] Redis connected successfully');

    // Connect to RabbitMQ and start consuming events
    await connectRabbit();
    await consumeExternalEvents();
    console.log('[Attendance Service] Event consumers initialized');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`[Attendance Service] Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Attendance Service] Failed to start:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  await closeRedis();
  console.log('[Attendance Service] Prisma and Redis disconnected');
  process.exit(0);
});

startServer();
