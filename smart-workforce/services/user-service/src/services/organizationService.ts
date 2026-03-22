import prisma from '../prismaClient';
import * as producer from '../events/userProducer';
import * as membershipService from './organizationMembershipService';

type Requester = { id: string; systemRole?: string };

export async function createOrganization(
  data: {
    name: string;
    description?: string;
  },
  requester?: Requester,
) {
  const org = await prisma.organization.create({ data });

  // Automatically add the creator as an ADMIN if requester is provided
  if (requester?.id) {
    try {
      await membershipService.addUserToOrganization(
        requester,
        requester.id,
        org.id,
        'ADMIN',
        { skipAuth: true }, // Skip auth check since creator should be able to add themselves
      );
    } catch (err) {
      // Log the error but don't fail organization creation
      console.error('Failed to add creator as organization admin:', err);
    }
  }

  await producer.publishOrganizationCreated(org);
  return org;
}

export async function getOrganizations() {
  return prisma.organization.findMany({ include: { departments: true } });
}

export async function updateOrganization(
  id: string,
  data: { name?: string; description?: string },
) {
  const org = await prisma.organization.update({ where: { id }, data });
  await producer.publishOrganizationUpdated(org);
  return org;
}

export async function deleteOrganization(id: string) {
  const depsCount = await prisma.department.count({
    where: { organizationId: id },
  });
  if (depsCount > 0)
    throw new Error('Cannot delete organization with departments/users linked');
  await prisma.organization.delete({ where: { id } });
  await producer.publishOrganizationDeleted(id);
}
