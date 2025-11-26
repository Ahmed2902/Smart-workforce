import { getChannel, connectRabbit } from './rabbit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Exchanges
const USER_EXCHANGE = 'user';
const ORG_EXCHANGE = 'organization';
const DEPT_EXCHANGE = 'department';

// Queues
const USER_QUEUE = 'schedule_user_events';
const ORG_QUEUE = 'schedule_org_events';
const DEPT_QUEUE = 'schedule_dept_events';

const safeAck = (channel: any, msg: any) => {
  try {
    channel.ack(msg);
  } catch (e) {
    console.warn('[Schedule Consumer] Ack failed (channel likely closed)');
  }
};

const safeNack = (channel: any, msg: any) => {
  try {
    channel.nack(msg, false, true);
  } catch (e) {
    console.warn('[Schedule Consumer] Nack failed (channel likely closed)');
  }
};

export const consumeExternalEvents = async () => {
  let channel;
  try {
    channel = getChannel();
  } catch {
    console.warn('[Schedule Consumer] No channel, reconnecting...');
    await connectRabbit();
    channel = getChannel();
  }

  channel.prefetch?.(10);

  // ==================== USER EVENTS ==================== //
  await channel.assertExchange(USER_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(USER_QUEUE, { durable: true });
  await channel.bindQueue(USER_QUEUE, USER_EXCHANGE, 'user.*');
  await channel.bindQueue(USER_QUEUE, USER_EXCHANGE, 'user.membership.*');

  console.log(`[Schedule Consumer] Listening for USER events...`);

  channel.consume(USER_QUEUE, async (msg: any) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      console.log('[Schedule Consumer] Received user event:', {
        type: event.type,
        data: event.data,
      });

      const type = event.type;
      const data = event.data || {};

      if (type === 'UserMembershipAdded' || type === 'UserMembershipUpdated') {
        const { user, organization, role } = data;
        if (!user?.id || !user?.email || !organization?.id) {
          console.warn(
            '[Schedule Consumer] Missing user/org fields in membership event',
          );
          safeAck(channel, msg);
          return;
        }

        await prisma.cachedUser.upsert({
          where: { id: user.id },
          update: {
            email: user.email,
            name: user.name,
            role: role,
            organizationId: organization.id,
          },
          create: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: role,
            organizationId: organization.id,
          },
        });
        console.log(`✅ CachedUser ${user.email} synced (membership).`);
      } else if (type === 'UserMembershipRemoved') {
        const { user } = data;
        if (!user?.id) {
          console.warn(
            '[Schedule Consumer] Missing user id in membership removal',
          );
          safeAck(channel, msg);
          return;
        }

        await prisma.cachedUser.updateMany({
          where: { id: user.id },
          data: { organizationId: 'unassigned', departmentId: null },
        });

        console.log(
          `✅ CachedUser ${user.email} organization membership removed.`,
        );
      } else if (type === 'UserRegistered' || type === 'UserUpdated') {
        const id = data.id ?? data.authUserId;
        const name = data.name ?? 'New User';
        const email = data.email;
        const role = data.systemRole ?? data.role ?? 'EMPLOYEE';

        if (!id || !email) {
          console.warn(
            '[Schedule Consumer] Missing fields for UserRegistered:',
            { id, email },
          );
          safeAck(channel, msg);
          return;
        }

        // If no organization info exists, just create the user directly
        await prisma.cachedUser.upsert({
          where: { id },
          update: { email, name, role },
          create: { id, email, name, role, organizationId: 'unassigned' },
        });

        console.log(
          `✅ CachedUser ${email} created/updated (no org membership).`,
        );
      } else if (type === 'UserDeleted') {
        const id = data.id ?? data.authUserId;
        await prisma.cachedUser.deleteMany({ where: { id } });
        console.log(`🗑️ CachedUser ${id} deleted.`);
      }

      safeAck(channel, msg);
    } catch (err) {
      console.error(
        '[Schedule Consumer] ❌ Failed to process user event:',
        err,
      );
      safeNack(channel, msg);
    }
  });

  // ==================== ORG EVENTS ==================== //
  await channel.assertExchange(ORG_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(ORG_QUEUE, { durable: true });
  await channel.bindQueue(ORG_QUEUE, ORG_EXCHANGE, 'organization.*');

  channel.consume(ORG_QUEUE, async (msg: any) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const data = event.data;

      if (['OrganizationCreated', 'OrganizationUpdated'].includes(event.type)) {
        await prisma.cachedOrganization.upsert({
          where: { id: data.id },
          update: { name: data.name },
          create: { id: data.id, name: data.name },
        });
        console.log(`✅ CachedOrganization ${data.name} synced`);
      }

      if (event.type === 'OrganizationDeleted') {
        await prisma.cachedOrganization.deleteMany({ where: { id: data.id } });
        console.log(`🗑️ CachedOrganization ${data.id} deleted`);
      }

      safeAck(channel, msg);
    } catch (err) {
      console.error('[Schedule Consumer] ❌ Failed to process org event:', err);
      safeNack(channel, msg);
    }
  });

  // ==================== DEPT EVENTS ==================== //
  await channel.assertExchange(DEPT_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(DEPT_QUEUE, { durable: true });
  await channel.bindQueue(DEPT_QUEUE, DEPT_EXCHANGE, 'department.*');

  channel.consume(DEPT_QUEUE, async (msg: any) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const data = event.data;

      if (['DepartmentCreated', 'DepartmentUpdated'].includes(event.type)) {
        await prisma.cachedDepartment.upsert({
          where: { id: data.id },
          update: {
            name: data.name,
            organizationId: data.organizationId,
          },
          create: {
            id: data.id,
            name: data.name,
            organizationId: data.organizationId,
          },
        });
        console.log(`✅ CachedDepartment ${data.name} synced`);
      }

      if (event.type === 'DepartmentDeleted') {
        await prisma.cachedDepartment.deleteMany({ where: { id: data.id } });
        console.log(`🗑️ CachedDepartment ${data.id} deleted`);
      }

      safeAck(channel, msg);
    } catch (err) {
      console.error(
        '[Schedule Consumer] ❌ Failed to process dept event:',
        err,
      );
      safeNack(channel, msg);
    }
  });
};
