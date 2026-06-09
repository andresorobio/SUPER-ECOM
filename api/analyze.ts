/**
 * Deliverable 3A — Core analyze handler (framework-agnostic).
 *
 * Pipeline:
 *   1. Authenticate (JWT bearer).
 *   2. Validate input: non-empty, <= MAX_PRODUCTS_PER_REQUEST.
 *   3. Enforce per-user rate limit.
 *   4. For each product: cache hit -> reuse; else call LLM -> validate -> cache.
 *   5. Persist (best-effort) and return { success, analyses } or a descriptive error.
 *
 * This handler is consumed by BOTH the Next.js route (app/api/...) and the
 * standalone Express server (server/express.ts).
 */

import { ZodError } from "zod";
import { authenticate, AuthError } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCachedAnalysis, setCachedAnalysis } from "@/api/cache";
import { analyzeWithLlm, LlmError } from "@/lib/llm";
import { persistAnalysis } from "@/lib/db";
import { config } from "@/lib/config";
import {
  normalizeAnalyses,
  type ProductAnalysis,
  type AnalyzeResponse
} from "@/schemas/product.schema";

export interface HandlerInput {
  authorization?: string | null;
  body: unknown;
}

export interface HandlerOutput {
  status: number;
  body: AnalyzeResponse;
  headers?: Record<string, string>;
}

function parseProducts(body: unknown): string[] {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object");
  }
  const products = (body as any).products;
  if (!Array.isArray(products)) {
    throw new ValidationError('Field "products" must be an array of strings');
  }
  const cleaned = products
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0);

  if (cleaned.length === 0) {
    throw new ValidationError("Provide at least one product name");
  }
  if (cleaned.length > config.limits.maxProductsPerRequest) {
    throw new ValidationError(
      `Maximum ${config.limits.maxProductsPerRequest} products per request`
    );
  }
  return cleaned;
}

class ValidationError extends Error {}

export async function handleAnalyze(input: HandlerInput): Promise<HandlerOutput> {
  // 1. Auth
  let user;
  try {
    user = authenticate(input.authorization);
  } catch (err) {
    if (err instanceof AuthError) {
      return { status: 401, body: { success: false, error: err.message } };
    }
    throw err;
  }

  // 2. Validate
  let products: string[];
  try {
    products = parseProducts(input.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return { status: 400, body: { success: false, error: err.message } };
    }
    throw err;
  }

  // 3. Rate limit
  const rl = await checkRateLimit(user.userId);
  const rlHeaders = {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(rl.resetAt)
  };
  if (!rl.allowed) {
    return {
      status: 429,
      headers: rlHeaders,
      body: {
        success: false,
        error: `Rate limit exceeded. Try again after ${new Date(
          rl.resetAt * 1000
        ).toISOString()}`
      }
    };
  }

  // 4. Resolve each product (cache first, then LLM for the misses).
  const analyses: ProductAnalysis[] = [];
  const uncached: string[] = [];

  for (const name of products) {
    const cached = await getCachedAnalysis(name);
    if (cached) analyses.push(cached);
    else uncached.push(name);
  }

  if (uncached.length > 0) {
    let raw: string;
    try {
      raw = await analyzeWithLlm(uncached);
    } catch (err) {
      return mapLlmError(err, rlHeaders);
    }

    let fresh: ProductAnalysis[];
    try {
      fresh = normalizeAnalyses(JSON.parse(raw));
    } catch (err) {
      if (err instanceof SyntaxError) {
        return {
          status: 502,
          headers: rlHeaders,
          body: { success: false, error: "LLM returned invalid JSON" }
        };
      }
      if (err instanceof ZodError) {
        return {
          status: 502,
          headers: rlHeaders,
          body: {
            success: false,
            error: "LLM response failed schema validation"
          }
        };
      }
      throw err;
    }

    for (const a of fresh) {
      await setCachedAnalysis(a.product_name, a);
      await persistAnalysis(user.userId, a);
      analyses.push(a);
    }
  }

  return { status: 200, headers: rlHeaders, body: { success: true, analyses } };
}

function mapLlmError(
  err: unknown,
  headers: Record<string, string>
): HandlerOutput {
  if (err instanceof LlmError) {
    const map: Record<string, number> = {
      NO_API_KEY: 500,
      TOOL_LOOP: 502
    };
    return {
      status: map[err.code] ?? 502,
      headers,
      body: { success: false, error: err.message }
    };
  }
  // Timeouts, network, rate-limit-from-provider, etc.
  const message = (err as any)?.message ?? "Upstream LLM error";
  const status =
    /timeout/i.test(message) ? 504 : /rate/i.test(message) ? 429 : 502;
  return { status, headers, body: { success: false, error: message } };
}
