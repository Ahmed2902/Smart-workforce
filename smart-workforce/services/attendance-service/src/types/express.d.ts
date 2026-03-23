import 'express';

declare module 'express' {
  export interface Request {
    user?: {
      id: string;
      userId: string;
      authUserId?: string;
      email: string;
      systemRole: string;
      organizationId?: string | null;
      organizationRole?: string | null;
    };
    internalService?: string;
  }
}
