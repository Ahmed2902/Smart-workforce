import { PrismaClient } from '@prisma/client';
import AppError from '../utils/AppError';
import { ScheduleInput } from '../types';

const prisma = new PrismaClient();

type ScheduleFilters = {
  organizationId?: string;
  departmentId?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
};

export class ScheduleService {
  async createSchedule(data: ScheduleInput) {
    if (data.endDate <= data.startDate) {
      throw new AppError('Start date must be before end date', 400);
    }

    const user = await prisma.cachedUser.findUnique({
      where: { id: data.createdById },
    });
    if (!user) throw new AppError('Creator no longer exists', 404);

    if (user.organizationId !== data.organizationId) {
      throw new AppError(
        'You can only create schedules for your organization',
        403,
      );
    }

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
  }

  async getSchedules(userId: string, filters: ScheduleFilters) {
    const user = await prisma.cachedUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError('User not found', 404);

    if (
      filters.organizationId &&
      filters.organizationId !== user.organizationId
    ) {
      throw new AppError(
        'You can only view schedules from your organization',
        403,
      );
    }

    return prisma.schedule.findMany({
      where: {
        organizationId: user.organizationId,
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
  }

  async getScheduleById(userId: string, id: string) {
    const user = await prisma.cachedUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError('User not found', 404);

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

    if (schedule.organizationId !== user.organizationId) {
      throw new AppError(
        'You can only view schedules from your organization',
        403,
      );
    }

    return schedule;
  }

  async updateSchedule(userId: string, data: ScheduleInput) {
    const user = await prisma.cachedUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError('User not found', 404);

    const existing = await prisma.schedule.findUnique({ where: { id: data.id } });
    if (!existing) throw new AppError('Schedule not found', 404);

    if (existing.organizationId !== user.organizationId) {
      throw new AppError(
        'You can only update schedules from your organization',
        403,
      );
    }

    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      throw new AppError('Start date must be before end date', 400);
    }

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
  }

  async deleteSchedule(userId: string, id: string) {
    const user = await prisma.cachedUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError('User not found', 404);

    const existing = await prisma.schedule.findUnique({
      where: { id },
      include: { shifts: { include: { assignments: true } } },
    });

    if (!existing) throw new AppError('Schedule not found', 404);

    if (existing.organizationId !== user.organizationId) {
      throw new AppError(
        'You can only delete schedules from your organization',
        403,
      );
    }

    for (const shift of existing.shifts) {
      await prisma.shiftAssignment.deleteMany({ where: { shiftId: shift.id } });
    }
    await prisma.shift.deleteMany({ where: { scheduleId: id } });
    return prisma.schedule.delete({ where: { id } });
  }
}

export default new ScheduleService();
