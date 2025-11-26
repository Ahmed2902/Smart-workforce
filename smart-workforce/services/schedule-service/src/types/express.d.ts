import 'express';

declare module 'express' {
  export interface Request {
    user?: { id: string; email?: string; role?: string };
    // Some services attach a separate userRole field from token parsing
    userRole?: string;
  }
}
