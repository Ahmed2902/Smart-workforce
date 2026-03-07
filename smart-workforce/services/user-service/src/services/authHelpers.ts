import prisma from '../prismaClient';

export type OrgMembership = {
  id: string;
  userId: string;
  organizationId: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
};

const p: any = prisma;

export class AuthHelpersService {
  async isSystemAdmin(userId: string): Promise<boolean> {
    const user = await p.user.findUnique({ where: { id: userId } });
    return !!user && user.systemRole === 'SUPERADMIN';
  }

  async getOrgMembership(
    userId: string,
    orgId: string,
  ): Promise<OrgMembership | null> {
    const membership = await p.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    return membership as OrgMembership | null;
  }

  async requireOrgAdmin(userId: string, orgId: string) {
    if (await this.isSystemAdmin(userId)) return true;
    const membership = await this.getOrgMembership(userId, orgId);
    if (!membership) throw new Error('Organization membership not found');
    if (membership.role !== 'ADMIN') {
      throw new Error('Only organization admins can perform this action');
    }
    return true;
  }
}

export default new AuthHelpersService();
