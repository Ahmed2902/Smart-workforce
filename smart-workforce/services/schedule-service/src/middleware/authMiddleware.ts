import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import AppError from '../utils/AppError';

const prisma = new PrismaClient();
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

  const secret = process.env.JWT_SECRET as string;
  try {
    const payload = jwt.verify(token, secret) as { id?: string; sub?: string };
    const subject = payload.sub || payload.id;
    if (!subject) {
      return next(new AppError('Invalid token payload', 401));
    }

    const user = await prisma.cachedUser.findFirst({
      where: { id: subject },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401),
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    return next(new AppError('Invalid or expired token.', 401));
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res
        .status(403)
        .json({ message: 'Forbidden: User role not found' });
    }

    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: 'Forbidden: insufficient permissions' });
    }

    next();
  };
};
