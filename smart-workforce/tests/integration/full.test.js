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
  const adminPassword =
    process.env.INTEGRATION_ADMIN_PASSWORD || 'Password1!';
  const employeeEmail = `emp-${Date.now()}@example.com`;
  const employeePassword = 'Password1!';

  let adminToken;
  let employeeToken;
  let adminUserId;
  let orgId;
  let deptId;
  let scheduleId;
  let shiftId;
  let attendanceId;

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
    if (res.status === 400 && String(payload?.message || '').includes('exists')) {
      return;
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

  beforeAll(async () => {
    await registerIfNeeded(adminEmail, adminPassword);
    const adminLogin = await login(adminEmail, adminPassword);
    adminToken = adminLogin.token;

    await registerIfNeeded(employeeEmail, employeePassword);
    const employeeLogin = await login(employeeEmail, employeePassword);
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
    if (!adminUser?.id) {
      throw new Error('Admin user not found in user-service');
    }
    adminUserId = adminUser.id;

    const orgRes = await request({
      method: 'POST',
      path: '/api/organizations',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: `Org-${Date.now()}` }),
    });

    if (![201, 400].includes(orgRes.status)) {
      throw new Error(`Org create failed: ${orgRes.status} ${orgRes.body}`);
    }

    if (orgRes.status === 201) {
      const orgPayload = json(orgRes.body) || {};
      orgId = orgPayload?.data?.id || null;
    } else {
      // fallback to first org if created already
      const listRes = await request({
        method: 'GET',
        path: '/api/organizations',
        headers: authHeaders(),
      });
      const listPayload = json(listRes.body) || {};
      orgId = listPayload?.data?.[0]?.id || null;
    }

    if (!orgId) {
      throw new Error('Organization id not resolved');
    }

    const addMemberRes = await request({
      method: 'POST',
      path: `/api/organizations/${orgId}/members`,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ userId: adminUserId, role: 'ADMIN' }),
    });
    if (![201, 200].includes(addMemberRes.status)) {
      throw new Error(
        `Add member failed: ${addMemberRes.status} ${addMemberRes.body}`,
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
        CreatedBy: adminUserId,
        location: 'HQ',
      }),
    });
    if (shiftRes.status !== 200) {
      throw new Error(`Shift create failed: ${shiftRes.status} ${shiftRes.body}`);
    }
    const shiftPayload = json(shiftRes.body) || {};
    shiftId = shiftPayload?.data?.id || null;

    const assignRes = await request({
      method: 'POST',
      path: '/api/schedules/shiftAssignment',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ shiftId, employeeId: adminUserId }),
    });
    if (![201, 200].includes(assignRes.status)) {
      throw new Error(
        `Shift assign failed: ${assignRes.status} ${assignRes.body}`,
      );
    }

    const attendanceRes = await request({
      method: 'POST',
      path: '/api/attendance',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ employeeId: adminUserId, shiftId }),
    });
    if (attendanceRes.status !== 201) {
      throw new Error(
        `Attendance create failed: ${attendanceRes.status} ${attendanceRes.body}`,
      );
    }
    const attendancePayload = json(attendanceRes.body) || {};
    attendanceId = attendancePayload?.data?.id || null;
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
      path: `/api/attendance/hours/${adminUserId}?period=${period}`,
      headers: authHeaders(),
    });
    expect(hoursRes.status).toBe(200);
  });

  test('payroll calculate succeeds when attendance exists', async () => {
    const period = `${new Date().toISOString().slice(0, 7)}-${Date.now()}`;

    const createRes = await request({
      method: 'POST',
      path: '/api/payroll',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        employeeId: adminUserId,
        period,
        basePay: 20,
        overtimePay: 30,
      }),
    });
    expect(createRes.status).toBe(201);

    const calcRes = await request({
      method: 'POST',
      path: '/api/payroll/calculate',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ employeeId: adminUserId, period }),
    });
    expect(calcRes.status).toBe(200);
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
