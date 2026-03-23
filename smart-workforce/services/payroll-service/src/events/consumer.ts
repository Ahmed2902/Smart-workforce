import { getChannel, connectRabbit } from './rabbit';
import {
  handleAttendanceEvent,
  syncMembershipRemoval,
  syncMembershipUpsert,
  syncUserDelete,
  syncUserUpsert,
} from '../services/payrollEventService';

const USER_EXCHANGE = 'user';
const ATTENDANCE_EXCHANGE = 'attendance';

const USER_QUEUE = 'payroll_user_events';
const ATTENDANCE_QUEUE = 'payroll_attendance_events';

const safeAck = (channel: any, msg: any) => {
  try {
    channel.ack(msg);
  } catch {
    console.warn('[Payroll Consumer] Ack failed');
  }
};

const safeNack = (channel: any, msg: any) => {
  try {
    channel.nack(msg, false, true);
  } catch {
    console.warn('[Payroll Consumer] Nack failed');
  }
};

export const consumeExternalEvents = async () => {
  let channel;
  try {
    channel = getChannel();
  } catch {
    console.warn('[Payroll Consumer] No channel, reconnecting...');
    await connectRabbit();
    channel = getChannel();
  }

  channel.prefetch?.(10);

  await channel.assertExchange(USER_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(USER_QUEUE, { durable: true });
  await channel.bindQueue(USER_QUEUE, USER_EXCHANGE, 'user.*');
  await channel.bindQueue(USER_QUEUE, USER_EXCHANGE, 'user.membership.*');

  channel.consume(USER_QUEUE, async (msg: any) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      const data = event.data || {};

      if (
        event.type === 'UserMembershipAdded' ||
        event.type === 'UserMembershipUpdated'
      ) {
        await syncMembershipUpsert(data);
      } else if (event.type === 'UserMembershipRemoved') {
        await syncMembershipRemoval(data);
      } else if (event.type === 'UserRegistered' || event.type === 'UserUpdated') {
        await syncUserUpsert(data);
      } else if (event.type === 'UserDeleted') {
        await syncUserDelete(data);
      }

      safeAck(channel, msg);
    } catch (err) {
      console.error('[Payroll Consumer] Failed to process user event:', err);
      if (
        String((err as Error)?.message || '').includes('missing') ||
        String((err as Error)?.message || '').includes('Missing')
      ) {
        safeAck(channel, msg);
        return;
      }
      safeNack(channel, msg);
    }
  });

  await channel.assertExchange(ATTENDANCE_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(ATTENDANCE_QUEUE, { durable: true });
  await channel.bindQueue(ATTENDANCE_QUEUE, ATTENDANCE_EXCHANGE, 'attendance.created');
  await channel.bindQueue(ATTENDANCE_QUEUE, ATTENDANCE_EXCHANGE, 'attendance.updated');
  await channel.bindQueue(ATTENDANCE_QUEUE, ATTENDANCE_EXCHANGE, 'attendance.deleted');
  await channel.bindQueue(
    ATTENDANCE_QUEUE,
    ATTENDANCE_EXCHANGE,
    'attendance.status.changed',
  );

  channel.consume(ATTENDANCE_QUEUE, async (msg: any) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      const type = event.type;
      if (
        ![
          'AttendanceCreated',
          'AttendanceUpdated',
          'AttendanceDeleted',
          'AttendanceStatusChanged',
        ].includes(type)
      ) {
        safeAck(channel, msg);
        return;
      }

      await handleAttendanceEvent(event.data || {});
      safeAck(channel, msg);
    } catch (err) {
      console.error(
        '[Payroll Consumer] Failed to process attendance event:',
        err,
      );
      if (
        String((err as Error)?.message || '').includes('missing') ||
        String((err as Error)?.message || '').includes('Missing') ||
        String((err as Error)?.message || '').includes('usable timestamp')
      ) {
        safeAck(channel, msg);
        return;
      }
      safeNack(channel, msg);
    }
  });
};
