import AppError from '../utils/AppError';
import { AuthenticatedUser, shiftAssignmentInput } from '../types';
import {
  publishShiftAssigned,
  publishShiftUnassigned,
} from '../events/producer';
import prisma from '../prismaClient';
import {
  assertOrgWriteAccess,
  assertSameOrganization,
} from '../utils/accessControl';

export const assignEmployee = async (
  actor: AuthenticatedUser,
  data: shiftAssignmentInput,
) => {
  const shift = await prisma.shift.findUnique({
    where: { id: data.shiftId },
    include: { schedule: true },
  });
  if (!shift) throw new AppError('Shift not found', 404);

  assertOrgWriteAccess(
    actor,
    shift.schedule?.organizationId,
    'You can only manage shifts for your organization',
  );

  const user = await prisma.cachedUser.findUnique({
    where: { id: data.employeeId },
  });
  if (!user) throw new AppError('Employee not found', 404);

  if (user.organizationId !== shift.schedule?.organizationId) {
    throw new AppError(
      'Employee must belong to the same organization as the shift',
      400,
    );
  }

  const overlap = await prisma.shiftAssignment.findFirst({
    where: {
      employeeId: data.employeeId,
      shift: {
        // overlap condition:
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

  const assignment = await prisma.shiftAssignment.create({
    data: {
      ...data,
      assignedBy: actor.id,
    },
  });

  await publishShiftAssigned({
    id: assignment.id,
    shiftId: assignment.shiftId,
    employeeId: assignment.employeeId,
  });

  return assignment;
};

export const unsassignEmployee = async (
  actor: AuthenticatedUser,
  shiftId: string,
  employeeId: string,
) => {
  const shiftAssignment = await prisma.shiftAssignment.findUnique({
    where: { shiftId_employeeId: { shiftId, employeeId } },
    include: { shift: { include: { schedule: true } } },
  });
  if (!shiftAssignment) throw new AppError('Assignment not found', 404);

  assertOrgWriteAccess(
    actor,
    shiftAssignment.shift.schedule?.organizationId,
    'You can only manage shifts for your organization',
  );

  await prisma.shiftAssignment.delete({
    where: { id: shiftAssignment.id },
  });

  await publishShiftUnassigned({
    shiftId,
    employeeId,
  });

  return { message: 'Employee unassigned successfully' };
};

export const getAssignments = async (
  actor: AuthenticatedUser,
  shiftId: string,
) => {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { schedule: true },
  });
  if (!shift) {
    throw new AppError('Shift not found', 404);
  }

  assertSameOrganization(
    actor,
    shift.schedule?.organizationId,
    'You can only view shifts from your organization',
  );

  return prisma.shiftAssignment.findMany({
    where: { shiftId },
    include: { employee: true },
  });
};
