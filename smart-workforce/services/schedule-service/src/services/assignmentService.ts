import { PrismaClient } from '@prisma/client';
import AppError from '../utils/AppError';
import { shiftAssignmentInput } from '../types';
import {
  publishShiftAssigned,
  publishShiftUnassigned,
} from '../events/producer';

const prisma = new PrismaClient();

export class AssignmentService {
  async assignEmployee(data: shiftAssignmentInput) {
    const shift = await prisma.shift.findUnique({
      where: { id: data.shiftId },
      include: { schedule: true },
    });
    if (!shift) throw new AppError('Shift not found', 404);

    const user = await prisma.cachedUser.findUnique({
      where: { id: data.employeeId },
    });
    if (!user) throw new AppError('Employee not found', 404);

    const overlap = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId: data.employeeId,
        shift: {
          startTime: { lt: shift.endTime },
          endTime: { gt: shift.startTime },
        },
      },
      include: { shift: true },
    });

    if (overlap) {
      throw new AppError(
        `Employee is already assigned to another shift (${overlap.shift.startTime} - ${overlap.shift.endTime}) during this time`,
        409,
      );
    }

    const assignment = await prisma.shiftAssignment.create({ data });

    await publishShiftAssigned({
      id: assignment.id,
      shiftId: assignment.shiftId,
      employeeId: assignment.employeeId,
    });

    return assignment;
  }

  async unassignEmployee(shiftId: string, employeeId: string) {
    const shiftAssignment = await prisma.shiftAssignment.findUnique({
      where: { shiftId_employeeId: { shiftId, employeeId } },
    });
    if (!shiftAssignment) throw new AppError('Assignment not found', 404);

    await prisma.shiftAssignment.delete({
      where: { id: shiftAssignment.id },
    });

    await publishShiftUnassigned({
      shiftId,
      employeeId,
    });

    return { message: 'Employee unassigned successfully' };
  }

  async getAssignments(shiftId: string) {
    return prisma.shiftAssignment.findMany({
      where: { shiftId },
      include: { employee: true },
    });
  }
}

export default new AssignmentService();
