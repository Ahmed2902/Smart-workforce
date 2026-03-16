import prisma from '../prismaClient';
import * as producer from '../events/userProducer';
import * as membershipService from './organizationMembershipService';

type UserRegisteredEvent = {
  authUserId: string;
  email: string;
  role?: string;
  systemRole?: string;
  name?: string;
  phone?: string;
};

const DEFAULT_ORG_NAME = 'Default Organization';

const normalizeEmail = (email?: string) =>
  (email || '').trim().toLowerCase();

async function shouldBootstrapSuperadmin(email?: string) {
  const bootstrapEmail = normalizeEmail(process.env.BOOTSTRAP_SUPERADMIN_EMAIL);
  const allowFirst = process.env.ALLOW_BOOTSTRAP_SUPERADMIN === 'true';

  if (bootstrapEmail && normalizeEmail(email) === bootstrapEmail) {
    return true;
  }

  if (!allowFirst) return false;

  const existing = await prisma.user.findFirst({
    where: { systemRole: 'SUPERADMIN' },
    select: { id: true },
  });
  return !existing;
}

export async function handleUserRegistered(data: UserRegisteredEvent) {
  if (!data?.authUserId) {
    throw new Error('authUserId is required');
  }

  const bootstrapSuperadmin = await shouldBootstrapSuperadmin(data.email);
  const systemRole = bootstrapSuperadmin
    ? 'SUPERADMIN'
    : data.systemRole ?? 'USER';
  const role = bootstrapSuperadmin ? 'ADMIN' : data.role ?? 'EMPLOYEE';

  const user = await prisma.user.upsert({
    where: { authUserId: data.authUserId },
    update: {
      email: data.email,
      name: data.name ?? undefined,
      phone: data.phone ?? undefined,
      systemRole,
      role,
    },
    create: {
      authUserId: data.authUserId,
      email: data.email,
      name: data.name ?? 'New User',
      phone: data.phone ?? undefined,
      systemRole,
      role,
    },
  });

  let defaultOrg = await prisma.organization.findFirst({
    where: { name: DEFAULT_ORG_NAME },
  });

  if (!defaultOrg) {
    defaultOrg = await prisma.organization.create({
      data: {
        name: DEFAULT_ORG_NAME,
        description: 'Default organization for all users',
      },
    });
    await producer.publishOrganizationCreated(defaultOrg);
  }

  await membershipService.addUserToOrganization(
    null,
    user.id,
    defaultOrg.id,
    role as any,
    { skipAuth: true },
  );

  return { user, defaultOrg };
}

