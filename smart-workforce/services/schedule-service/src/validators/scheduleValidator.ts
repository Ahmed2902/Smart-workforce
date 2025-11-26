import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid() });

export const createScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' }),
  endDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' }),
  createdById: z.string().uuid(),
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
});

export const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' })
    .optional(),
  endDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' })
    .optional(),
  organizationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
});

export const listSchedulesQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  from: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' })
    .optional(),
  to: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' })
    .optional(),
  skip: z.preprocess(
    (v) => (v ? Number(v) : undefined),
    z.number().int().nonnegative().optional(),
  ),
  take: z.preprocess(
    (v) => (v ? Number(v) : undefined),
    z.number().int().positive().optional(),
  ),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
