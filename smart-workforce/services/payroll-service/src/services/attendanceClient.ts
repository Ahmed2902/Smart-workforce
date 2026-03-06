import axios, { AxiosError } from 'axios';

const ATTENDANCE_SERVICE_URL =
  process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:3004/api/attendance';

interface EmployeeHours {
  employeeId: string;
  period: string;
  totalHours: number;
  overtimeHours: number;
}

/**
 * Get employee's working hours for a specific period
 * @param employeeId - The ID of the employee
 * @param period - Period in YYYY-MM format
 */
export const getEmployeeHours = async (
  employeeId: string,
  period: string,
): Promise<EmployeeHours> => {
  try {
    const response = await axios.get(
      `${ATTENDANCE_SERVICE_URL}/hours/${employeeId}?period=${period}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.INTERNAL_TOKEN}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    // Some libraries (or environments) may wrap errors in AggregateError.
    // Unwrap to the first inner error so we can report a meaningful cause.
    let err: any = error;
    try {
      if (
        err &&
        typeof err === 'object' &&
        Array.isArray(err.errors) &&
        err.errors.length
      ) {
        err = err.errors[0];
      }
    } catch (e) {
      // ignore unwrap failures and continue with original error
    }

    // Use axios helper to detect axios errors robustly
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const respData = err.response?.data;
      const serverMessage =
        respData?.message ||
        (typeof respData === 'string' ? respData : undefined);
      const details =
        serverMessage || (respData ? JSON.stringify(respData) : err.message);
      const msg = `Failed to fetch employee hours${status ? `: HTTP ${status}` : ''} - ${details}`;
      console.error('[attendanceClient] axios error:', msg, {
        status,
        respData,
        stack: err.stack,
      });
      throw new Error(msg);
    }

    // Non-axios errors
    console.error('[attendanceClient] unexpected error (non-axios):', err);
    throw new Error(`Failed to fetch employee hours: ${String(err)}`);
  }
};
