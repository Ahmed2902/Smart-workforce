import AppError from '../utils/AppError';
import { AuthenticatedUser, ShiftInput } from '../types';
import prisma from '../prismaClient';
import {
  assertOrgWriteAccess,
  assertSameOrganization,
  isSuperadmin,
} from '../utils/accessControl';

export const createShift = async (
  actor: AuthenticatedUser,
  data: ShiftInput,
) => {
  if (!data.createdById) {
    throw new AppError('Creator is required', 401);
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: data.scheduleId },
  });

  if (!schedule) throw new AppError('schedule not found', 404);

  assertOrgWriteAccess(
    actor,
    schedule.organizationId,
    'You can only manage shifts for your organization',
  );

  if (data.startTime >= data.endTime) {
    throw new AppError('Shift start must be before end', 400);
  }

  // Ensure shift fits in schedule
  if (data.startTime < schedule.startDate || data.endTime > schedule.endDate) {
    throw new AppError('Shift must be inside schedule dates', 400);
  }

  // Create shift
  return prisma.shift.create({
    data: {
      name: data.name,
      location: data.location,
      startTime: data.startTime,
      endTime: data.endTime,
      schedule: {
        connect: { id: data.scheduleId },
      },
      user: {
        connect: { id: data.createdById },
      },
    },
  });
};

export const getShifts = async (
  actor: AuthenticatedUser,
  scheduleId?: string,
) => {
  if (scheduleId) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new AppError('schedule not found', 404);
    }

    assertSameOrganization(
      actor,
      schedule.organizationId,
      'You can only view shifts from your organization',
    );
  }

  return prisma.shift.findMany({
    where: scheduleId
      ? {
          scheduleId,
        }
      : isSuperadmin(actor)
        ? undefined
        : {
            schedule: {
              organizationId: actor.organizationId ?? undefined,
            },
          },
    include: { assignments: true },
  });
};

export const getShiftById = async (actor: AuthenticatedUser, id: string) => {
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { assignments: { include: { employee: true } }, schedule: true },
  });
  if (!shift) throw new AppError('Shift not found', 404);

  assertSameOrganization(
    actor,
    shift.schedule?.organizationId,
    'You can only view shifts from your organization',
  );

  return shift;
};

export const updateShift = async (
  actor: AuthenticatedUser,
  id: string,
  data: Partial<ShiftInput>,
) => {
  const existing = await prisma.shift.findUnique({
    where: { id },
    include: { schedule: true },
  });
  if (!existing) throw new AppError('shift not found', 404);

  assertOrgWriteAccess(
    actor,
    existing.schedule?.organizationId,
    'You can only manage shifts for your organization',
  );

  if (data.startTime && data.endTime && data.startTime >= data.endTime) {
    throw new AppError('Shift start must be before end', 400);
  }

  return prisma.shift.update({
    where: { id },
    data,
  });
};

export const deleteShift = async (actor: AuthenticatedUser, id: string) => {
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { schedule: true },
  });
  if (!shift) throw new AppError('shift not found', 404);

  assertOrgWriteAccess(
    actor,
    shift.schedule?.organizationId,
    'You can only manage shifts for your organization',
  );

  await prisma.shiftAssignment.deleteMany({ where: { shiftId: id } });
  return prisma.shift.delete({ where: { id } });
};
