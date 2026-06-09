/**
 * Marketing / creative generator (LLM-backed).
 *
 * Turns a winning product into a launch kit: ad angles, scroll-stopping hooks,
 * primary ad copy variants, and a landing-page outline. Returns strict JSON.
 */

import { runJsonCompletion } from "@/lib/llm";

export interface MarketingInput {
  product: string;
  audience?: string;
  language?: "es" | "en";
}

export interface MarketingKit {
  product: string;
  angles: { name: string; description: string }[];
  hooks: string[];
  ad_copy: { headline: string; primary_text: string; cta: string }[];
  landing_page_outline: string[];
  ugc_video_ideas: string[];
}

const SYSTEM = `You are a world-class direct-response marketer for e-commerce/dropshipping.
You write punchy, conversion-focused creative that stops the scroll. You never use
filler. Return ONLY a valid JSON object, no markdown, with EXACTLY these keys:
{
  "product": string,
  "angles": [{ "name": string, "description": string }],        // 3-4 distinct positioning angles
  "hooks": [string],                                            // 5 scroll-stopping first-3-seconds hooks
  "ad_copy": [{ "headline": string, "primary_text": string, "cta": string }], // 3 variants
  "landing_page_outline": [string],                             // ordered sections of a high-converting LP
  "ugc_video_ideas": [string]                                   // 3 short-form UGC concepts
}
Write all output in the requested language. Be specific to the product; no generic boilerplate.`;

export async function generateMarketingKit(input: MarketingInput): Promise<MarketingKit> {
  const lang = input.language === "en" ? "English" : "Spanish";
  const user = [
    `Product: ${input.product}`,
    input.audience ? `Target audience: ${input.audience}` : "Target audience: infer the best-fit buyer",
    `Output language: ${lang}`,
    `Generate the full marketing kit as the specified JSON object.`
  ].join("\n");

  const raw = await runJsonCompletion({ system: SYSTEM, user });
  const parsed = JSON.parse(raw);
  // Guarantee shape with safe fallbacks.
  return {
    product: parsed.product ?? input.product,
    angles: Array.isArray(parsed.angles) ? parsed.angles : [],
    hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
    ad_copy: Array.isArray(parsed.ad_copy) ? parsed.ad_copy : [],
    landing_page_outline: Array.isArray(parsed.landing_page_outline)
      ? parsed.landing_page_outline
      : [],
    ugc_video_ideas: Array.isArray(parsed.ugc_video_ideas) ? parsed.ugc_video_ideas : []
  };
}
