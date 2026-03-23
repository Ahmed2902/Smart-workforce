import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        authUserId?: string;
        email: string;
        systemRole: string;
        organizationId?: string | null;
        organizationRole?: string | null;
      };
    }
  }
}
