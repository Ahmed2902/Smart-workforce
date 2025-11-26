import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  organizationId: z.string().min(1),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();
