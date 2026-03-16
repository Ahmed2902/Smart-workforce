import { getChannel, connectRabbit } from './rabbit';
import {
  handleShiftAssigned,
  handleShiftUnassigned,
} from '../services/eventSyncService';

const SCHEDULE_EXCHANGE = 'schedule';
const USER_EXCHANGE = 'user';

const SCHEDULE_QUEUE = 'attendance_schedule_events';
const USER_QUEUE = 'attendance_user_events';

const safeAck = (channel: any, msg: any) => {
  try {
    channel.ack(msg);
  } catch {
    console.warn('[Attendance Consumer] Ack failed');
  }
};

const safeNack = (channel: any, msg: any) => {
  try {
    channel.nack(msg, false, true);
  } catch {
    console.warn('[Attendance Consumer] Nack failed');
  }
};

export const consumeExternalEvents = async () => {
  let channel;
  try {
    channel = getChannel();
  } catch {
    console.warn('[Attendance Consumer] No channel, reconnecting...');
    await connectRabbit();
    channel = getChannel();
  }

  channel.prefetch?.(10);

  // ==================== SCHEDULE EVENTS ==================== //
  await channel.assertExchange(SCHEDULE_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(SCHEDULE_QUEUE, { durable: true });
  await channel.bindQueue(SCHEDULE_QUEUE, SCHEDULE_EXCHANGE, '#');

  console.log(`[Attendance Consumer] Listening for SCHEDULE events...`);

  channel.consume(SCHEDULE_QUEUE, async (msg: any) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const { type, data } = event;

      if (type === 'ShiftAssigned') {
        await handleShiftAssigned(data);
        console.log(
          `Attendance record prepared for employee ${data.employeeId}`,
        );
      }

      if (type === 'ShiftUnassigned') {
        await handleShiftUnassigned(data);
        console.log(`Attendance record removed for unassigned employee`);
      }

      safeAck(channel, msg);
    } catch (err) {
      console.error(
        '[Attendance Consumer] Failed to process schedule event:',
        err,
      );
      safeNack(channel, msg);
    }
  });

  // ==================== USER EVENTS ==================== //
  await channel.assertExchange(USER_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(USER_QUEUE, { durable: true });
  await channel.bindQueue(USER_QUEUE, USER_EXCHANGE, 'user.*');
};
