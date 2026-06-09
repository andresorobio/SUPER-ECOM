/**
 * Trend monitor / re-scan  (cron-able)
 *   POST /api/monitor   -> re-evaluates the caller's watchlist and fires a
 *   webhook alert for any product that is now a Winner (score >= 8).
 *
 * Auth: standard user JWT, OR a cron secret via `x-cron-secret: <CRON_SECRET>`
 * header (so a scheduler like Vercel Cron / GitHub Actions can trigger it).
 * When using the cron secret, pass `?userId=<uuid>` to choose whose watchlist.
 *
 * Requires DATABASE_URL (for the watchlist). Webhook needs WEBHOOK_URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticate, AuthError } from "@/lib/auth";
import { getWatchlist, persistAnalysis, isDbConfigured } from "@/lib/db";
import { evaluateProduct } from "@/lib/agent-tools";
import { setCachedAnalysis } from "@/api/cache";
import { sendWebhook } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Resolve the user either from JWT or from the cron secret.
  let userId: string | null = null;
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId query param required with cron secret" },
        { status: 400 }
      );
    }
  } else {
    try {
      userId = authenticate(req.headers.get("authorization")).userId;
    } catch (err) {
      const msg = err instanceof AuthError ? err.message : "Unauthorized";
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
    }
  }

  if (!isDbConfigured()) {
    return NextResponse.json(
      { success: false, error: "Persistence not configured (set DATABASE_URL)" },
      { status: 501 }
    );
  }

  const items = await getWatchlist(userId);
  const alerts: { product: string; score: number }[] = [];
  const scanned: { product: string; score: number; verdict: string }[] = [];

  for (const item of items) {
    try {
      const analysis = await evaluateProduct(item.product_name);
      await setCachedAnalysis(analysis.product_name, analysis);
      await persistAnalysis(userId, analysis);
      scanned.push({
        product: analysis.product_name,
        score: analysis.score,
        verdict: analysis.verdict
      });
      if (analysis.score >= 8) {
        alerts.push({ product: analysis.product_name, score: analysis.score });
      }
    } catch {
      /* skip individual failures */
    }
  }

  if (alerts.length > 0) {
    await sendWebhook({ event: "watchlist.winners", userId, alerts });
  }

  return NextResponse.json({ success: true, scanned, alerts });
}
