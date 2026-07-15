import { redisGet, redisSet } from "@/lib/redis";

type CacheEntry<T> = { expiresAt: number; value: T };

const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const redisValue = await redisGet(`cache:${key}`);
  if (redisValue) {
    try {
      return JSON.parse(redisValue) as T;
    } catch {
      // fall through to memory
    }
  }

  const local = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (local && local.expiresAt > Date.now()) {
    return local.value;
  }
  return null;
}

export async function cacheSetJson<T>(key: string, value: T, ttlMs: number) {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  await redisSet(`cache:${key}`, JSON.stringify(value), Math.max(1, Math.ceil(ttlMs / 1000)));
}
