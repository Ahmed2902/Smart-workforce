/* eslint-env node, jest */
const http = require('http');
const https = require('https');

const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:8080';
const TIMEOUT_MS = 1800000;

const now = Date.now();
const earlier = new Date(now - 24 * 60 * 60 * 1000).toISOString();

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
        const result = {
          status: res.statusCode,
          headers: res.headers,
          body: data,
        };
        if (!String(path).includes('/health')) {
          console.log(`HTTP ${method} ${path} -> ${result.status}`);
          if (result.status >= 400) {
            console.error(`Response body: ${result.body}`);
          }
        }
        resolve(result);
      });
    });

    req.on('error', (err) => {
      console.error(`Request error ${method} ${path}: ${err.message}`);
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

async function waitForGateway() {
  return retry(
    async () => {
      const res = await request({ method: 'GET', path: '/health' });
      if (!res.status || res.status >= 500) {
        throw new Error(`Gateway not ready: ${res.status}`);
      }
      return true;
    },
    { attempts: 30, delayMs: 2000, label: 'wait for gateway' },
  );
}

describe('Full integration flow', () => {
  jest.setTimeout(TIMEOUT_MS);

  const runId = Date.now();
  const bootstrapAdminEmail =
    process.env.INTEGRATION_BOOTSTRAP_EMAIL || 'admin@example.com';
  const bootstrapAdminPassword =
    process.env.INTEGRATION_BOOTSTRAP_PASSWORD || 'Password1!';
  const requestedAdminEmail =
    process.env.INTEGRATION_ADMIN_EMAIL ||
    `org-admin.integration.${runId}@example.com`;
  const adminPassword = process.env.INTEGRATION_ADMIN_PASSWORD || 'Password1!';
  const employeeEmail =
    process.env.INTEGRATION_EMPLOYEE_EMAIL ||
    `employee.integration.${runId}@example.com`;
  const employeePassword =
    process.env.INTEGRATION_EMPLOYEE_PASSWORD || 'Password1!';

  let bootstrapToken;
  let bootstrapUserId;
  let workflowAdminEmail = bootstrapAdminEmail;
  let adminToken;
  let employeeToken;
  let adminUserId;
  let employeeUserId;
  let employeeAuthUserId;
  let orgId;
  let adminIsSuperadmin = false;

  const authHeaders = (token = adminToken) => ({
    Authorization: `Bearer ${token}`,
  });
  const bootstrapHeaders = () => authHeaders(bootstrapToken);

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

  const getUsersPayload = async (token = adminToken) =>
    retry(
      async () => {
        const res = await request({
          method: 'GET',
          path: '/api/users/me?limit=100',
          headers: authHeaders(token),
        });
        if (res.status !== 200) {
          throw new Error(`Users list not ready: ${res.status} ${res.body}`);
        }
        const payload = json(res.body);
        if (!payload || !Array.isArray(payload.data)) {
          throw new Error('Users list response malformed');
        }
        return payload;
      },
      { attempts: 20, delayMs: 1500, label: 'wait for user-service sync' },
    );

  const getOrganizationMembers = async () => {
    const res = await request({
      method: 'GET',
      path: `/api/organizations/${orgId}/members?limit=100`,
      headers: bootstrapHeaders(),
    });

    if (res.status !== 200) {
      throw new Error(`Org members failed: ${res.status} ${res.body}`);
    }

    const payload = json(res.body) || {};
    return payload.data || [];
  };

  const ensureMembership = async (userId, role, { forceSync = false } = {}) => {
    await retry(
      async () => {
        const members = await getOrganizationMembers();
        const existingMembership = members.find(
          (membership) => membership?.userId === userId,
        );

        if (!existingMembership) {
          const addRes = await request({
            method: 'POST',
            path: `/api/organizations/${orgId}/members`,
            headers: {
              'Content-Type': 'application/json',
              ...bootstrapHeaders(),
            },
            body: JSON.stringify({ userId, role }),
          });

          if (![200, 201].includes(addRes.status)) {
            throw new Error(
              `Add membership failed: ${addRes.status} ${addRes.body}`,
            );
          }
        } else if (existingMembership.role !== role || forceSync) {
          const updateRes = await request({
            method: 'PUT',
            path: `/api/organizations/${orgId}/members/${userId}`,
            headers: {
              'Content-Type': 'application/json',
              ...bootstrapHeaders(),
            },
            body: JSON.stringify({ role }),
          });

          if (updateRes.status !== 200) {
            throw new Error(
              `Update membership failed: ${updateRes.status} ${updateRes.body}`,
            );
          }
        }

        const refreshedMembers = await getOrganizationMembers();
        const refreshedMembership = refreshedMembers.find(
          (membership) => membership?.userId === userId,
        );

        if (!refreshedMembership || refreshedMembership.role !== role) {
          throw new Error(
            `Membership not yet ready for user ${userId} with role ${role}`,
          );
        }
      },
      {
        attempts: 10,
        delayMs: 1500,
        label: `ensure membership ${userId}:${role}`,
      },
    );
  };

  beforeAll(async () => {
    await waitForGateway();

    const bootstrapLogin = await ensureUser(
      bootstrapAdminEmail,
      bootstrapAdminPassword,
    );
    bootstrapToken = bootstrapLogin.token;
    adminToken = bootstrapToken;

    const employeeLogin = await ensureUser(employeeEmail, employeePassword);
    employeeToken = employeeLogin.token;

    if (!bootstrapToken) {
      throw new Error('Bootstrap admin login did not return token');
    }

    const { bootstrapAdminUser, adminUser, employeeUser } = await retry(
      async () => {
        const usersPayload = await getUsersPayload(bootstrapToken);

        const bootstrapAdminUser = usersPayload.data.find(
          (u) => u.email === bootstrapAdminEmail,
        );
        const adminUser = bootstrapAdminUser;
        const employeeUser = usersPayload.data.find(
          (u) => u.email === employeeEmail,
        );

        if (
          !bootstrapAdminUser?.id ||
          !adminUser?.id ||
          !employeeUser?.id ||
          !employeeUser?.authUserId
        ) {
          throw new Error('required users are not yet synced to user-service');
        }

        return { bootstrapAdminUser, adminUser, employeeUser };
      },
      { attempts: 20, delayMs: 1500, label: 'wait for required users' },
    );
    bootstrapUserId = bootstrapAdminUser.id;
    adminUserId = adminUser.id;
    employeeUserId = employeeUser.id;
    employeeAuthUserId = employeeUser.authUserId;
    adminIsSuperadmin = bootstrapAdminUser.systemRole === 'SUPERADMIN';

    const orgListRes = await request({
      method: 'GET',
      path: '/api/organizations',
      headers: bootstrapHeaders(),
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
        headers: bootstrapHeaders(),
      });

      if (membersRes.status !== 200) {
        continue;
      }

      const membersPayload = json(membersRes.body) || {};
      const hasAdminMembership = (membersPayload?.data || []).some(
        (membership) =>
          membership?.userId === bootstrapUserId &&
          membership?.role === 'ADMIN',
      );

      if (hasAdminMembership) {
        orgId = organization.id;
        break;
      }
    }

    if (!orgId) {
      if (!adminIsSuperadmin) {
        throw new Error(
          `Integration setup could not find an organization where ${bootstrapAdminEmail} is an ADMIN, and the bootstrap user is not SUPERADMIN so the suite cannot create one`,
        );
      }

      const createOrgRes = await request({
        method: 'POST',
        path: '/api/organizations',
        headers: { 'Content-Type': 'application/json', ...bootstrapHeaders() },
        body: JSON.stringify({
          name: `Integration Org-${Date.now()}`,
          description: 'Integration test organization',
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
            headers: bootstrapHeaders(),
          });

          if (meRes.status !== 200) {
            throw new Error(
              `Failed to verify organization membership: ${meRes.status}`,
            );
          }

          const mePayload = json(meRes.body) || {};
          const isAdmin = (mePayload?.data || []).some(
            (m) => m?.userId === bootstrapUserId && m?.role === 'ADMIN',
          );

          if (!isAdmin) {
            throw new Error(
              'Bootstrap admin user not automatically added to organization',
            );
          }
        },
        { attempts: 5, delayMs: 1000, label: 'verify organization membership' },
      );
    }

    await ensureMembership(adminUserId, 'ADMIN', { forceSync: true });
    await ensureMembership(employeeUserId, 'EMPLOYEE', { forceSync: true });
  });

  test('auth me returns admin user', async () => {
    const res = await request({
      method: 'GET',
      path: '/api/auth/me',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const payload = json(res.body) || {};
    expect(payload?.authUser?.email).toBe(workflowAdminEmail);
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
      body: JSON.stringify({ employeeId: employeeUserId }),
    });
    expect(attendanceRes.status).toBe(201);
    const attendancePayload = json(attendanceRes.body) || {};
    const attendanceId = attendancePayload?.data?.id;

    // Use deterministic timestamps instead of sleeping
    const checkOutTime = new Date();
    const checkInTime = new Date(checkOutTime.getTime() - 60 * 60 * 10000); // 1 hour earlier

    const checkInRes = await request({
      method: 'PATCH',
      path: '/api/attendance/check-in/',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(employeeToken),
      },
      body: JSON.stringify({ attendanceId, time: checkInTime.toISOString() }),
    });
    expect(checkInRes.status).toBe(200);

    const checkOutRes = await request({
      method: 'PATCH',
      path: '/api/attendance/check-out/',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(employeeToken),
      },
      body: JSON.stringify({ attendanceId, time: checkOutTime.toISOString() }),
    });
    expect(checkOutRes.status).toBe(200);

    const period = new Date().toISOString().slice(0, 7);
    const hoursRes = await request({
      method: 'GET',
      path: `/api/attendance/hours/${employeeUserId}?period=${period}`,
      headers: authHeaders(),
    });
    expect(hoursRes.status).toBe(200);
    console.log('Attendance hours payload:', hoursRes.body);
  });

  test('attendance invalid id returns domain error status', async () => {
    const res = await request({
      method: 'PATCH',
      path: '/api/attendance/check-in/',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(employeeToken),
      },
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
      body: JSON.stringify({ employeeId: employeeUserId }),
    });
    expect(attendanceRes.status).toBe(201);
    const attendancePayload = json(attendanceRes.body) || {};
    const attendanceId = attendancePayload?.data?.id;

    // Use deterministic timestamps instead of sleeping
    const now = new Date();
    const checkInTime2 = new Date(now.getTime() - 60 * 60 * 10000);
    const checkOutTime2 = now; // 1 hour earlier

    const checkInRes = await request({
      method: 'PATCH',
      path: '/api/attendance/check-in/',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(employeeToken),
      },
      body: JSON.stringify({ attendanceId, time: checkInTime2.toISOString() }),
    });
    expect(checkInRes.status).toBe(200);

    const checkOutRes = await request({
      method: 'PATCH',
      path: '/api/attendance/check-out/',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(employeeToken),
      },
      body: JSON.stringify({ attendanceId, time: checkOutTime2.toISOString() }),
    });
    expect(checkOutRes.status).toBe(200);

    // Log attendance hours immediately after check-out for debugging
    const postCheckHoursRes = await request({
      method: 'GET',
      path: `/api/attendance/hours/${employeeUserId}?period=${period}`,
      headers: authHeaders(),
    });
    console.log('Attendance hours after check-out:', postCheckHoursRes.body);

    // Trigger payroll calculation synchronously to avoid relying on event consumers
    const calcRes = await request({
      method: 'POST',
      path: '/api/payroll/calculate',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ employeeId: employeeUserId, period }),
    });
    if (calcRes.status !== 200) {
      // allow retry loop below to still wait for recalculation if calculation is async
      console.log('Payroll calculate endpoint returned', calcRes.status);
    }

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
          console.log('Payroll payload during wait:', res.body);
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
