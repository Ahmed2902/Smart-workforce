import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        name?: string | null;
        role: string;
      };
      refreshToken: {
        sessionId: string;
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
