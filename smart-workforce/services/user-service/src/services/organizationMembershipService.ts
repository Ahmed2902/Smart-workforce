import prisma from '../prismaClient';
import * as producer from '../events/userProducer';
import { Role } from '@prisma/client';
import { deleteCache } from '@swma/shared';
import { requireOrgAdmin } from './authHelpers';

type Requester = { id: string; systemRole?: string };
type AuthOptions = { skipAuth?: boolean };

const ensureAuthorized = async (
  requester: Requester | null,
  organizationId: string,
  options?: AuthOptions,
) => {
  if (options?.skipAuth) return;
  if (!requester?.id) {
    throw new Error('Requester not found');
  }
  if (requester.systemRole === 'SUPERADMIN') return;
  await requireOrgAdmin(requester.id, organizationId);
};

export async function addUserToOrganization(
  requester: Requester | null,
  userId: string,
  organizationId: string,
  role: Role = 'EMPLOYEE',
  options?: AuthOptions,
) {
  await ensureAuthorized(requester, organizationId, options);
  // Check if organization exists
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!organization) {
    throw new Error('Organization not found');
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: true,
    },
  });
  if (!user) {
    throw new Error('User not found');
  }

  // Create or update membership (idempotent for events)
  const membership = await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    update: { role },
    create: { userId, organizationId, role },
    include: { user: true, organization: true },
  });

  // Invalidate org members cache
  await deleteCache([`user:org:${organizationId}:members:*`]);

  // Publish event
  await producer.publishUserMembershipAdded({
    userId,
    organizationId,
    role,
    user: {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      name: user.name,
      systemRole: user.systemRole,
    },
    organization: {
      id: organization.id,
      name: organization.name,
    },
  });

  return membership;
}

export async function updateMembershipRole(
  requester: Requester | null,
  userId: string,
  organizationId: string,
  role: Role,
  options?: AuthOptions,
) {
  await ensureAuthorized(requester, organizationId, options);
  const membership = await prisma.organizationMembership.update({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    data: { role },
    include: {
      user: true,
      organization: true,
    },
  });

  // Invalidate org members cache
  await deleteCache([`user:org:${organizationId}:members:*`]);

  await producer.publishUserMembershipUpdated({
    userId,
    organizationId,
    role,
    user: {
      id: membership.user.id,
      authUserId: membership.user.authUserId,
      email: membership.user.email,
      name: membership.user.name,
      systemRole: membership.user.systemRole,
    },
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
    },
  });

  return membership;
}

export async function removeUserFromOrganization(
  requester: Requester | null,
  userId: string,
  organizationId: string,
  options?: AuthOptions,
) {
  await ensureAuthorized(requester, organizationId, options);
  const membership = await prisma.organizationMembership.delete({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    include: {
      user: true,
      organization: true,
    },
  });

  // Invalidate org members cache
  await deleteCache([`user:org:${organizationId}:members:*`]);

  await producer.publishUserMembershipRemoved({
    userId,
    organizationId,
    user: {
      id: membership.user.id,
      authUserId: membership.user.authUserId,
      email: membership.user.email,
    },
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
    },
  });

  return membership;
}

export async function getUserMemberships(userId: string) {
  return prisma.organizationMembership.findMany({
    where: { userId },
    include: {
      organization: true,
    },
  });
}

export async function getOrganizationMembers(
  requester: Requester | null,
  organizationId: string,
  page = 1,
  limit = 10,
  options?: AuthOptions,
) {
  await ensureAuthorized(requester, organizationId, options);
  const skip = (page - 1) * limit;
  const cacheKey = `user:org:${organizationId}:members:page:${page}`;

  // For simplicity, skipping cache on getOrganizationMembers as it would require
  // invalidation logic for all pages when memberships change.
  // Alternative: Use pattern-based cache invalidation (deleteCache with wildcard)
  // This is already implemented above with `user:org:${organizationId}:members:*`

  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId },
    include: {
      user: true,
    },
    skip,
    take: limit,
  });

  const total = await prisma.organizationMembership.count({
    where: { organizationId },
  });

  return { memberships, total };
}
