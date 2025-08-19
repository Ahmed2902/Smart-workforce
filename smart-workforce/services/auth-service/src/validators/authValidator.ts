import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Z]/, 'must include uppercase')
    .regex(/[a-z]/, 'must include lowercase')
    .regex(/[0-9]/, 'must include number')
    .regex(/[^A-Za-z0-9]/, 'must include symbol'),
  name: z.string().trim().min(1).max(60),
  phone: z.string(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
