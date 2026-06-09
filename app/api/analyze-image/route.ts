/**
 * POST /api/analyze-image  (Vision superpower)
 * Body: { imageUrl: string, hint?: string }
 *   - imageUrl: a remote https URL OR a base64 data URL (data:image/...;base64,...)
 *   - hint: optional extra context ("seen on TikTok", a niche, etc.)
 *
 * The agent identifies the product from the image, then scores it with the
 * same 10-criteria framework. Returns { success, productGuess, analysis }.
 *
 * Useful for: screenshot a viral TikTok/Reel or an AliExpress photo and get an
 * instant winner-product verdict without typing the name.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticate, AuthError } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { runJsonCompletion, getSystemPrompt, LlmError } from "@/lib/llm";
import { normalizeAnalyses } from "@/schemas/product.schema";

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

  const imageUrl = body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json(
      { success: false, error: "Field 'imageUrl' (https or data URL) is required" },
      { status: 400 }
    );
  }

  const rl = await checkRateLimit(user.userId);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  // Reuse the full agent system prompt, plus an instruction to identify first.
  const system =
    getSystemPrompt() +
    '\n\n[VISION_MODE]\nFirst identify the product shown in the image, then run the full ' +
    'analysis. Return JSON: { "analyses": [ <one product object> ] } where ' +
    'product_name is your best identification of the pictured product.';

  const user_text = [
    "Identify the product in this image and analyze it with the 10-criteria framework.",
    body.hint ? `Extra context: ${body.hint}` : "",
    'Return ONLY the JSON object { "analyses": [ ... ] }.'
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await runJsonCompletion({ system, user: user_text, imageUrl });
    const analyses = normalizeAnalyses(JSON.parse(raw));
    if (analyses.length === 0) {
      return NextResponse.json(
        { success: false, error: "Could not analyze the image" },
        { status: 502 }
      );
    }
    return NextResponse.json({
      success: true,
      productGuess: analyses[0].product_name,
      analysis: analyses[0]
    });
  } catch (err: any) {
    const status = err instanceof LlmError && err.code === "NO_API_KEY" ? 500 : 502;
    return NextResponse.json(
      { success: false, error: err?.message ?? "Image analysis failed" },
      { status }
    );
  }
}
