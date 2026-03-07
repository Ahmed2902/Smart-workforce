import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

const gatewayToken = process.env.GATEWAY_TOKEN;
if (!gatewayToken) {
  throw new Error('GATEWAY_TOKEN environment variable is required');
}
const allowDirectAuth = process.env.ALLOW_DIRECT_AUTH === 'true';

type JwtClaims = {
  sub?: string;
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
};

export const protect = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (req.header('x-gateway-token') === gatewayToken) {
    const id = req.header('x-user-id');
    const email = req.header('x-user-email') || '';
    const role = req.header('x-user-role') || '';

    if (!id || !role) {
      return res.status(401).json({ message: 'Missing forwarded auth headers' });
    }

    req.user = { id, email, role };
    return next();
  }

  if (!allowDirectAuth) {
    return res.status(401).json({ message: 'Gateway authentication required.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ message: 'JWT secret is not configured' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, jwtSecret) as JwtClaims;
    const subject = payload.sub || payload.id || payload.userId;

    if (!subject) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    req.user = {
      id: subject,
      email: payload.email || '',
      role: payload.role || 'USER',
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
