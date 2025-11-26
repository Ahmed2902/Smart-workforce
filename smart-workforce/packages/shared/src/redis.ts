import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis client with connection pooling and error handling
 */
export async function initRedis(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnect attempts exceeded');
            return new Error('Redis max retries exceeded');
          }
          return retries * 100; // Exponential backoff
        },
      },
    });

    redisClient.on('error', (err) => logger.error({ err }, 'Redis error'));
    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('reconnecting', () => logger.info('Redis reconnecting'));

    await redisClient.connect();
    logger.info('Redis client initialized');

    return redisClient;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis');
    throw error;
  }
}

/**
 * Get Redis client instance
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient || !redisClient.isOpen) {
    return initRedis();
  }
  return redisClient;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}

/**
 * GET - Retrieve value by key
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
}

/**
 * SET - Store value with optional expiration (seconds)
 */
export async function setCache(
  key: string,
  value: any,
  expiresIn?: number,
): Promise<void> {
  const client = await getRedisClient();
  const serialized = JSON.stringify(value);
  if (expiresIn) {
    await client.setEx(key, expiresIn, serialized);
  } else {
    await client.set(key, serialized);
  }
}

/**
 * DEL - Delete key(s)
 */
export async function deleteCache(keys: string | string[]): Promise<number> {
  const client = await getRedisClient();
  const keyArray = Array.isArray(keys) ? keys : [keys];
  return client.del(keyArray);
}

/**
 * INCR - Increment counter (used for rate limiting, pagination)
 */
export async function incrementCounter(key: string): Promise<number> {
  const client = await getRedisClient();
  return client.incr(key);
}

/**
 * SETEX - Set key with expiration (convenience wrapper)
 */
export async function setCacheWithExpiry(
  key: string,
  seconds: number,
  value: any,
): Promise<void> {
  const client = await getRedisClient();
  await client.setEx(key, seconds, JSON.stringify(value));
}

/**
 * SET NX EX - Set key only if not exists (used for locks)
 * Returns true if lock acquired, false if already exists
 */
export async function acquireLock(
  key: string,
  expiresIn: number = 30,
): Promise<boolean> {
  const client = await getRedisClient();
  const result = await client.set(key, '1', { NX: true, EX: expiresIn });
  return result !== null; // Returns null if key already exists
}

/**
 * Release lock by deleting key
 */
export async function releaseLock(key: string): Promise<void> {
  await deleteCache(key);
}

/**
 * EXPIRE - Set expiration on existing key
 */
export async function setExpiry(key: string, seconds: number): Promise<void> {
  const client = await getRedisClient();
  await client.expire(key, seconds);
}

/**
 * EXISTS - Check if key exists
 */
export async function keyExists(key: string): Promise<boolean> {
  const client = await getRedisClient();
  const count = await client.exists(key);
  return count > 0;
}

/**
 * TTL - Get remaining time to live for key (in seconds)
 */
export async function getKeyTTL(key: string): Promise<number> {
  const client = await getRedisClient();
  return client.ttl(key);
}

/**
 * FLUSHDB - Clear all keys from current database (development only)
 */
export async function flushDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FLUSHDB not allowed in production');
  }
  const client = await getRedisClient();
  await client.flushDb();
  logger.warn('Redis database flushed');
}
