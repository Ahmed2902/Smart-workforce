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
import prisma from './prismaClient';
import * as jwtUtil from './utils/jwt';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // 100 reqs per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});

const isProd = process.env.NODE_ENV === 'production';
const gatewayToken = process.env.GATEWAY_TOKEN || 'gateway-internal-token';

const app = express();

app.use(express.json());
app.use(cors());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cookieParser() as unknown as RequestHandler);

app.get('/internal/auth/verify', async (req: Request, res: Response) => {
  if (req.header('x-gateway-token') !== gatewayToken) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing token' });
  }

  const rawToken = authHeader.split(' ')[1];

  try {
    const payload = jwtUtil.verify(rawToken) as {
      sub?: string;
      id?: string;
      userId?: string;
    };
    const subject = payload.sub || payload.id || payload.userId;
    if (!subject) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const user = await prisma.authUser.findUnique({
      where: { id: subject },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    res.setHeader('X-User-Id', user.id);
    res.setHeader('X-User-Email', user.email);
    res.setHeader('X-User-Role', user.role);
    res.setHeader('X-Auth-Sub', subject);
    return res.status(204).send();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
});

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
