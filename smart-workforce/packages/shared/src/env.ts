import { config } from "dotenv";
import { z } from "zod";
config(); // loads .env from each service working dir

export const baseEnv = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  NATS_URL: z.string().default("nats://localhost:4222"),
});

export type BaseEnv = z.infer<typeof baseEnv>;
export const parseEnv = <T extends z.ZodTypeAny>(schema: T) =>
  schema.parse(process.env);
