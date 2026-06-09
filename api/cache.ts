/**
 * Deliverable 3C — Analysis cache.
 *
 * If the same product is analyzed twice within CACHE_TTL_HOURS, we return the
 * cached result instead of paying for another LLM call.
 *
 * Cache key: sha256(product_name.toLowerCase().trim()).
 *
 * Backend selection:
 *   - If REDIS_URL is set, uses Redis (ioredis), suitable for multi-instance.
 *   - Otherwise falls back to an in-memory Map (single-instance / dev).
 */

import { createHash } from "crypto";
import { config } from "@/lib/config";
import type { ProductAnalysis } from "@/schemas/product.schema";

export function cacheKey(productName: string): string {
  const normalized = productName.toLowerCase().trim();
  return createHash("sha256").update(normalized).digest("hex");
}

interface CacheBackend {
  get(key: string): Promise<ProductAnalysis | null>;
  set(key: string, value: ProductAnalysis, ttlSeconds: number): Promise<void>;
}

/* ----------------------------- In-memory ---------------------------------- */

class MemoryCache implements CacheBackend {
  private store = new Map<string, { value: ProductAnalysis; expiresAt: number }>();

  async get(key: string): Promise<ProductAnalysis | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: ProductAnalysis, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

/* ------------------------------- Redis ------------------------------------ */

class RedisCache implements CacheBackend {
  // Lazily-typed to avoid a hard import when Redis isn't used.
  private client: any;

  constructor(redisUrl: string) {
    // Dynamic require keeps ioredis optional at runtime.
    const Redis = require("ioredis");
    this.client = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  }

  async get(key: string): Promise<ProductAnalysis | null> {
    const raw = await this.client.get(`analysis:${key}`);
    return raw ? (JSON.parse(raw) as ProductAnalysis) : null;
  }

  async set(key: string, value: ProductAnalysis, ttlSeconds: number): Promise<void> {
    await this.client.set(
      `analysis:${key}`,
      JSON.stringify(value),
      "EX",
      ttlSeconds
    );
  }
}

/* ------------------------------ Singleton --------------------------------- */

let backend: CacheBackend | null = null;

function getBackend(): CacheBackend {
  if (backend) return backend;
  if (config.infra.redisUrl) {
    try {
      backend = new RedisCache(config.infra.redisUrl);
    } catch {
      backend = new MemoryCache();
    }
  } else {
    backend = new MemoryCache();
  }
  return backend;
}

export async function getCachedAnalysis(
  productName: string
): Promise<ProductAnalysis | null> {
  try {
    return await getBackend().get(cacheKey(productName));
  } catch {
    return null; // never let cache failures break the request
  }
}

export async function setCachedAnalysis(
  productName: string,
  analysis: ProductAnalysis
): Promise<void> {
  try {
    const ttlSeconds = config.limits.cacheTtlHours * 3600;
    await getBackend().set(cacheKey(productName), analysis, ttlSeconds);
  } catch {
    /* swallow cache write errors */
  }
}
