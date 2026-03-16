import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from './../prismaClient';

const gatewayToken = process.env.GATEWAY_TOKEN;
if (!gatewayToken) {
  throw new Error('GATEWAY_TOKEN environment variable is required');
}
const allowDirectAuth = process.env.ALLOW_DIRECT_AUTH === 'true';

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.header('x-gateway-token') === gatewayToken) {
    const authUserId = req.header('x-user-id');
    if (!authUserId) {
      return res.status(401).json({ message: 'Missing forwarded auth headers' });
    }

    const user = await prisma.user.findUnique({
      where: { authUserId },
      select: {
        id: true,
        authUserId: true,
        email: true,
        systemRole: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'The user no longer exists' });
    }

    req.user = {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      role: user.systemRole,
      systemRole: user.systemRole,
    };

    return next();
  }

  if (!allowDirectAuth) {
    return res.status(401).json({ message: 'Gateway authentication required' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET as string;
  try {
    const payload = jwt.verify(token, secret) as { sub?: string; id?: string };
    const subject = payload.sub || payload.id;
    if (!subject) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const user = await prisma.user.findUnique({
      where: { authUserId: subject },
      select: { id: true, email: true, systemRole: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'The user no longer exists' });
    }

    req.user = {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      role: user.systemRole,
      systemRole: user.systemRole,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.systemRole || req.user?.role;
    if (!req.user || !role || !roles.includes(role)) {
      return res
        .status(403)
        .json({ message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
};
