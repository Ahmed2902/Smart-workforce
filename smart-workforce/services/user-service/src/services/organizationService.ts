import prisma from '../prismaClient';
import * as producer from '../events/userProducer';

export class OrganizationService {
  async createOrganization(data: { name: string; description?: string }) {
    const org = await prisma.organization.create({ data });
    await producer.publishOrganizationCreated(org);
    return org;
  }

  async getOrganizations() {
    return prisma.organization.findMany({ include: { departments: true } });
  }

  async updateOrganization(
    id: string,
    data: { name?: string; description?: string },
  ) {
    const org = await prisma.organization.update({ where: { id }, data });
    await producer.publishOrganizationUpdated(org);
    return org;
  }

  async deleteOrganization(id: string) {
    const depsCount = await prisma.department.count({
      where: { organizationId: id },
    });
    if (depsCount > 0) {
      throw new Error('Cannot delete organization with departments/users linked');
    }
    await prisma.organization.delete({ where: { id } });
    await producer.publishOrganizationDeleted(id);
  }
}

export default new OrganizationService();
