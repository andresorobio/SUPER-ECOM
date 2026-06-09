/**
 * Deliverable 3C — Rate limiting.
 *
 * Max RATE_LIMIT_PER_HOUR requests per user per rolling hour.
 * Uses Redis (atomic INCR + EXPIRE) when REDIS_URL is set, otherwise an
 * in-memory fixed-window counter.
 */

import { config } from "@/lib/config";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix epoch seconds when the window resets. */
  resetAt: number;
}

interface RateBackend {
  hit(userId: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

/* ----------------------------- In-memory ---------------------------------- */

class MemoryRate implements RateBackend {
  private store = new Map<string, { count: number; resetAt: number }>();

  async hit(userId: string, limit: number, windowSeconds: number) {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.store.get(userId);

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + windowSeconds;
      this.store.set(userId, { count: 1, resetAt });
      return { allowed: true, limit, remaining: limit - 1, resetAt };
    }

    entry.count += 1;
    const remaining = Math.max(0, limit - entry.count);
    return {
      allowed: entry.count <= limit,
      limit,
      remaining,
      resetAt: entry.resetAt
    };
  }
}

/* ------------------------------- Redis ------------------------------------ */

class RedisRate implements RateBackend {
  private client: any;

  constructor(redisUrl: string) {
    const Redis = require("ioredis");
    this.client = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  }

  async hit(userId: string, limit: number, windowSeconds: number) {
    const key = `ratelimit:${userId}`;
    const count: number = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSeconds);
    }
    const ttl: number = await this.client.ttl(key);
    const resetAt = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds);
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt
    };
  }
}

/* ------------------------------ Singleton --------------------------------- */

let backend: RateBackend | null = null;

function getBackend(): RateBackend {
  if (backend) return backend;
  if (config.infra.redisUrl) {
    try {
      backend = new RedisRate(config.infra.redisUrl);
    } catch {
      backend = new MemoryRate();
    }
  } else {
    backend = new MemoryRate();
  }
  return backend;
}

export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const limit = config.limits.rateLimitPerHour;
  try {
    return await getBackend().hit(userId, limit, 3600);
  } catch {
    // Fail-open so an infra hiccup doesn't lock everyone out.
    const now = Math.floor(Date.now() / 1000);
    return { allowed: true, limit, remaining: limit, resetAt: now + 3600 };
  }
}
