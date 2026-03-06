import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET as string;
const gatewayToken = process.env.GATEWAY_TOKEN || 'gateway-internal-token';
const allowDirectAuth = process.env.ALLOW_DIRECT_AUTH === 'true';

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.header('x-gateway-token') === gatewayToken) {
    const id = req.header('x-user-id');
    const email = req.header('x-user-email') || '';
    const role = req.header('x-user-role') || '';

    if (!id || !role) {
      return next(new AppError('Missing forwarded auth headers', 401));
    }

    req.user = { id, email, role };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('No token provided or invalid token format.', 401),
    );
  }

  const token = authHeader.split(' ')[1];

  if (token === process.env.INTERNAL_TOKEN) {
    req.user = {
      id: 'internal-service',
      email: 'internal@service.local',
      role: 'ADMIN',
    };
    return next();
  }

  if (!allowDirectAuth) {
    return next(new AppError('Gateway authentication required', 401));
  }

  if (!JWT_SECRET) {
    return next(new AppError('JWT secret is not configured', 500));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;

    req.user = {
      id: payload.sub || payload.id || payload.userId,
      email: payload.email,
      role: payload.role,
    };

    return next();
  } catch (err) {
    return next(new AppError('Invalid or expired token.', 401));
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role || '')) {
      return next(new AppError('Forbidden: insufficient permissions', 403));
    }
    next();
  };
};
