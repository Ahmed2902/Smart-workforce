import prisma from '../prismaClient';
import { isSystemAdmin, requireOrgAdmin } from './authHelpers';
import * as producer from '../events/userProducer'; // producers for org/department/user

type Requester = { id: string };

export async function createDepartment(
  requester: Requester,
  data: { name: string; organizationId: string },
) {
  // SUPERADMIN can create anywhere
  if (!(await isSystemAdmin(requester.id))) {
    // Must be org admin
    await requireOrgAdmin(requester.id, data.organizationId);
  }

  // Ensure org exists
  const org = await prisma.organization.findUnique({
    where: { id: data.organizationId },
  });
  if (!org) throw new Error('Organization not found');

  const dept = await prisma.department.create({ data });

  // 🔔 publish event
  await producer.publishDepartmentCreated(dept);

  return dept;
}

export async function getDepartments() {
  return prisma.department.findMany({ include: { organization: true } });
}

export async function updateDepartment(
  id: string,
  data: { name?: string; organizationId?: string },
  requester: Requester,
) {
  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) throw new Error('Department not found');

  // If org is changing, validate new org exists
  if (data.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });
    if (!org) throw new Error('Organization not found');
  }

  // Authorization
  if (!(await isSystemAdmin(requester.id))) {
    await requireOrgAdmin(requester.id, dept.organizationId);
  }

  const updated = await prisma.department.update({ where: { id }, data });

  // 🔔 publish event
  await producer.publishDepartmentUpdated(updated);

  return updated;
}

export async function deleteDepartment(id: string, requester: Requester) {
  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) throw new Error('Department not found');

  // Authorization
  if (!(await isSystemAdmin(requester.id))) {
    await requireOrgAdmin(requester.id, dept.organizationId);
  }

  // Prevent delete if users still assigned
  const usersCount = await await prisma.user.count({
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

  // 🔔 publish event
  await producer.publishDepartmentDeleted(dept.id);

  return dept;
}
