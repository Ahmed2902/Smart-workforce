import axios from 'axios';
import AppError from './appError';
import { getCache, setCache } from '@swma/shared';

const SCHEDULE_SERVICE_URL =
  process.env.SCHEDULE_SERVICE_URL || 'http://localhost:3003';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN;
if (!GATEWAY_TOKEN) {
  throw new Error('GATEWAY_TOKEN environment variable is required');
}

const buildInternalHeaders = () => ({
  'X-Gateway-Token': GATEWAY_TOKEN,
  'X-User-Id': 'internal-service',
  'X-User-Email': 'internal@service.local',
  'X-User-Role': 'ADMIN',
  'X-Auth-Sub': 'internal-service',
});

export async function getShiftDetails(shiftId: string): Promise<ShiftDetails> {
  try {
    // Try to get from cache first (1 hour TTL)
    const cacheKey = `shift:${shiftId}`;
    const cachedShift = await getCache<ShiftDetails>(cacheKey);

    if (cachedShift) {
      console.log(`[CACHE HIT] Shift ${shiftId}`);
      return cachedShift;
    }

    console.log(`[CACHE MISS] Fetching shift ${shiftId} from schedule-service`);

    // Cache miss - fetch from API
    const response = await axios.get(
      `${SCHEDULE_SERVICE_URL}/api/schedules/shifts/${shiftId}`,
      {
        headers: {
          ...buildInternalHeaders(),
        },
      },
    );

    const shift = response.data.data;

    // Cache for 1 hour (3600 seconds)
    await setCache(cacheKey, shift, 3600);

    return shift;
  } catch (error: any) {
    console.error('Error fetching shift details:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    throw new AppError('Failed to fetch shift details', 500);
  }
}

export async function validateShiftForEmployee(
  shiftId: string,
  employeeId: string,
): Promise<boolean> {
  try {
    const shift = await getShiftDetails(shiftId);
    console.log('the shift.employee id', shift.employeeId);
    console.log('the employee id', employeeId);

    return true; //shift.employeeId === employeeId; //&& new Date(shift.startDate) <= new Date();
  } catch (error) {
    return false;
  }
}

export async function isLateForShift(shiftId: string): Promise<boolean> {
  try {
    const shift = await getShiftDetails(shiftId);
    const now = new Date();
    const shiftStart = new Date(shift.startDate);
    // Consider 15 minutes grace period
    const graceMinutes = 15;
    shiftStart.setMinutes(shiftStart.getMinutes() + graceMinutes);
    return now > shiftStart;
  } catch (error) {
    return false;
  }
}
