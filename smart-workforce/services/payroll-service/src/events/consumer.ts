import { getChannel, connectRabbit } from './rabbit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SCHEDULE_EXCHANGE = 'schedule';
const USER_EXCHANGE = 'user';
const ATTENDANCE_EXCHANGE = 'attendance';

const SCHEDULE_QUEUE = 'payroll_schedule_events';
const USER_QUEUE = 'payroll_user_events';
const ATTENDANCE_QUEUE = 'payroll_attendance_events';
