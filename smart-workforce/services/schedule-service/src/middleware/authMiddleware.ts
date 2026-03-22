import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError';
import prisma from '../prismaClient';
import { AuthenticatedUser } from '../types';
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
};

const attachRequestUser = (
  req: Request,
  cachedUser: {
    id: string;
    authUserId: string | null;
    email: string;
    role: string;
    systemRole: string;
    organizationId: string;
  },
  email?: string,
) => {
  const user: AuthenticatedUser = {
    id: cachedUser.id,
    userId: cachedUser.id,
    authUserId: cachedUser.authUserId ?? undefined,
    email: email || cachedUser.email,
    systemRole: cachedUser.systemRole || 'USER',
    organizationId: cachedUser.organizationId,
    organizationRole: cachedUser.role,
  };

  req.user = user;
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.header('x-gateway-token') === gatewayToken) {
    const authUserId = req.header('x-user-id');
    const email = req.header('x-user-email') || '';

    if (!authUserId) {
      return next(new AppError('Missing forwarded auth headers', 401));
    }

    const cachedUser = await prisma.cachedUser.findFirst({
      where: { authUserId },
      select: {
        id: true,
        authUserId: true,
        email: true,
        role: true,
        systemRole: true,
        organizationId: true,
      },
    });

    if (!cachedUser?.id) {
      return next(new AppError('User not found in cache', 401));
    }

    attachRequestUser(req, cachedUser, email);
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

    const cachedUser = await prisma.cachedUser.findFirst({
      where: { authUserId: subject },
      select: {
        id: true,
        authUserId: true,
        email: true,
        role: true,
        systemRole: true,
        organizationId: true,
      },
    });

    if (!cachedUser?.id) {
      return next(new AppError('User not found in cache', 401));
    }

    attachRequestUser(req, cachedUser, payload.email);
    return next();
  } catch (error) {
    return next(new AppError('Invalid or expired token.', 401));
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(403)
        .json({ message: 'Forbidden: User context not found' });
    }

    if (req.user.systemRole === 'SUPERADMIN') {
      return next();
    }

    if (!req.user.organizationRole || !roles.includes(req.user.organizationRole)) {
      return res
        .status(403)
        .json({ message: 'Forbidden: insufficient permissions' });
    }

    next();
  };
};
