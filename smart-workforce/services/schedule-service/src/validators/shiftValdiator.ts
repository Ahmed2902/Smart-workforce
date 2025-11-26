import { z, AnyZodObject } from 'zod';

// ========== COMMON SCHEMAS ========== //
export const idParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid ID format' }),
});

export const employeeIdParamSchema = z.object({
  employeeId: z.string().uuid({ message: 'Invalid employee ID format' }),
});

// ========== CREATE SHIFT ========== //
const createShiftBase = z.object({
  scheduleId: z.string().uuid({ message: 'Schedule ID is required' }),
  role: z.string().optional(),
  startTime: z.coerce.date({ message: 'Start time must be a valid date' }),
  endTime: z.coerce.date({ message: 'End time must be a valid date' }),
  location: z.string().optional(),
});

export const createShiftSchema = createShiftBase.refine(
  (data) => data.endTime > data.startTime,
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  },
) as unknown as AnyZodObject;

// ========== UPDATE SHIFT ========== //
const updateShiftBase = z.object({
  role: z.string().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  location: z.string().optional(),
});

export const updateShiftSchema = updateShiftBase.refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return data.endTime > data.startTime;
    }
    return true;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  },
) as unknown as AnyZodObject;

// ========== LIST SHIFTS QUERY ========== //
export const listShiftsQuerySchema = z.object({
  scheduleId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  role: z.string().optional(),
});

// ========== ASSIGN / UNASSIGN EMPLOYEE ========== //
export const assignEmployeeSchema = z
  .object({
    employeeId: z.string().uuid({ message: 'Employee ID is required' }),
  })
  .strict();

export const unassignEmployeeSchema = z
  .object({
    employeeId: z.string().uuid({ message: 'Employee ID is required' }),
  })
  .strict();
