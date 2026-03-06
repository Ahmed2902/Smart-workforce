// src/app.ts
import express from 'express';
import userRoutes from './routes/userRoutes';
import departmentRoutes from './routes/depratmentRoutes';
import organizationRoutes from './routes/organizationsRoutes';
import logger from './utils/logger';
import errorMiddleware from './middleware/errorMiddleware';
import setupSwagger from './utils/swagger';

const app = express();

app.use(express.json());

// Simple request logging
app.use((req, res, next) => {
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`);
  });
  next();
});

// Routes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'user-service' });
});

app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/organizations', organizationRoutes);

// Swagger
setupSwagger(app);

// Error handler (last)
app.use(errorMiddleware);

export default app;
