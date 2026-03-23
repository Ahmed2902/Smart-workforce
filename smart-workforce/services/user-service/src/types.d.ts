import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        userId: string;
        authUserId?: string;
        email: string;
        name?: string | null;
        systemRole: string;
        organizationId?: string | null;
        organizationRole?: string | null;
      };
    }
  }
}

export interface JwtPayload {
  sub: string;
  exp: number;
  [key: string]: any; // Allows for other custom properties
}

export {};
