import { z } from 'zod';
import { AttendanceStatus, LeaveStatus, LeaveType } from '@prisma/client';

export const clockInSchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid().optional(),
});

export const clockOutSchema = z.object({
  employeeId: z.string().uuid(),
});

export const updateAttendanceSchema = z.object({
  status: z.nativeEnum(AttendanceStatus),
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
});

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.nativeEnum(LeaveType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(1).max(500).optional(),
});

export const updateLeaveRequestSchema = z.object({
  status: z.nativeEnum(LeaveStatus),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// Types
export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
