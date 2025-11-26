import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();
