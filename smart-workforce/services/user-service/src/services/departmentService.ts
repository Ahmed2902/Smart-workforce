import prisma from '../prismaClient';
import authHelpers from './authHelpers';
import * as producer from '../events/userProducer';

type Requester = { id: string };

export class DepartmentService {
  async createDepartment(
    requester: Requester,
    data: { name: string; organizationId: string },
  ) {
    if (!(await authHelpers.isSystemAdmin(requester.id))) {
      await authHelpers.requireOrgAdmin(requester.id, data.organizationId);
    }

    const org = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });
    if (!org) throw new Error('Organization not found');

    const dept = await prisma.department.create({ data });
    await producer.publishDepartmentCreated(dept);

    return dept;
  }

  async getDepartments() {
    return prisma.department.findMany({ include: { organization: true } });
  }

  async updateDepartment(
    id: string,
    data: { name?: string; organizationId?: string },
    requester: Requester,
  ) {
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) throw new Error('Department not found');

    if (data.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: data.organizationId },
      });
      if (!org) throw new Error('Organization not found');
    }

    if (!(await authHelpers.isSystemAdmin(requester.id))) {
      await authHelpers.requireOrgAdmin(requester.id, dept.organizationId);
    }

    const updated = await prisma.department.update({ where: { id }, data });
    await producer.publishDepartmentUpdated(updated);

    return updated;
  }

  async deleteDepartment(id: string, requester: Requester) {
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) throw new Error('Department not found');

    if (!(await authHelpers.isSystemAdmin(requester.id))) {
      await authHelpers.requireOrgAdmin(requester.id, dept.organizationId);
    }

    const usersCount = await prisma.user.count({
      where: {
        Department: {
          some: { id },
        },
      },
    });

    if (usersCount > 0) {
      throw new Error('Cannot delete department with assigned users');
    }

    await prisma.department.delete({ where: { id } });
    await producer.publishDepartmentDeleted(dept.id);

    return dept;
  }
}

export default new DepartmentService();
