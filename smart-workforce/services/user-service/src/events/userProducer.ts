// src/events/userProducer.ts
import { getChannel, EXCHANGE_NAME as USER_EXCHANGE } from './rabbit';

const ORG_EXCHANGE = 'organization';
const DEPT_EXCHANGE = 'department';

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

/* -------------------------
   USER events (used by schedule-service)
   ------------------------- */
export const publishUserCreated = async (user: any) => {
  const event = {
    type: 'UserRegistered',
    data: {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      organizationId: user.organizationId ?? null,
      departmentId: user.departmentId ?? null,
      systemRole: user.systemRole ?? 'USER',
      isActive: user.isActive ?? true,
    },
    timestamp: new Date().toISOString(),
  };

  await publish(USER_EXCHANGE, 'user.created', event);
};

export const publishUserUpdated = async (user: any) => {
  const event = {
    type: 'UserUpdated',
    data: {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      organizationId: user.organizationId ?? null,
      departmentId: user.departmentId ?? null,
      systemRole: user.systemRole ?? 'USER',
      isActive: user.isActive ?? true,
    },
    timestamp: new Date().toISOString(),
  };

  await publish(USER_EXCHANGE, 'user.updated', event);
};

export const publishUserDeleted = async (user: any) => {
  const event = {
    type: 'UserDeleted',
    data: {
      id: user.id,
      authUserId: user.authUserId ?? null,
      email: user.email ?? null,
    },
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
  const event = {
    type: 'UserMembershipAdded',
    data,
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
  const event = {
    type: 'UserMembershipUpdated',
    data,
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
  const event = {
    type: 'UserMembershipRemoved',
    data,
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
