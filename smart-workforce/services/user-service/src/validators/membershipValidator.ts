import { z } from 'zod';

export const addMemberSchema = {
  body: z.object({
    userId: z.string().uuid(),
    role: z
      .enum(['ADMIN', 'MANAGER', 'EMPLOYEE'])
      .optional()
      .default('EMPLOYEE'),
  }),
  params: z.object({
    organizationId: z.string().uuid(),
  }),
};

export const updateMemberRoleSchema = {
  body: z.object({
    role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  }),
  params: z.object({
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
};
