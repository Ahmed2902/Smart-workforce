import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        authUserId?: string;
        email: string;
        name?: string | null;
        role: string;
        systemRole?: string;
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
