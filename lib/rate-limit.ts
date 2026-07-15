import { redisIncrWindow } from "@/lib/redis";

const memoryWindows = new Map<string, number[]>();

/**
 * Shared rate limiter: uses Redis when REDIS_URL is set (multi-instance safe),
 * otherwise falls back to an in-process window map.
 */
export async function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const redisCount = await redisIncrWindow(`ratelimit:${key}`, windowMs);
  if (redisCount >= 0) {
    return redisCount > maxRequests;
  }

  const now = Date.now();
  const recent = (memoryWindows.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= maxRequests) {
    memoryWindows.set(key, recent);
    return true;
  }
  recent.push(now);
  memoryWindows.set(key, recent);
  return false;
}
