import express from 'express';
import bodyParser from 'body-parser';
import { connectRabbit } from './events/rabbit';
import { initRedis, closeRedis } from '@swma/shared/src/redis';
import authRoutes from './routes/authRoutes'; // adjust path if needed

const app = express();
const PORT = process.env.PORT || 4000;

app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);

const startServer = async () => {
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

    // Try to connect to RabbitMQ before starting server. If RabbitMQ
    // is not available in local dev, log a warning and continue so the
    // HTTP server can still be used for local development.
    try {
      await connectRabbit();
    } catch (err) {
      console.warn(
        '⚠️  RabbitMQ unavailable, continuing without events:',
        String(err),
      );
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 Auth service running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down gracefully...');
      server.close();
      await closeRedis();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Shutting down gracefully...');
      server.close();
      await closeRedis();
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Failed to start service:', err);
    process.exit(1);
  }
};

startServer();
