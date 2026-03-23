import { getChannel, connectRabbit } from './rabbit';
import {
  syncDepartmentDelete,
  syncDepartmentUpsert,
  syncMembershipRemoval,
  syncMembershipUpsert,
  syncOrganizationDelete,
  syncOrganizationUpsert,
  syncUserDelete,
  syncUserUpsert,
} from '../services/eventSyncService';

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
        try {
          await syncMembershipUpsert(data);
          console.log('CachedUser synced (membership).');
        } catch (err) {
          console.warn(
            '[Schedule Consumer] Missing user/org fields in membership event',
          );
          safeAck(channel, msg);
          return;
        }
      } else if (type === 'UserMembershipRemoved') {
        try {
          await syncMembershipRemoval(data);
          console.log('CachedUser membership removed.');
        } catch (err) {
          console.warn(
            '[Schedule Consumer] Missing user id in membership removal',
          );
          safeAck(channel, msg);
          return;
        }
      } else if (type === 'UserRegistered' || type === 'UserUpdated') {
        try {
          await syncUserUpsert(data);
          console.log('CachedUser created/updated (no org membership).');
        } catch (err) {
          console.warn('[Schedule Consumer] Missing fields for UserRegistered', {
            id: data.id ?? data.authUserId,
            email: data.email,
          });
          safeAck(channel, msg);
          return;
        }
      } else if (type === 'UserDeleted') {
        try {
          await syncUserDelete(data);
          console.log('CachedUser deleted.');
        } catch (err) {
          safeAck(channel, msg);
          return;
        }
      }

      safeAck(channel, msg);
    } catch (err) {
      console.error('[Schedule Consumer] Failed to process user event:', err);
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
        await syncOrganizationUpsert(data);
        console.log(`CachedOrganization ${data.name} synced`);
      }

      if (event.type === 'OrganizationDeleted') {
        await syncOrganizationDelete(data);
        console.log(`CachedOrganization ${data.id} deleted`);
      }

      safeAck(channel, msg);
    } catch (err) {
      console.error('[Schedule Consumer] Failed to process org event:', err);
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
        await syncDepartmentUpsert(data);
        console.log(`CachedDepartment ${data.name} synced`);
      }

      if (event.type === 'DepartmentDeleted') {
        await syncDepartmentDelete(data);
        console.log(`CachedDepartment ${data.id} deleted`);
      }

      safeAck(channel, msg);
    } catch (err) {
      console.error('[Schedule Consumer] Failed to process dept event:', err);
      safeNack(channel, msg);
    }
  });
};
