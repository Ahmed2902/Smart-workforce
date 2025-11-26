import { getChannel, EXCHANGE_NAME } from './rabbit';

const SCHEDULE_CREATED = 'schedule.created';
const SCHEDULE_UPDATED = 'schedule.updated';
const SCHEDULE_DELETED = 'schedule.deleted';

const SHIFT_ASSIGNED = 'shift.assigned';
const SHIFT_UNASSIGNED = 'shift.unassigned';

export const publishScheduleCreated = async (schedule: any) => {
  const channel = getChannel();
  const event = {
    type: 'ScheduleCreated',
    data: schedule,
    timestamp: new Date().toISOString(),
  };
  channel.publish(
    EXCHANGE_NAME,
    SCHEDULE_CREATED,
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true,
      contentType: 'application/json',
    },
  );
  console.log(`📤 Schedule → published ${event.type}`, event);
};

export const publishScheduleUpdated = async (schedule: any) => {
  const channel = getChannel();
  const event = {
    type: 'ScheduleUpdated',
    data: schedule,
    timestamp: new Date().toISOString(),
  };
  channel.publish(
    EXCHANGE_NAME,
    SCHEDULE_UPDATED,
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true,
      contentType: 'application/json',
    },
  );
  console.log(`📤 Schedule → published ${event.type}`, event);
};

export const publishScheduleDeleted = async (id: string) => {
  const channel = getChannel();
  const event = {
    type: 'ScheduleDeleted',
    data: { id },
    timestamp: new Date().toISOString(),
  };
  channel.publish(
    EXCHANGE_NAME,
    SCHEDULE_DELETED,
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true,
      contentType: 'application/json',
    },
  );
  console.log(`📤 Schedule → published ${event.type}`, event);
};

export const publishShiftAssigned = async (assignment: any) => {
  const channel = getChannel();
  const event = {
    type: 'ShiftAssigned',
    data: assignment,
    timestamp: new Date().toISOString(),
  };
  channel.publish(
    EXCHANGE_NAME,
    SHIFT_ASSIGNED,
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true,
      contentType: 'application/json',
    },
  );
  console.log(`📤 Schedule → published ${event.type}`, event);
};

export const publishShiftUnassigned = async (assignment: any) => {
  const channel = getChannel();
  const event = {
    type: 'ShiftUnassigned',
    data: assignment,
    timestamp: new Date().toISOString(),
  };
  channel.publish(
    EXCHANGE_NAME,
    SHIFT_UNASSIGNED,
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true,
      contentType: 'application/json',
    },
  );
  console.log(`📤 Schedule → published ${event.type}`, event);
};
