import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import AppError from '../utils/AppError';

const prisma = new PrismaClient();

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('No token provided or invalid token format.', 401),
    );
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET as string;
  if (token === process.env.INTERNAL_TOKEN) {
    return next();
  }

  try {
    const payload = jwt.verify(token, secret) as { id: string };
    console.log('Decoded payload:', payload);
    // Look up cached user (schedule-service uses CachedUser)
    const user = await prisma.cachedUser.findFirst({
      where: { id: payload.id },
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

    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token.', 401));
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
      return res
        .status(403)
        .json({ message: 'Forbidden: User role not found' });
    }

    console.log('User role:', req.user.role);

    // Check if user's role is allowed
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: 'Forbidden: insufficient permissions' });
    }

    next();
  };
};
