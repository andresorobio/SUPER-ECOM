/**
 * POST /api/generate-marketing
 * Body: { product: string, audience?: string, language?: "es" | "en" }
 * Returns: { success: true, kit: MarketingKit }
 *
 * Auth + rate-limited like the analyze endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticate, AuthError } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateMarketingKit } from "@/lib/marketing";
import { LlmError } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = authenticate(req.headers.get("authorization"));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    throw err;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.product || typeof body.product !== "string") {
    return NextResponse.json(
      { success: false, error: "Field 'product' is required" },
      { status: 400 }
    );
  }

  const rl = await checkRateLimit(user.userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  try {
    const kit = await generateMarketingKit({
      product: body.product.trim(),
      audience: typeof body.audience === "string" ? body.audience : undefined,
      language: body.language === "en" ? "en" : "es"
    });
    return NextResponse.json({ success: true, kit });
  } catch (err: any) {
    const status = err instanceof LlmError && err.code === "NO_API_KEY" ? 500 : 502;
    return NextResponse.json(
      { success: false, error: err?.message ?? "Marketing generation failed" },
      { status }
    );
  }
}
