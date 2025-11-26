import express from 'express';
import scheduleRoutes from './routes/scheduleRoutes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Routes
app.use('/api/', scheduleRoutes);

// Error handler (should always be last)
app.use(errorHandler);
