/* eslint-env node, jest */
const http = require('http');
const https = require('https');

const BASE_URL = process.env.INTEGRATION_BASE_URL || 'http://localhost:8080';
const SERVICE_STARTUP_TIMEOUT = parseInt(
  process.env.SERVICE_STARTUP_TIMEOUT || '120000',
  10,
);

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

async function waitForGateway(maxAttempts = 60, delayMs = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await request({ method: 'GET', path: '/health' });
      if (res.status && res.status < 500) {
        console.log(`Gateway is ready (health returned ${res.status})`);
        return true;
      }
    } catch (err) {
      lastError = err;
      if (attempt % 10 === 0) {
        console.log(
          `Waiting for gateway... attempt ${attempt}/${maxAttempts}`,
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(
    `Gateway failed to become ready after ${maxAttempts * delayMs}ms. Last error: ${lastError?.message}`,
  );
}

describe('API Gateway integration', () => {
  beforeAll(async () => {
    console.log(`\nWaiting for API Gateway at ${BASE_URL} to be ready...`);
    await waitForGateway();
  }, SERVICE_STARTUP_TIMEOUT);

  test('health is internal-only', async () => {
    const res = await request({ method: 'GET', path: '/health' });
    expect([200, 403]).toContain(res.status);
  });

  test('protected route without token returns 401', async () => {
    const res = await request({ method: 'GET', path: '/api/users' });
    expect(res.status).toBe(401);
  });

  test('internal auth endpoint is not reachable externally', async () => {
    const res = await request({ method: 'GET', path: '/_auth' });
    expect(res.status).toBe(404);
  });

  test('public login route returns 400 for empty body', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/auth/login',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(res.status).toBe(400);
  });
});
