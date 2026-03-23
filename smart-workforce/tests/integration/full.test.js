/* eslint-env node, jest */
const http = require('http');
const https = require('https');

const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:8080';
const TIMEOUT_MS = 60000;

function request({ method, path, headers, body }) {
  const url = new URL(path, BASE_URL);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  const options = {
    method,
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    headers: headers || {},
  };

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', (err) => {
      reject(
        new Error(
          `Failed to reach gateway at ${BASE_URL}${path}: ${err.message}`,
        ),
      );
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function json(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(fn, { attempts = 15, delayMs = 1000, label = 'retry' }) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts) break;
      await sleep(delayMs);
    }
  }
  const msg = lastErr && lastErr.message ? lastErr.message : String(lastErr);
  throw new Error(`${label} failed after ${attempts} attempts: ${msg}`);
}

describe('Full integration flow', () => {
  jest.setTimeout(TIMEOUT_MS);

  const adminEmail = process.env.INTEGRATION_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.INTEGRATION_ADMIN_PASSWORD || 'Password1!';
  const employeeEmail =
    process.env.INTEGRATION_EMPLOYEE_EMAIL ||
    'employee.integration@example.com';
  const employeePassword =
    process.env.INTEGRATION_EMPLOYEE_PASSWORD || 'Password1!';

  let adminToken;
  let employeeToken;
  let adminUserId;
  let employeeUserId;
  let employeeAuthUserId;
  let orgId;
  let deptId;
  let scheduleId;
  let shiftId;

  const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

  const registerIfNeeded = async (email, password) => {
    const res = await request({
      method: 'POST',
      path: '/api/auth/register',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: 'Integration User',
        phone: '1234567890',
      }),
    });

    if (res.status === 201) return;

    const payload = json(res.body) || {};
    if (
      res.status === 400 &&
      String(payload?.message || '').includes('exists')
    ) {
      return;
    }
    if (res.status === 429) {
      throw new Error(`RATE_LIMITED ${res.body}`);
    }

    throw new Error(`Register failed: ${res.status} ${res.body}`);
  };

  const login = async (email, password) => {
    const res = await request({
      method: 'POST',
      path: '/api/auth/login',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status !== 200) {
      throw new Error(`Login failed: ${res.status} ${res.body}`);
    }
    const payload = json(res.body) || {};
    return { token: payload.token, authUser: payload.authUser };
  };

  const ensureUser = async (email, password) => {
    try {
      return await login(email, password);
    } catch (error) {
      if (!String(error.message || '').includes('Login failed: 401')) {
        throw error;
      }
    }

    await retry(
      async () => {
        try {
          await registerIfNeeded(email, password);
        } catch (error) {
          if (String(error.message || '').includes('RATE_LIMITED')) {
            throw error;
          }
          if (
            String(error.message || '').includes('exists') ||
            String(error.message || '').includes('Register failed: 400')
          ) {
            return true;
          }
          throw error;
        }
        return true;
      },
      { attempts: 5, delayMs: 2000, label: `register user ${email}` },
    );

    return retry(() => login(email, password), {
      attempts: 10,
      delayMs: 1500,
      label: `login user ${email}`,
    });
  };

  beforeAll(async () => {
    const adminLogin = await ensureUser(adminEmail, adminPassword);
    adminToken = adminLogin.token;

    const employeeLogin = await ensureUser(employeeEmail, employeePassword);
    employeeToken = employeeLogin.token;

    if (!adminToken) {
      throw new Error('Admin login did not return token');
    }

    const usersPayload = await retry(
      async () => {
        const res = await request({
          method: 'GET',
          path: '/api/users/me?limit=50',
          headers: authHeaders(),
        });
        if (res.status !== 200) {
          throw new Error(`Users list not ready: ${res.status}`);
        }
        const payload = json(res.body);
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Users list response malformed');
        }
        return payload;
      },
      { attempts: 20, delayMs: 1500, label: 'wait for user-service sync' },
    );

    const adminUser = usersPayload.data.find((u) => u.email === adminEmail);
    const employeeUser = usersPayload.data.find(
      (u) => u.email === employeeEmail,
    );
    if (!adminUser?.id || !employeeUser?.id || !employeeUser?.authUserId) {
      throw new Error('Admin or employee user not found in user-service');
    }
    adminUserId = adminUser.id;
    employeeUserId = employeeUser.id;
    employeeAuthUserId = employeeUser.authUserId;

    const orgListRes = await request({
      method: 'GET',
      path: '/api/organizations',
      headers: authHeaders(),
    });
    if (orgListRes.status !== 200) {
      throw new Error(
        `Organization list failed: ${orgListRes.status} ${orgListRes.body}`,
      );
    }
    const orgListPayload = json(orgListRes.body) || {};
    const organizations = orgListPayload?.data || [];

    for (const organization of organizations) {
      const membersRes = await request({
        method: 'GET',
        path: `/api/organizations/${organization.id}/members`,
        headers: authHeaders(),
      });

      if (membersRes.status !== 200) {
        continue;
      }

      const membersPayload = json(membersRes.body) || {};
      const hasAdminMembership = (membersPayload?.data || []).some(
        (membership) =>
          membership?.userId === adminUserId && membership?.role === 'ADMIN',
      );

      if (hasAdminMembership) {
        orgId = organization.id;
        break;
      }
    }

    if (!orgId) {
      // Create an organization for the integration admin
      const createOrgRes = await request({
        method: 'POST',
        path: '/api/organizations',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name: `Integration Org-${Date.now()}`,
          code: `ORG-${Date.now()}`,
        }),
      });

      if (createOrgRes.status !== 201) {
        throw new Error(
          `Failed to create organization: ${createOrgRes.status} ${createOrgRes.body}`,
        );
      }

      const createOrgPayload = json(createOrgRes.body) || {};
      orgId = createOrgPayload?.data?.id;

      if (!orgId) {
        throw new Error('Organization created but no ID returned');
      }

      // Add admin user as admin member (usually happens automatically, but let's ensure it)
      await retry(
        async () => {
          const meRes = await request({
            method: 'GET',
            path: `/api/organizations/${orgId}/members`,
            headers: authHeaders(),
          });

          if (meRes.status !== 200) {
            throw new Error(
              `Failed to verify organization membership: ${meRes.status}`,
            );
          }

          const mePayload = json(meRes.body) || {};
          const isAdmin = (mePayload?.data || []).some(
            (m) => m?.userId === adminUserId && m?.role === 'ADMIN',
          );

          if (!isAdmin) {
            throw new Error(
              'Admin user not automatically added to organization',
            );
          }
        },
        { attempts: 5, delayMs: 1000, label: 'verify organization membership' },
      );
    }

    const deptRes = await request({
      method: 'POST',
      path: '/api/departments',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        name: `Dept-${Date.now()}`,
        organizationId: orgId,
      }),
    });
    if (deptRes.status !== 201) {
      throw new Error(`Dept create failed: ${deptRes.status} ${deptRes.body}`);
    }
    const deptPayload = json(deptRes.body) || {};
    deptId = deptPayload?.data?.id || null;

    const schedulePayload = {
      name: `Schedule-${Date.now()}`,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      organizationId: orgId,
      departmentId: deptId,
      createdById: adminUserId,
    };

    const createdSchedule = await retry(
      async () => {
        const res = await request({
          method: 'POST',
          path: '/api/schedules',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(schedulePayload),
        });
        if (res.status !== 200) {
          throw new Error(`Schedule create not ready: ${res.status}`);
        }
        const payload = json(res.body) || {};
        return payload?.data;
      },
      { attempts: 20, delayMs: 1500, label: 'wait for schedule cache' },
    );

    scheduleId = createdSchedule?.id || null;
    if (!scheduleId) {
      throw new Error('Schedule id not resolved');
    }

    const shiftRes = await request({
      method: 'POST',
      path: '/api/schedules/shifts',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        scheduleId,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        location: 'HQ',
      }),
    });
    if (shiftRes.status !== 200) {
      throw new Error(
        `Shift create failed: ${shiftRes.status} ${shiftRes.body}`,
      );
    }
    const shiftPayload = json(shiftRes.body) || {};
    shiftId = shiftPayload?.data?.id || null;

    const assignRes = await request({
      method: 'POST',
      path: '/api/schedules/shiftAssignment',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ shiftId, employeeId: employeeUserId }),
    });
    if (![201, 200].includes(assignRes.status)) {
      throw new Error(
        `Shift assign failed: ${assignRes.status} ${assignRes.body}`,
      );
    }
  });

  test('auth me returns admin user', async () => {
    const res = await request({
      method: 'GET',
      path: '/api/auth/me',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
  });

  test('org members endpoint returns members', async () => {
    const res = await request({
      method: 'GET',
      path: `/api/organizations/${orgId}/members`,
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const payload = json(res.body);
    expect(Array.isArray(payload?.data)).toBe(true);
  });

  test('non-admin cannot create organization', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/organizations',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify({ name: `Org-${Date.now()}-blocked` }),
    });
    expect(res.status).toBe(403);
  });

  test('updateMe succeeds with gateway auth', async () => {
    const res = await request({
      method: 'PATCH',
      path: '/api/users/me',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: 'Integration Admin Updated' }),
    });
    expect(res.status).toBe(200);
  });

  test('attendance check-in/out and hours succeed', async () => {
    const attendanceRes = await request({
      method: 'POST',
      path: '/api/attendance',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ employeeId: employeeUserId, shiftId }),
    });
    expect(attendanceRes.status).toBe(201);
    const attendancePayload = json(attendanceRes.body) || {};
    const attendanceId = attendancePayload?.data?.id;

    const checkInRes = await request({
      method: 'PATCH',
      path: '/api/attendance/check-in/',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ attendanceId }),
    });
    expect(checkInRes.status).toBe(200);

    const checkOutRes = await request({
      method: 'PATCH',
      path: '/api/attendance/check-out/',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ attendanceId }),
    });
    expect(checkOutRes.status).toBe(200);

    const period = new Date().toISOString().slice(0, 7);
    const hoursRes = await request({
      method: 'GET',
      path: `/api/attendance/hours/${employeeUserId}?period=${period}`,
      headers: authHeaders(),
    });
    expect(hoursRes.status).toBe(200);
  });

  test('attendance invalid id returns domain error status', async () => {
    const res = await request({
      method: 'PATCH',
      path: '/api/attendance/check-in/',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        attendanceId: '00000000-0000-4000-8000-000000000000',
      }),
    });
    expect(res.status).toBe(404);
  });

  test('payroll recalculates from attendance events for existing period', async () => {
    const period = new Date().toISOString().slice(0, 7);

    const createRes = await request({
      method: 'POST',
      path: '/api/payroll',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        employeeId: employeeUserId,
        period,
        basePay: 20,
        overtimePay: 30,
      }),
    });
    expect(createRes.status).toBe(201);
    const createdPayroll = json(createRes.body) || {};
    const payrollId = createdPayroll?.data?.id;

    const attendanceRes = await request({
      method: 'POST',
      path: '/api/attendance',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ employeeId: employeeUserId, shiftId }),
    });
    expect(attendanceRes.status).toBe(201);
    const attendancePayload = json(attendanceRes.body) || {};
    const attendanceId = attendancePayload?.data?.id;

    const checkInRes = await request({
      method: 'PATCH',
      path: '/api/attendance/check-in/',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ attendanceId }),
    });
    expect(checkInRes.status).toBe(200);

    await sleep(1000);

    const checkOutRes = await request({
      method: 'PATCH',
      path: '/api/attendance/check-out/',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ attendanceId }),
    });
    expect(checkOutRes.status).toBe(200);

    const updatedPayroll = await retry(
      async () => {
        const res = await request({
          method: 'GET',
          path: `/api/payroll/${payrollId}`,
          headers: authHeaders(),
        });
        if (res.status !== 200) {
          throw new Error(`Payroll fetch failed: ${res.status}`);
        }
        const payload = json(res.body) || {};
        if (!(payload?.data?.totalHours > 0)) {
          throw new Error('Payroll has not been recalculated yet');
        }
        return payload.data;
      },
      { attempts: 20, delayMs: 1000, label: 'wait for payroll recalculation' },
    );

    expect(updatedPayroll.status).toBe('COMPLETED');
  });

  test('inactive user cannot create payroll', async () => {
    const deactivateRes = await request({
      method: 'PATCH',
      path: `/api/users/${employeeAuthUserId}`,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ isActive: false }),
    });
    expect(deactivateRes.status).toBe(200);

    await retry(
      async () => {
        const res = await request({
          method: 'POST',
          path: '/api/payroll',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            employeeId: employeeUserId,
            period: `2099-12`,
            basePay: 20,
            overtimePay: 30,
          }),
        });
        if (res.status !== 400) {
          throw new Error(`Payroll create not blocked yet: ${res.status}`);
        }
        return true;
      },
      { attempts: 10, delayMs: 1000, label: 'wait for employee state sync' },
    );
  });

  test('schedule and shift lists are accessible', async () => {
    const scheduleRes = await request({
      method: 'GET',
      path: '/api/schedules',
      headers: authHeaders(),
    });
    expect(scheduleRes.status).toBe(200);

    const shiftRes = await request({
      method: 'GET',
      path: '/api/shifts',
      headers: authHeaders(),
    });
    expect(shiftRes.status).toBe(200);
  });
});
