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
    // Some services attach a separate userRole field from token parsing
    userRole?: string;
  }
}
