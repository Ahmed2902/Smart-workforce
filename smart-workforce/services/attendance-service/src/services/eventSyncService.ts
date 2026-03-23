import { Role, SystemRole } from '@prisma/client';
import prisma from '../prismaClient';

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

type UserEventData = {
  id?: string;
  authUserId?: string | null;
  email?: string;
  systemRole?: SystemRole;
  isActive?: boolean;
  organizationId?: string | null;
  organizationRole?: Role | null;
};

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
    throw new Error('Missing user id or email for user event');
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
    throw new Error('Missing user id for delete');
  }

  await prisma.cachedUser.deleteMany({
    where: { id: data.id },
  });
}

