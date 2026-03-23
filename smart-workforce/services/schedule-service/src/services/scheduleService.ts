import AppError from '../utils/AppError';
import { AuthenticatedUser, ScheduleInput } from '../types';
import prisma from '../prismaClient';
import {
  assertOrgWriteAccess,
  assertSameOrganization,
  isSuperadmin,
} from '../utils/accessControl';

export const createSchedule = async (
  actor: AuthenticatedUser,
  data: ScheduleInput,
) => {
  if (data.endDate <= data.startDate) {
    throw new AppError('Start date must be before end date', 400);
  }

  assertOrgWriteAccess(
    actor,
    data.organizationId,
    'You can only create schedules for your organization',
  );

  const org = await prisma.cachedOrganization.findUnique({
    where: { id: data.organizationId },
  });
  if (!org) throw new AppError('Schedule must have an Organization', 404);

  if (data.departmentId) {
    const dept = await prisma.cachedDepartment.findUnique({
      where: { id: data.departmentId },
    });

    if (!dept || dept.organizationId !== data.organizationId) {
      throw new AppError(
        'This department does not belong to the organization',
        400,
      );
    }
  }

  return prisma.schedule.create({ data });
};

// services/scheduleService.ts
export const getSchedules = async (
  actor: AuthenticatedUser,
  filters: {
    organizationId?: string;
    departmentId?: string;
    from?: Date;
    to?: Date;
    skip?: number;
    take?: number;
  },
) => {
  if (!isSuperadmin(actor)) {
    if (
      filters.organizationId &&
      filters.organizationId !== actor.organizationId
    ) {
      throw new AppError(
        'You can only view schedules from your organization',
        403,
      );
    }
  }

  return prisma.schedule.findMany({
    where: {
      organizationId: isSuperadmin(actor)
        ? filters.organizationId
        : actor.organizationId,
      ...(filters.departmentId && { departmentId: filters.departmentId }),
      ...(filters.from && { startDate: { gte: filters.from } }),
      ...(filters.to && { endDate: { lte: filters.to } }),
    },
    skip: filters.skip,
    take: filters.take,
    orderBy: { startDate: 'asc' },
    include: {
      organization: true,
      department: true,
      createdBy: true,
      shifts: true,
    },
  });
};

export const getScheduleById = async (actor: AuthenticatedUser, id: string) => {
  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      organization: true,
      department: true,
      createdBy: true,
      shifts: { include: { assignments: true } },
    },
  });

  if (!schedule) throw new AppError('Schedule not found', 404);

  assertSameOrganization(
    actor,
    schedule.organizationId,
    'You can only view schedules from your organization',
  );

  return schedule;
};

export const updateSchedule = async (
  actor: AuthenticatedUser,
  data: ScheduleInput,
) => {
  const existing = await prisma.schedule.findUnique({ where: { id: data.id } });
  if (!existing) throw new AppError('Schedule not found', 404);

  assertOrgWriteAccess(
    actor,
    existing.organizationId,
    'You can only update schedules from your organization',
  );

  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    throw new AppError('Start date must be before end date', 400);
  }

  // Cannot change organization
  if (data.organizationId && data.organizationId !== existing.organizationId) {
    throw new AppError('Cannot change schedule organization', 400);
  }

  if (data.departmentId) {
    const dept = await prisma.cachedDepartment.findUnique({
      where: { id: data.departmentId },
    });
    if (
      !dept ||
      dept.organizationId !== (data.organizationId ?? existing.organizationId)
    ) {
      throw new AppError(
        'Department does not belong to the given organization',
        400,
      );
    }
  }

  return prisma.schedule.update({
    where: { id: data.id },
    data,
  });
};

export const deleteSchedule = async (actor: AuthenticatedUser, id: string) => {
  const existing = await prisma.schedule.findUnique({
    where: { id },
    include: { shifts: { include: { assignments: true } } },
  });

  if (!existing) throw new AppError('Schedule not found', 404);

  assertOrgWriteAccess(
    actor,
    existing.organizationId,
    'You can only delete schedules from your organization',
  );

  // Delete assignments → shifts → schedule
  for (const shift of existing.shifts) {
    await prisma.shiftAssignment.deleteMany({ where: { shiftId: shift.id } });
  }
  await prisma.shift.deleteMany({ where: { scheduleId: id } });
  return prisma.schedule.delete({ where: { id } });
};
