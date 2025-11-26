# User Service

Files added:

- `src/middleware/errorMiddleware.ts` - centralized error handler
- `src/utils/config.ts` - loads env vars
- `src/utils/logger.ts` - Winston logger
- `src/middleware/validateRequest.ts` - Zod-based request validation helper
- `src/validators/userValidator.ts` - sample user validation
- `src/utils/swagger.ts` - Swagger setup
- `docker-compose.micro.yml` - microservices compose with Postgres and RabbitMQ

How to run locally:

1. Install deps

```bash
cd services/user-service
npm install
```

2. Run dev server

```bash
npm run dev
```

3. To run infrastructure quickly (Postgres + RabbitMQ):

```bash
# from smart-workforce root
docker compose -f docker-compose.micro.yml up --build
```

4. Swagger UI available at `http://localhost:4000/docs` (after server starts)

Notes:

- Update `.env` at service root with `DATABASE_URL`, `RABBITMQ_URL`, `PORT`, etc.
- I used Winston for logging; install `winston`.
