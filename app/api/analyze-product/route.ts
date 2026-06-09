/**
 * Next.js App Router endpoint: POST /api/analyze-product
 * Thin adapter over the framework-agnostic handler in api/analyze.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleAnalyze } from "@/api/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const result = await handleAnalyze({
    authorization: req.headers.get("authorization"),
    body
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers
  });
}
