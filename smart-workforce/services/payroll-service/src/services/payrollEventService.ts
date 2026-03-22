import prisma from '../prismaClient';
import { calculatePayroll } from './payrollService';

type UserEventData = {
  id?: string;
  isActive?: boolean;
};

type AttendanceEventData = {
  employeeId?: string;
  clockIn?: string | Date | null;
  clockOut?: string | Date | null;
  createdAt?: string | Date | null;
};

const toPeriod = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid attendance event timestamp');
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const derivePayrollPeriod = (data: AttendanceEventData) => {
  if (data.clockIn) return toPeriod(data.clockIn);
  if (data.clockOut) return toPeriod(data.clockOut);
  if (data.createdAt) return toPeriod(data.createdAt);
  throw new Error('Attendance event does not include a usable timestamp');
};

export async function syncEmployeeState(data: UserEventData) {
  if (!data.id || data.isActive === undefined) {
    throw new Error('User event missing employee id or isActive');
  }

  await prisma.employeeState.upsert({
    where: { employeeId: data.id },
    update: {
      isActive: data.isActive,
      deletedAt: data.isActive ? null : new Date(),
    },
    create: {
      employeeId: data.id,
      isActive: data.isActive,
      deletedAt: data.isActive ? null : new Date(),
    },
  });
}

export async function markEmployeeDeleted(data: UserEventData) {
  if (!data.id) {
    throw new Error('User delete event missing employee id');
  }

  await prisma.employeeState.upsert({
    where: { employeeId: data.id },
    update: {
      isActive: false,
      deletedAt: new Date(),
    },
    create: {
      employeeId: data.id,
      isActive: false,
      deletedAt: new Date(),
    },
  });
}

export async function handleAttendanceEvent(data: AttendanceEventData) {
  if (!data.employeeId) {
    throw new Error('Attendance event missing employeeId');
  }

  const period = derivePayrollPeriod(data);
  const payroll = await prisma.payroll.findUnique({
    where: {
      employeeId_period: {
        employeeId: data.employeeId,
        period,
      },
    },
    select: { id: true },
  });

  if (!payroll) {
    return null;
  }

  return calculatePayroll(data.employeeId, period, {
    skipEmployeeStateCheck: true,
  });
}
