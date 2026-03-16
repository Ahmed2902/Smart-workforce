import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError';
import prisma from '../prismaClient';
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

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.header('x-gateway-token') === gatewayToken) {
    const authUserId = req.header('x-user-id');
    const email = req.header('x-user-email') || '';
    const role = req.header('x-user-role') || '';

    if (!authUserId || !role) {
      return next(new AppError('Missing forwarded auth headers', 401));
    }

    // Resolve cached user by email to map to user-service UUID
    const cachedUser = await prisma.cachedUser.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!cachedUser?.id) {
      return next(new AppError('User not found in cache', 401));
    }

    req.user = { id: cachedUser.id, email, role };
    return next();
  }

  if (!allowDirectAuth) {
    return next(new AppError('Gateway authentication required', 401));
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('No token provided or invalid token format.', 401),
    );
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next(new AppError('JWT secret is not configured', 500));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, jwtSecret) as JwtClaims;
    const subject = payload.sub || payload.id || payload.userId;
    if (!subject) {
      return next(new AppError('Invalid token payload', 401));
    }

    let email = payload.email || '';
    let role = payload.role || '';

    if (!email || !role) {
      const cachedUser = await prisma.cachedUser.findUnique({
        where: { id: subject },
        select: { email: true, role: true },
      });

      if (cachedUser) {
        email = email || cachedUser.email;
        role = role || cachedUser.role;
      }
    }

    if (!role) {
      return next(new AppError('Invalid token payload', 401));
    }

    req.user = { id: subject, email, role };
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
