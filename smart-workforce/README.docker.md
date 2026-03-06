Run the full stack locally with Docker (local gateway + all services)

Prerequisites

- Docker Desktop running (Windows/macOS) or Docker Engine on Linux
- At least 4GB free memory

Start the stack

```powershell
# from repository root
docker compose -f docker-compose.local.yml up --build
```

Notes

- The stack includes: API gateway (Nginx), auth, user, schedule, attendance, payroll, RabbitMQ, Redis, and one Postgres DB per service.
- Migrations are run automatically on container start via `npm run prisma:deploy`.
- Public entrypoint is the gateway: `http://localhost:8080`.

- RabbitMQ management UI: `http://localhost:15672` (guest/guest).
