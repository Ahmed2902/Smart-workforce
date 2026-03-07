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
    const id = req.header('x-user-id');
    const email = req.header('x-user-email') || '';
    const role = req.header('x-user-role') || '';

    if (!id || !role) {
      return res.status(401).json({ message: 'Missing forwarded auth headers' });
    }

    req.user = { id, email, role };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
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
    return res.status(401).json({ message: 'Gateway authentication required' });
  }

  const secret = process.env.JWT_SECRET as string;
  try {
    const payload = jwt.verify(token, secret) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { authUserId: payload.sub },
      select: { id: true, email: true, systemRole: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'The user no longer exists' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.systemRole,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

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
