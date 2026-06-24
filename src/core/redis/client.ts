import Redis from 'ioredis';
import type { ServerConfig } from '../types';

let redisClient: Redis | null = null;

export async function createRedisClient(config: ServerConfig): Promise<Redis | null> {
  if (redisClient) return redisClient;

  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    db: config.redis.db,
    password: config.redis.password,
    maxRetriesPerRequest: 1,
    connectTimeout: 10000,
    lazyConnect: true,
    // Don't endlessly reconnect: if Redis is unreachable we fall back to
    // in-memory mode, so returning null here stops the retry loop (and the
    // stream of unhandled ECONNREFUSED error events it would otherwise emit).
    retryStrategy: () => null,
  });
  // Swallow connection errors; the fallback below handles unavailability.
  client.on('error', () => {});

  try {
    await client.connect();
    redisClient = client;
    console.log('[Redis] Connected successfully');
    return redisClient;
  } catch (err: any) {
    console.warn(`[Redis] Connection failed: ${err.message}. Running in-memory mode.`);
    client.disconnect();
    redisClient = null;
    return null;
  }
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export function createPubSubClient(config: ServerConfig): Redis | null {
  try {
    const pubsub = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db + 1,
      password: config.redis.password,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
    });
    return pubsub;
  } catch {
    return null;
  }
}
