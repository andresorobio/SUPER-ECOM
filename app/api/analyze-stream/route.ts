/**
 * POST /api/analyze-stream  (Server-Sent Events)
 * Body: { products: string[] }
 *
 * Streams progress so the UI can render each card the moment it's ready instead
 * of waiting for the whole batch. Emits these SSE events:
 *   event: start    data: { total }
 *   event: progress data: { index, product, status: "analyzing" }
 *   event: result   data: { index, analysis }
 *   event: error    data: { index, product, error }
 *   event: done     data: { count }
 *
 * Auth + rate limit identical to the JSON endpoint.
 */

import { NextRequest } from "next/server";
import { authenticate, AuthError } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCachedAnalysis, setCachedAnalysis } from "@/api/cache";
import { evaluateProduct } from "@/lib/agent-tools";
import { persistAnalysis } from "@/lib/db";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Auth
  let userId: string;
  try {
    userId = authenticate(req.headers.get("authorization")).userId;
  } catch (err) {
    const msg = err instanceof AuthError ? err.message : "Unauthorized";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Parse + validate
  let products: string[] = [];
  try {
    const body = await req.json();
    products = Array.isArray(body?.products)
      ? body.products.map((p: unknown) => (typeof p === "string" ? p.trim() : "")).filter(Boolean)
      : [];
  } catch {
    /* ignore */
  }
  if (products.length === 0) {
    return jsonError("Provide at least one product name", 400);
  }
  if (products.length > config.limits.maxProductsPerRequest) {
    return jsonError(`Maximum ${config.limits.maxProductsPerRequest} products per request`, 400);
  }

  const rl = await checkRateLimit(userId);
  if (!rl.allowed) return jsonError("Rate limit exceeded", 429);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("start", { total: products.length });

      let count = 0;
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        send("progress", { index: i, product, status: "analyzing" });
        try {
          const cached = await getCachedAnalysis(product);
          const analysis = cached ?? (await evaluateProduct(product));
          if (!cached) {
            await setCachedAnalysis(analysis.product_name, analysis);
            await persistAnalysis(userId, analysis);
          }
          send("result", { index: i, analysis });
          count++;
        } catch (err: any) {
          send("error", { index: i, product, error: err?.message ?? "analysis failed" });
        }
      }

      send("done", { count });
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
