import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import attendanceRoutes from './routes/attendanceRoutes';
import dotenv from 'dotenv';
import { connectRabbit } from './events/rabbit';

dotenv.config();

const app = express();

// ===== Middlewares ===== //
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use(morgan('dev'));

// ===== Routes ===== //
app.use('/api/attendance', attendanceRoutes);

// ===== Health Check ===== //
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'attendance-service' });
});

// ===== Error Handler ===== //
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Global Error Handler]', err);
  res
    .status(500)
    .json({ status: 'error', message: err.message || 'Internal Server Error' });
});

// ===== RabbitMQ Connection ===== //
connectRabbit()
  .then(() => console.log('[Attendance Service] Connected to RabbitMQ'))
  .catch((err) =>
    console.error('[Attendance Service] Failed to connect to RabbitMQ:', err),
  );

export default app;
