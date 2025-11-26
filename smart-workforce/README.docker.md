Run the full stack locally with Docker (dev)

Prerequisites

- Docker Desktop running (Windows/macOS) or Docker Engine on Linux
- At least 4GB free memory

Start the stack

```powershell
# from repository root
docker compose -f docker-compose.dev.yml up --build
```

Notes

- Services use Postgres and RabbitMQ defined in `docker-compose.dev.yml`.
- After first build, run migrations for each service that uses Prisma before hitting endpoints:

```powershell
# from services/auth-service
docker compose exec auth-service npm run prisma:migrate

# from services/user-service
docker compose exec user-service npm run prisma:migrate

# schedule-service if it has migrations
docker compose exec schedule-service npm run prisma:migrate
```
