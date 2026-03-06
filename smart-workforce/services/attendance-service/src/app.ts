import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import attendanceRoutes from './routes/attendanceRoutes';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'attendance-service' });
});

app.use('/api/attendance', attendanceRoutes);

app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Global Error Handler]', err);
  res
    .status(500)
    .json({ status: 'error', message: err.message || 'Internal Server Error' });
});

export default app;
