import prisma from '../prismaClient';
import * as producer from '../events/userProducer';
import { getCache, setCache, deleteCache } from '@swma/shared/';

export class UserService {
  async getUsers(filter: any, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const users = await prisma.user.findMany({
      where: filter,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    const total = await prisma.user.count({ where: filter });
    return { users, total };
  }

  async getUserByAuthId(authUserId: string) {
    const cacheKey = `user:user:authId:${authUserId}`;
    let user = await getCache(cacheKey);
    if (!user) {
      user = await prisma.user.findFirst({
        where: { authUserId, isActive: true },
      });
      if (user) {
        await setCache(cacheKey, user, 600);
      }
    }
    return user;
  }

  async deleteUserByAuthId(authUserId: string) {
    const user = await prisma.user.update({
      where: { authUserId },
      data: { isActive: false },
    });
    await deleteCache([`user:user:authId:${authUserId}`]);
    await producer.publishUserDeleted(user);
  }

  async updateMe(authUserId: string, data: { name?: string; phone?: string }) {
    const updatedUser = await prisma.user.update({ where: { authUserId }, data });
    await deleteCache([`user:user:authId:${authUserId}`]);
    await producer.publishUserUpdated(updatedUser);
    return updatedUser;
  }

  async updateUserByAuthId(authUserId: string, data: any) {
    const user = await prisma.user.update({ where: { authUserId }, data });
    await deleteCache([`user:user:authId:${authUserId}`]);
    await producer.publishUserUpdated(user);
    return user;
  }

  async createUser(data: any) {
    const { organizationId, departmentId } = data;

    if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) throw new Error('Organization not found');
    }

    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!department) throw new Error('Department not found');
      if (organizationId && department.organizationId !== organizationId) {
        throw new Error('Department does not belong to the provided organization');
      }
      data.organizationId = data.organizationId || department.organizationId;
    }

    const user = await prisma.user.create({ data });
    await producer.publishUserCreated(user);
    return user;
  }
}

export default new UserService();
