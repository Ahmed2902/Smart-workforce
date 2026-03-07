Run the full stack locally with Docker (local gateway + all services)

Prerequisites

- Docker Desktop running (Windows/macOS) or Docker Engine on Linux
- At least 4GB free memory

Start the stack

```powershell
# from repository root
docker compose -f docker-compose.local.yml up --build
```

Gateway security defaults

- `GATEWAY_TOKEN` is required and is used for gateway-to-service trust headers.
- Public access is only through `http://localhost:8080`.
- Service ports are not published to host.

Smoke test (PowerShell)

```powershell
# 1) gateway health
(Invoke-WebRequest -Uri http://localhost:8080/health -UseBasicParsing).StatusCode

# 2) protected route without token -> 401
try { Invoke-WebRequest -Uri http://localhost:8080/api/users -UseBasicParsing | Out-Null } catch { $_.Exception.Response.StatusCode.value__ }

# 3) public auth route reachable (invalid body -> 400 from auth service)
try { Invoke-WebRequest -Uri http://localhost:8080/api/auth/login -Method POST -ContentType 'application/json' -Body '{}' -UseBasicParsing | Out-Null } catch { $_.Exception.Response.StatusCode.value__ }
```

Notes

- The stack includes: API gateway (Nginx), auth, user, schedule, attendance, payroll, RabbitMQ, Redis, and one Postgres DB per service.
- Migrations are run automatically on container start via `npm run prisma:deploy`.
- Public entrypoint is the gateway: `http://localhost:8080`.

- RabbitMQ management UI: `http://localhost:15672` (guest/guest).
