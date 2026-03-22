import { z } from 'zod';

export const createUserSchema = z.object({
  authUserId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE']).optional(),
});

export const updateUserSchema = createUserSchema.partial();
