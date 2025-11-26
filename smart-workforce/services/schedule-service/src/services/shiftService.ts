import { PrismaClient } from '@prisma/client';
import AppError from '../utils/AppError';
import { ShiftInput } from '../types';

const prisma = new PrismaClient();

export const createShift = async (data: ShiftInput) => {
  const schedule = await prisma.schedule.findUnique({
    where: { id: data.scheduleId },
  });

  if (!schedule) throw new AppError('schedule not found', 404);

  if (data.startTime >= data.endTime) {
    throw new AppError('Shift start must be before end', 400);
  }

  // Ensure shift fits in schedule
  if (data.startTime < schedule.startDate || data.endTime > schedule.endDate) {
    throw new AppError('Shift must be inside schedule dates', 400);
  }

  // Create shift
  return await prisma.shift.create({
    data: {
      name: data.name,
      location: data.location,
      startTime: data.startTime,
      endTime: data.endTime,
      schedule: {
        connect: { id: data.scheduleId },
      },
      user: {
        connect: { id: data.CreatedBy },
      },
    },
  });
};

export const getShifts = async (scheduleId?: string) => {
  return await prisma.shift.findMany({
    where: scheduleId
      ? {
          scheduleId,
        }
      : undefined,
    include: { assignments: true },
  });
};

export const getShiftById = async (id: string) => {
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { assignments: { include: { employee: true } } },
  });
  if (!shift) throw new AppError('Shift not found', 404);
  return shift;
};

export const updateShift = async (id: string, data: Partial<ShiftInput>) => {
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) throw new AppError('shift not found', 404);

  if (data.startTime && data.endTime && data.startTime >= data.endTime) {
    throw new AppError('Shift start must be before end', 400);
  }

  return prisma.shift.update({
    where: { id },
    data,
  });
};

export const deleteShift = async (id: string) => {
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift) throw new AppError('shift not found', 404);
  await prisma.shiftAssignment.deleteMany({ where: { shiftId: id } });
  return await prisma.shift.delete({ where: { id } });
};
