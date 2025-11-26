import { PrismaClient, AttendanceStatus } from '@prisma/client';
import AppError from '../utils/appError';
import {
  validateShiftForEmployee,
  isLateForShift,
} from '../utils/scheduleService';
import {
  acquireLock,
  releaseLock,
  getCache,
  setCache,
  deleteCache,
  Cache,
} from '@swma/shared';

const prisma = new PrismaClient();

export class attendance {
  async CheckIn(id: string) {
    const lockKey = `lock:checkin:${id}`;
    const lockAcquired = await acquireLock(lockKey, 30); // 30 second lock

    if (!lockAcquired) {
      throw new AppError('Check-in already in progress', 409);
    }

    try {
      const attendance = await prisma.attendance.findFirst({
        where: { id },
      });

      if (!attendance) throw new AppError('Attendance record not found', 404);
      if (attendance.clockIn) throw new AppError('Already checked in', 400);

      const now = new Date();

      // If there's a shift assigned, validate it
      if (attendance.shiftId) {
        const isValidShift = await validateShiftForEmployee(
          attendance.shiftId,
          attendance.employeeId,
        );

        if (!isValidShift) {
          throw new AppError('Invalid shift for this employee', 400);
        }

        const isLate = await isLateForShift(attendance.shiftId);
        const status = isLate
          ? AttendanceStatus.LATE
          : AttendanceStatus.PRESENT;

        const result = await prisma.attendance.update({
          where: { id, clockIn: null },
          data: {
            clockIn: now,
            status,
            updatedAt: now,
          },
        });

        // Invalidate employee hours cache after successful check-in
        await this.invalidateEmployeeHoursCache(attendance.employeeId);

        return result;
      }

      // If no shift assigned, mark as present
      const result = await prisma.attendance.update({
        where: { id },
        data: {
          clockIn: now,
          status: AttendanceStatus.PRESENT,
          updatedAt: now,
        },
      });

      // Invalidate employee hours cache after successful check-in
      await this.invalidateEmployeeHoursCache(attendance.employeeId);

      return result;
    } finally {
      // Always release the lock
      await releaseLock(lockKey);
    }
  }

  /**
   * Employee checks out
   * Uses distributed lock to prevent race conditions
   */
  async CheckOut(id: string) {
    const lockKey = `lock:checkout:${id}`;
    const lockAcquired = await acquireLock(lockKey, 30); // 30 second lock

    if (!lockAcquired) {
      throw new AppError('Check-out already in progress', 409);
    }

    try {
      const attendance = await prisma.attendance.findFirst({
        where: { id },
      });

      if (!attendance) throw new AppError('Attendance record not found', 404);
      if (!attendance.clockIn)
        throw new AppError('Cannot check out before checking in', 400);
      if (attendance.clockOut) throw new AppError('Already checked out', 400);

      const now = new Date();

      const result = await prisma.attendance.update({
        where: { id, clockIn: { lt: new Date() } },
        data: {
          clockOut: now,
          updatedAt: now,
        },
      });

      // Invalidate employee hours cache after successful check-out
      await this.invalidateEmployeeHoursCache(attendance.employeeId);

      return result;
    } finally {
      // Always release the lock
      await releaseLock(lockKey);
    }
  }

  /**
   * Get attendance record by employee
   */
  async getEmployeeAttendance(employeeId: string) {
    return prisma.attendance.findMany({
      where: { employeeId },

      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get employee hours with caching
   * Caches results for 5 minutes with automatic invalidation on check-in/out
   */
  @Cache(`emp:{employeeId}:hours:{period}`, 300)
  async getEmployeeHours(employeeId: string, period: string) {
    if (!employeeId || !period) {
      throw new AppError('employee and period are required', 400);
    }

    console.log(
      `[CACHE MISS] Calculating hours for ${employeeId} in ${period}`,
    );

    const firstDayOfMonthString = `${period.substring(0, 7)}-01T00:00:00.000Z`;
    const startDate = new Date(firstDayOfMonthString);

    if (isNaN(startDate.getTime())) {
      throw new AppError(
        'Invalid period date format. Must be YYYY-MM or YYYY-MM-DD.',
        400,
      );
    }
    const endDate = new Date(startDate);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);

    const records = await prisma.attendance.findMany({
      where: {
        employeeId,
        clockIn: { gte: startDate },
        clockOut: { lt: endDate },
      },
    });

    if (!records.length) {
      throw new AppError('no records for this period', 404);
    }

    let totalHours = 0;
    let overtimeHours = 0;

    records.forEach((r) => {
      if (r.clockIn && r.clockOut) {
        const hours =
          (r.clockOut.getTime() - r.clockIn.getTime()) / (1000 * 60 * 60);

        if (hours > 8) {
          totalHours += 8;
          overtimeHours += hours - 8;
        } else {
          totalHours += hours;
        }
      }
    });

    const result = { totalHours, overtimeHours };

    return result;
  }

  /**
   * Helper function to invalidate all hours cache keys for an employee
   * Clears all period caches since we don't know which period was affected
   */
  private async invalidateEmployeeHoursCache(
    employeeId: string,
  ): Promise<void> {
    try {
      // In a real scenario with many keys, you might use SCAN to find pattern matches
      // For now, we'll just clear the current month's cache
      const now = new Date();
      const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const cacheKey = `emp:${employeeId}:hours:${currentPeriod}`;
      await deleteCache(cacheKey);
      console.log(`[CACHE INVALIDATED] Employee hours cache for ${employeeId}`);
    } catch (error) {
      console.error('Error invalidating cache:', error);
      // Don't throw - cache invalidation failure shouldn't break the operation
    }
  }
}

export const attendanceService = new attendance();
