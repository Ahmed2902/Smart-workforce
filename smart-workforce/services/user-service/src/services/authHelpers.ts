import prisma from '../prismaClient';

export type OrgMembership = {
  id: string;
  userId: string;
  organizationId: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
};

// Use dynamic access to avoid compile-time mismatches with generated prisma client types
const p: any = prisma;

export async function isSystemAdmin(userId: string): Promise<boolean> {
  const user = await p.user.findUnique({ where: { id: userId } });
  return !!user && user.systemRole === 'SUPERADMIN';
}

export async function getOrgMembership(
  userId: string,
  orgId: string,
): Promise<OrgMembership | null> {
  // unique index named userId_organizationId in schema
  const membership = await p.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
  });
  return membership as OrgMembership | null;
}

export async function requireOrgAdmin(userId: string, orgId: string) {
  if (await isSystemAdmin(userId)) return true;
  const membership = await getOrgMembership(userId, orgId);
  if (!membership) throw new Error('Organization membership not found');
  if (membership.role !== 'ADMIN')
    throw new Error('Only organization admins can perform this action');
  return true;
}
