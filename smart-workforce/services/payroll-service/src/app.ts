import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import payrollRoutes from './routes/payrollRoute';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// health
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'payroll-service' });
});

// api
app.use('/api/payroll', payrollRoutes);

app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err?.statusCode || 500).json({
    status: err?.status || 'error',
    message: err?.message || 'Internal Server Error',
  });
});

export default app;
