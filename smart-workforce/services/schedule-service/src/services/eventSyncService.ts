import prisma from '../prismaClient';

type MembershipEventData = {
  user?: { id?: string; authUserId?: string; email?: string; name?: string };
  organization?: { id?: string };
  role?: string;
};

type UserEventData = {
  id?: string;
  authUserId?: string;
  email?: string;
  name?: string;
  systemRole?: string;
  role?: string;
};

export async function syncMembershipUpsert(data: MembershipEventData) {
  const { user, organization, role } = data;
  const userId = user?.id;
  if (!userId || !user?.email || !organization?.id) {
    throw new Error('Missing user/org fields in membership event');
  }

  await prisma.cachedUser.upsert({
    where: { id: userId },
    update: {
      email: user.email,
      name: user.name,
      role: role,
      organizationId: organization.id,
    },
    create: {
      id: userId,
      email: user.email,
      name: user.name,
      role: role,
      organizationId: organization.id,
    },
  });
}

export async function syncMembershipRemoval(data: MembershipEventData) {
  const { user } = data;
  const userId = user?.id;
  if (!userId) {
    throw new Error('Missing user id in membership removal');
  }

  await prisma.cachedUser.updateMany({
    where: { id: userId },
    data: { organizationId: 'unassigned', departmentId: null },
  });
}

export async function syncUserUpsert(data: UserEventData) {
  const id = data.id;
  const name = data.name ?? 'New User';
  const email = data.email;
  const role = data.systemRole ?? data.role ?? 'EMPLOYEE';

  if (!id || !email) {
    throw new Error('Missing user id or email for user event');
  }

  await prisma.cachedUser.upsert({
    where: { id },
    update: { email, name, role },
    create: { id, email, name, role, organizationId: 'unassigned' },
  });
}

export async function syncUserDelete(data: UserEventData) {
  const id = data.id;
  if (!id) throw new Error('Missing user id for delete');
  await prisma.cachedUser.deleteMany({ where: { id } });
}

export async function syncOrganizationUpsert(data: { id?: string; name?: string }) {
  if (!data?.id || !data?.name) {
    throw new Error('Missing organization fields');
  }
  await prisma.cachedOrganization.upsert({
    where: { id: data.id },
    update: { name: data.name },
    create: { id: data.id, name: data.name },
  });
}

export async function syncOrganizationDelete(data: { id?: string }) {
  if (!data?.id) throw new Error('Missing organization id');
  await prisma.cachedOrganization.deleteMany({ where: { id: data.id } });
}

export async function syncDepartmentUpsert(data: {
  id?: string;
  name?: string;
  organizationId?: string;
}) {
  if (!data?.id || !data?.name || !data?.organizationId) {
    throw new Error('Missing department fields');
  }
  await prisma.cachedDepartment.upsert({
    where: { id: data.id },
    update: {
      name: data.name,
      organizationId: data.organizationId,
    },
    create: {
      id: data.id,
      name: data.name,
      organizationId: data.organizationId,
    },
  });
}

export async function syncDepartmentDelete(data: { id?: string }) {
  if (!data?.id) throw new Error('Missing department id');
  await prisma.cachedDepartment.deleteMany({ where: { id: data.id } });
}
