import prisma from '../prismaClient';
import * as producer from '../events/userProducer';

export async function createOrganization(data: {
  name: string;
  description?: string;
}) {
  const org = await prisma.organization.create({ data });
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
