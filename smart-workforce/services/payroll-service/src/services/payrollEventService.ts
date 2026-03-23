import { Role, SystemRole } from '@prisma/client';
import prisma from '../prismaClient';
import { calculatePayroll } from './payrollService';

type UserEventData = {
  id?: string;
  authUserId?: string | null;
  email?: string;
  systemRole?: SystemRole;
  isActive?: boolean;
  organizationId?: string | null;
  organizationRole?: Role | null;
};

type MembershipEventData = {
  user?: {
    id?: string;
    authUserId?: string | null;
    email?: string;
    systemRole?: SystemRole;
    isActive?: boolean;
    organizationId?: string | null;
    organizationRole?: Role | null;
  };
  organization?: { id?: string };
  role?: Role;
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

export async function syncMembershipUpsert(data: MembershipEventData) {
  const userId = data.user?.id;
  const email = data.user?.email;
  const organizationId = data.user?.organizationId ?? data.organization?.id;
  const organizationRole =
    data.user?.organizationRole ?? data.role ?? 'EMPLOYEE';

  if (!userId || !email || !organizationId) {
    throw new Error('Missing user/org fields in membership event');
  }

  await prisma.cachedUser.upsert({
    where: { id: userId },
    update: {
      authUserId: data.user?.authUserId ?? null,
      email,
      systemRole: data.user?.systemRole ?? 'USER',
      organizationId,
      organizationRole,
      isActive: data.user?.isActive ?? true,
    },
    create: {
      id: userId,
      authUserId: data.user?.authUserId ?? null,
      email,
      systemRole: data.user?.systemRole ?? 'USER',
      organizationId,
      organizationRole,
      isActive: data.user?.isActive ?? true,
    },
  });
}

export async function syncMembershipRemoval(data: MembershipEventData) {
  const userId = data.user?.id;
  if (!userId) {
    throw new Error('Missing user id in membership removal');
  }

  await prisma.cachedUser.updateMany({
    where: { id: userId },
    data: {
      organizationId: null,
      organizationRole: null,
    },
  });
}

export async function syncUserUpsert(data: UserEventData) {
  if (!data.id || !data.email) {
    throw new Error('User event missing employee id or email');
  }

  await prisma.cachedUser.upsert({
    where: { id: data.id },
    update: {
      authUserId: data.authUserId ?? null,
      email: data.email,
      systemRole: data.systemRole ?? 'USER',
      isActive: data.isActive ?? true,
    },
    create: {
      id: data.id,
      authUserId: data.authUserId ?? null,
      email: data.email,
      systemRole: data.systemRole ?? 'USER',
      organizationId: data.organizationId ?? null,
      organizationRole: data.organizationRole ?? null,
      isActive: data.isActive ?? true,
    },
  });
}

export async function syncUserDelete(data: UserEventData) {
  if (!data.id) {
    throw new Error('User delete event missing employee id');
  }

  await prisma.cachedUser.deleteMany({
    where: { id: data.id },
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
