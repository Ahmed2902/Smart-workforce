import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from './../prismaClient';

// Protect middleware: verifies JWT and attaches user (id,email,role) to req.user
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new Error('No token provided or invalid token format.'));
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET as string;
  if (token === process.env.INTERNAL_TOKEN) {
    return next();
  }
  try {
    const payload = jwt.verify(token, secret) as {
      sub: string;
    };
    console.log('🔑 Decoded JWT payload:', payload); // 👈 log token contents

    // 👇 look up the local user by authUserId
    const user = await prisma.user.findUnique({
      where: { authUserId: payload.sub },
      select: { id: true, email: true, systemRole: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return next(
        new Error('The user belonging to this token no longer exists.'),
      );
    }
    console.log('👤 User fetched from DB:', user);

    // Attach to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.systemRole,
    };

    next();
  } catch (error) {
    return next(new Error('Invalid or expired token.'));
  }
};

// ✅ Middleware to restrict access based on role
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
};
