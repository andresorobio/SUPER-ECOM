/**
 * History API (requires DATABASE_URL).
 *   GET /api/history?limit=20  -> { success, analyses }
 * Returns the user's most recent saved analyses.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticate, AuthError } from "@/lib/auth";
import { getRecentAnalyses, isDbConfigured } from "@/lib/db";

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
    const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), 100) : 20;
    const analyses = await getRecentAnalyses(user.userId, limit);
    return NextResponse.json({ success: true, analyses });
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
