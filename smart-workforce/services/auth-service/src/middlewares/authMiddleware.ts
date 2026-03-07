import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';
import * as jwtUtil from '../utils/jwt';
import prisma from '../prismaClient';

const protect = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('No token provided or invalid token format.', 401),
    );
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwtUtil.verify(token);
    const user = await prisma.authUser.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401),
      );
    }
    req.authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token.', 401));
  }
};

export default protect;
