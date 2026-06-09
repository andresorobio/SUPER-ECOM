/**
 * Analytics summary  (requires DATABASE_URL)
 *   GET /api/analytics -> { success, summary }
 * Aggregates the user's analysis history: totals, verdict distribution,
 * average score, and most-analyzed categories/terms.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticate, AuthError } from "@/lib/auth";
import { getAnalyticsSummary, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req.headers.get("authorization"));
    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, error: "Persistence not configured (set DATABASE_URL)" },
        { status: 501 }
      );
    }
    const summary = await getAnalyticsSummary(user.userId);
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: (err as any)?.message ?? "Request failed" },
      { status: 500 }
    );
  }
}
