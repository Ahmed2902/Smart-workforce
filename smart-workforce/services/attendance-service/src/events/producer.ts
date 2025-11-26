import { getChannel, EXCHANGE_NAME } from './rabbit';

const ATTENDANCE_CREATED = 'attendance.created';
const ATTENDANCE_UPDATED = 'attendance.updated';
const ATTENDANCE_DELETED = 'attendance.deleted';
const ATTENDANCE_STATUS = 'attendance.status.changed'; // clock in/out

export const publishAttendanceCreated = async (attendance: any) => {
  const channel = getChannel();
  const event = {
    type: 'AttendanceCreated',
    data: attendance,
    timestamp: new Date().toISOString(),
  };
  channel.publish(
    EXCHANGE_NAME,
    ATTENDANCE_CREATED,
    Buffer.from(JSON.stringify(event)),
    { persistent: true, contentType: 'application/json' },
  );
  console.log(`📤 Attendance → published ${event.type}`, event);
};

export const publishAttendanceUpdated = async (attendance: any) => {
  const channel = getChannel();
  const event = {
    type: 'AttendanceUpdated',
    data: attendance,
    timestamp: new Date().toISOString(),
  };
  channel.publish(
    EXCHANGE_NAME,
    ATTENDANCE_UPDATED,
    Buffer.from(JSON.stringify(event)),
    { persistent: true, contentType: 'application/json' },
  );
  console.log(`📤 Attendance → published ${event.type}`, event);
};

export const publishAttendanceDeleted = async (id: string) => {
  const channel = getChannel();
  const event = {
    type: 'AttendanceDeleted',
    data: { id },
    timestamp: new Date().toISOString(),
  };
  channel.publish(
    EXCHANGE_NAME,
    ATTENDANCE_DELETED,
    Buffer.from(JSON.stringify(event)),
    { persistent: true, contentType: 'application/json' },
  );
  console.log(`📤 Attendance → published ${event.type}`, event);
};

export const publishAttendanceStatusChanged = async (payload: any) => {
  const channel = getChannel();
  const event = {
    type: 'AttendanceStatusChanged',
    data: payload, // { employeeId, shiftId, status: 'CLOCKED_IN' | 'CLOCKED_OUT' }
    timestamp: new Date().toISOString(),
  };
  channel.publish(
    EXCHANGE_NAME,
    ATTENDANCE_STATUS,
    Buffer.from(JSON.stringify(event)),
    { persistent: true, contentType: 'application/json' },
  );
  console.log(`📤 Attendance → published ${event.type}`, event);
};
