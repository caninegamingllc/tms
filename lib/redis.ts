import "server-only";
import { createClient, type RedisClientType } from "redis";

const globalForRedis = globalThis as unknown as {
  redis?: RedisClientType | null;
  redisConnecting?: Promise<RedisClientType | null>;
};

function redisUrl() {
  return process.env.REDIS_URL?.trim() || "";
}

export function isRedisConfigured() {
  return Boolean(redisUrl());
}

async function connectRedis(): Promise<RedisClientType | null> {
  const url = redisUrl();
  if (!url) {
    return null;
  }

  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  if (!globalForRedis.redisConnecting) {
    globalForRedis.redisConnecting = (async () => {
      try {
        const client = createClient({ url }) as RedisClientType;
        client.on("error", (error) => {
          console.error("[redis]", error);
        });
        await client.connect();
        globalForRedis.redis = client;
        return client;
      } catch (error) {
        console.error("[redis] connect failed", error);
        globalForRedis.redis = null;
        return null;
      } finally {
        globalForRedis.redisConnecting = undefined;
      }
    })();
  }

  return globalForRedis.redisConnecting;
}

export async function redisGet(key: string): Promise<string | null> {
  const client = await connectRedis();
  if (!client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlSeconds: number) {
  const client = await connectRedis();
  if (!client) return false;
  try {
    await client.set(key, value, { EX: ttlSeconds });
    return true;
  } catch {
    return false;
  }
}

export async function redisIncrWindow(key: string, windowMs: number): Promise<number> {
  const client = await connectRedis();
  if (!client) {
    return -1;
  }

  try {
    const count = await client.incr(key);
    if (count === 1) {
      await client.pExpire(key, windowMs);
    }
    return count;
  } catch {
    return -1;
  }
}
