import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET as string;

// Protect middleware: verifies JWT and attaches authUser (id,email,role) to req.authUser
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

  // Allow internal service-to-service calls using a shared internal token
  if (token === process.env.INTERNAL_TOKEN) {
    return next();
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

// Middleware to restrict access based on role(s)
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role || '')) {
      return next(new AppError('Forbidden: insufficient permissions', 403));
    }
    next();
  };
};
