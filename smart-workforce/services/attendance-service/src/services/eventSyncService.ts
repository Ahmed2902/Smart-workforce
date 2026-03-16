import prisma from '../prismaClient';

export async function handleShiftAssigned(data: {
  employeeId?: string;
  shiftId?: string;
}) {
  if (!data?.employeeId || !data?.shiftId) {
    throw new Error('Missing employeeId or shiftId');
  }

  await prisma.attendance.create({
    data: {
      employeeId: data.employeeId,
      shiftId: data.shiftId,
    },
  });
}

export async function handleShiftUnassigned(data: {
  employeeId?: string;
  shiftId?: string;
}) {
  if (!data?.employeeId || !data?.shiftId) {
    throw new Error('Missing employeeId or shiftId');
  }

  await prisma.attendance.deleteMany({
    where: { shiftId: data.shiftId, employeeId: data.employeeId },
  });
}

