import 'dotenv/config';
import 'express-async-errors';
import rateLimit from 'express-rate-limit';
import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // 100 reqs per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});

const isProd = process.env.NODE_ENV === 'production';

const app = express();

app.use(express.json());
app.use(cors());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cookieParser() as unknown as RequestHandler);
app.use(globalLimiter as unknown as RequestHandler);
app.use('/api/auth', authRoutes);

app.get('/health', (req: Request, res: Response) => res.json({ ok: true }));

app.set('trust proxy', 1); // if behind proxy (Heroku, Nginx, etc.)

if (isProd) {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https')
      return next();
    return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
  });
}

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res
    .status(err.statusCode || 500)
    .json({ message: err.message || 'Internal Server Error' });
});

export default app;
