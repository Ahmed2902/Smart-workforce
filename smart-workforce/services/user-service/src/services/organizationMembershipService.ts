import prisma from '../prismaClient';
import * as producer from '../events/userProducer';
import { Role } from '@prisma/client';
import { deleteCache } from '@swma/shared';

export class OrganizationMembershipService {
  async addUserToOrganization(
    userId: string,
    organizationId: string,
    role: Role = 'EMPLOYEE',
  ) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new Error('Organization not found');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: true,
      },
    });
    if (!user) {
      throw new Error('User not found');
    }

    const membership = await prisma.organizationMembership.create({
      data: {
        userId,
        organizationId,
        role,
      },
      include: {
        user: true,
        organization: true,
      },
    });

    await deleteCache([`user:org:${organizationId}:members:*`]);

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

  async updateMembershipRole(userId: string, organizationId: string, role: Role) {
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

  async removeUserFromOrganization(userId: string, organizationId: string) {
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

  async getUserMemberships(userId: string) {
    return prisma.organizationMembership.findMany({
      where: { userId },
      include: {
        organization: true,
      },
    });
  }

  async getOrganizationMembers(organizationId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

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
}

export default new OrganizationMembershipService();
