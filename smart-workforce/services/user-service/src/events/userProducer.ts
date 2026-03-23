// src/events/userProducer.ts
import { getChannel, EXCHANGE_NAME as USER_EXCHANGE } from './rabbit';
import prisma from '../prismaClient';

const ORG_EXCHANGE = 'organization';
const DEPT_EXCHANGE = 'department';

type UserProjectionSource = {
  id: string;
  authUserId?: string | null;
  email?: string | null;
  name?: string | null;
  systemRole?: string | null;
  isActive?: boolean;
  memberships?: Array<{
    organizationId: string;
    role: string;
  }>;
};

type InternalUserProjection = {
  id: string;
  authUserId: string | null;
  email: string;
  systemRole: string;
  isActive: boolean;
  organizationId: string | null;
  organizationRole: string | null;
};

const publish = async (exchange: string, routingKey: string, event: any) => {
  const channel = getChannel();
  if (!channel) throw new Error('RabbitMQ channel not initialized');

  // ensure exchange exists (idempotent)
  await channel.assertExchange(exchange, 'topic', { durable: true });

  channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)), {
    persistent: true,
    contentType: 'application/json',
  });

  console.log(
    `[User Service] Published ${event.type} to exchange='${exchange}' routing='${routingKey}'`,
    event,
  );
};

const getProjectionSource = async (
  user: UserProjectionSource,
): Promise<UserProjectionSource> => {
  if (
    user.email &&
    user.systemRole &&
    user.isActive !== undefined &&
    Array.isArray(user.memberships)
  ) {
    return user;
  }

  const persistedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      authUserId: true,
      email: true,
      name: true,
      systemRole: true,
      isActive: true,
      memberships: {
        select: {
          organizationId: true,
          role: true,
        },
        take: 1,
      },
    },
  });

  if (!persistedUser) {
    throw new Error(`User ${user.id} not found while building event payload`);
  }

  return persistedUser;
};

const toInternalUserProjection = async (
  user: UserProjectionSource,
): Promise<InternalUserProjection & { name?: string | null }> => {
  const source = await getProjectionSource(user);
  const membership = source.memberships?.[0];

  return {
    id: source.id,
    authUserId: source.authUserId ?? null,
    email: source.email ?? '',
    name: source.name ?? null,
    systemRole: source.systemRole ?? 'USER',
    isActive: source.isActive ?? true,
    organizationId: membership?.organizationId ?? null,
    organizationRole: membership?.role ?? null,
  };
};

/* -------------------------
   USER events (used by downstream cached-user consumers)
   ------------------------- */
export const publishUserCreated = async (user: any) => {
  const projection = await toInternalUserProjection(user);
  const event = {
    type: 'UserRegistered',
    data: projection,
    timestamp: new Date().toISOString(),
  };

  await publish(USER_EXCHANGE, 'user.created', event);
};

export const publishUserUpdated = async (user: any) => {
  const projection = await toInternalUserProjection(user);
  const event = {
    type: 'UserUpdated',
    data: projection,
    timestamp: new Date().toISOString(),
  };

  await publish(USER_EXCHANGE, 'user.updated', event);
};

export const publishUserDeleted = async (user: any) => {
  const projection = await toInternalUserProjection(user);
  const event = {
    type: 'UserDeleted',
    data: projection,
    timestamp: new Date().toISOString(),
  };

  await publish(USER_EXCHANGE, 'user.deleted', event);
};

/* -------------------------
   USER MEMBERSHIP events
   ------------------------- */
export const publishUserMembershipAdded = async (data: {
  userId: string;
  organizationId: string;
  role: string;
  user: {
    id: string;
    authUserId: string;
    email: string;
    name: string;
    systemRole: string;
  };
  organization: {
    id: string;
    name: string;
  };
}) => {
  const userProjection = await toInternalUserProjection(data.user);
  const event = {
    type: 'UserMembershipAdded',
    data: {
      ...data,
      user: userProjection,
      organizationId: userProjection.organizationId ?? data.organizationId,
      role: userProjection.organizationRole ?? data.role,
    },
    timestamp: new Date().toISOString(),
  };

  await publish(USER_EXCHANGE, 'user.membership.added', event);
};

export const publishUserMembershipUpdated = async (data: {
  userId: string;
  organizationId: string;
  role: string;
  user: {
    id: string;
    authUserId: string;
    email: string;
    name: string;
    systemRole: string;
  };
  organization: {
    id: string;
    name: string;
  };
}) => {
  const userProjection = await toInternalUserProjection(data.user);
  const event = {
    type: 'UserMembershipUpdated',
    data: {
      ...data,
      user: userProjection,
      organizationId: userProjection.organizationId ?? data.organizationId,
      role: userProjection.organizationRole ?? data.role,
    },
    timestamp: new Date().toISOString(),
  };

  await publish(USER_EXCHANGE, 'user.membership.updated', event);
};

export const publishUserMembershipRemoved = async (data: {
  userId: string;
  organizationId: string;
  user: {
    id: string;
    authUserId: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
  };
}) => {
  const userProjection = await toInternalUserProjection(data.user);
  const event = {
    type: 'UserMembershipRemoved',
    data: {
      ...data,
      user: {
        ...userProjection,
        organizationId: null,
        organizationRole: null,
      },
    },
    timestamp: new Date().toISOString(),
  };

  await publish(USER_EXCHANGE, 'user.membership.removed', event);
};

/* -------------------------
   ORGANIZATION events
   ------------------------- */
export const publishOrganizationCreated = async (org: {
  id: string;
  name: string;
}) => {
  const event = {
    type: 'OrganizationCreated',
    data: {
      id: org.id,
      name: org.name,
    },
    timestamp: new Date().toISOString(),
  };
  await publish(ORG_EXCHANGE, 'organization.created', event);
};

export const publishOrganizationUpdated = async (org: {
  id: string;
  name: string;
}) => {
  const event = {
    type: 'OrganizationUpdated',
    data: {
      id: org.id,
      name: org.name,
    },
    timestamp: new Date().toISOString(),
  };
  await publish(ORG_EXCHANGE, 'organization.updated', event);
};

export const publishOrganizationDeleted = async (orgId: string) => {
  const event = {
    type: 'OrganizationDeleted',
    data: { id: orgId },
    timestamp: new Date().toISOString(),
  };
  await publish(ORG_EXCHANGE, 'organization.deleted', event);
};

/* -------------------------
   DEPARTMENT events
   ------------------------- */
export const publishDepartmentCreated = async (dept: {
  id: string;
  organizationId: string;
  name: string;
}) => {
  const event = {
    type: 'DepartmentCreated',
    data: {
      id: dept.id,
      organizationId: dept.organizationId,
      name: dept.name,
    },
    timestamp: new Date().toISOString(),
  };
  await publish(DEPT_EXCHANGE, 'department.created', event);
};

export const publishDepartmentUpdated = async (dept: {
  id: string;
  organizationId: string;
  name: string;
}) => {
  const event = {
    type: 'DepartmentUpdated',
    data: {
      id: dept.id,
      organizationId: dept.organizationId,
      name: dept.name,
    },
    timestamp: new Date().toISOString(),
  };
  await publish(DEPT_EXCHANGE, 'department.updated', event);
};

export const publishDepartmentDeleted = async (deptId: string) => {
  const event = {
    type: 'DepartmentDeleted',
    data: { id: deptId },
    timestamp: new Date().toISOString(),
  };
  await publish(DEPT_EXCHANGE, 'department.deleted', event);
};
