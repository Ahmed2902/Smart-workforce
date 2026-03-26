import axios from 'axios';
import AppError from './appError';
import { getCache, setCache } from '@swma/shared';

const SCHEDULE_SERVICE_URL =
  process.env.SCHEDULE_SERVICE_URL || 'http://localhost:3003';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN;
if (!GATEWAY_TOKEN) {
  throw new Error('GATEWAY_TOKEN environment variable is required');
}

type ForwardedUser = {
  authUserId?: string;
  email: string;
};

const buildForwardedHeaders = (user: ForwardedUser) => {
  if (!user.authUserId) {
    throw new AppError('Authenticated user is missing authUserId', 500);
  }

  return {
    'X-Gateway-Token': GATEWAY_TOKEN,
    'X-User-Id': user.authUserId,
    'X-User-Email': user.email,
    'X-Auth-Sub': user.authUserId,
  };
};

export async function getShiftDetails(
  shiftId: string,
  user: ForwardedUser,
): Promise<ShiftDetails> {
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
          ...buildForwardedHeaders(user),
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
  user: ForwardedUser,
): Promise<boolean> {
  try {
    const shift = await getShiftDetails(shiftId, user);

    // Check for direct employeeId field (legacy format)
    if ((shift as any).employeeId) {
      return (shift as any).employeeId === employeeId;
    }

    // Check for assignments array (current format)
    if (shift.assignments && Array.isArray(shift.assignments)) {
      return shift.assignments.some((a) => a.employeeId === employeeId);
    }

    return false;
  } catch (error) {
    return false;
  }
}

export async function isLateForShiftForUser(
  shiftId: string,
  user: ForwardedUser,
  nowOverride?: Date,
): Promise<boolean> {
  try {
    const shift = await getShiftDetails(shiftId, user);
    const now = nowOverride ? new Date(nowOverride) : new Date();
    const shiftStart = new Date(shift.startDate);
    // Consider 15 minutes grace period
    const graceMinutes = 15;
    shiftStart.setMinutes(shiftStart.getMinutes() + graceMinutes);
    return now > shiftStart;
  } catch (error) {
    return false;
  }
}
