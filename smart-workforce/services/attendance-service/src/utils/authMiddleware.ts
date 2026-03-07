import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const gatewayToken = process.env.GATEWAY_TOKEN;
if (!gatewayToken) {
  throw new Error('GATEWAY_TOKEN environment variable is required');
}
const allowDirectAuth = process.env.ALLOW_DIRECT_AUTH === 'true';

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

  let token: string | undefined;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token === process.env.INTERNAL_TOKEN) {
    req.user = {
      id: 'internal-service',
      email: 'internal@service.local',
      role: 'ADMIN',
    };
    return next();
  }

  if (!allowDirectAuth) {
    return res.status(401).json({ message: 'Gateway authentication required.' });
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized. Token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id?: string;
      sub?: string;
      email?: string;
      role?: string;
    };

    req.user = {
      id: decoded.sub || decoded.id || '',
      email: decoded.email || '',
      role: decoded.role || '',
    };

    if (!req.user.id || !req.user.role) {
      return res.status(401).json({ message: 'Invalid token payload.' });
    }

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
