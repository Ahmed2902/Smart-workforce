import { z } from 'zod';

export const createAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid().optional(),
  status: z
    .enum(['PRESENT', 'ABSENT', 'LATE', 'SCHEDULED', 'LEFT_EARLY'])
    .optional(),
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;

