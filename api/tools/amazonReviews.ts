/**
 * Tool 3 — amazon_reviews_analyzer
 * Extracts complaint patterns from 3-star Amazon reviews (the "3-star hack").
 *
 * Uses the Rainforest API when RAINFOREST_API_KEY is configured; otherwise
 * returns `unavailable` (no fabricated reviews/complaints).
 */

import { config } from "@/lib/config";
import type { ToolDefinition, ToolResult } from "./types";

export interface AmazonReviewsArgs {
  product_name: string;
  asin?: string;
}

export interface AmazonReviewsData {
  top_complaints: string[];
  improvement_opportunities: string[];
  sentiment_score: number; // -1..1
}

export const amazonReviewsTool: ToolDefinition<AmazonReviewsArgs, AmazonReviewsData> = {
  schema: {
    name: "amazon_reviews_analyzer",
    description: "Extrae patrones de quejas de reseñas de 3 estrellas en Amazon.",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "Product name to search" },
        asin: { type: "string", description: "Optional Amazon ASIN to target directly" }
      },
      required: ["product_name"]
    }
  },

  async execute(args): Promise<ToolResult<AmazonReviewsData>> {
    const { product_name, asin } = args;
    if (!config.tools.rainforestApiKey) {
      return {
        ok: false,
        unavailable: true,
        note: "RAINFOREST_API_KEY not configured; live Amazon review mining unavailable. Derive likely 3-star complaints from category knowledge and label them as heuristic, not as scraped data."
      };
    }

    try {
      // Resolve ASIN if only a name was provided.
      let targetAsin = asin;
      if (!targetAsin) {
        const searchUrl = new URL("https://api.rainforestapi.com/request");
        searchUrl.searchParams.set("api_key", config.tools.rainforestApiKey);
        searchUrl.searchParams.set("type", "search");
        searchUrl.searchParams.set("amazon_domain", "amazon.com");
        searchUrl.searchParams.set("search_term", product_name);
        const sres = await fetch(searchUrl, { signal: AbortSignal.timeout(15_000) });
        const sjson: any = await sres.json();
        targetAsin = sjson?.search_results?.[0]?.asin;
        if (!targetAsin) return { ok: false, error: "Could not resolve an ASIN" };
      }

      const url = new URL("https://api.rainforestapi.com/request");
      url.searchParams.set("api_key", config.tools.rainforestApiKey);
      url.searchParams.set("type", "reviews");
      url.searchParams.set("amazon_domain", "amazon.com");
      url.searchParams.set("asin", targetAsin);
      url.searchParams.set("review_stars", "three_star");
      url.searchParams.set("sort_by", "most_helpful");

      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return { ok: false, error: `Rainforest responded ${res.status}` };

      const json: any = await res.json();
      const reviews: any[] = json?.reviews ?? [];
      const complaints = reviews
        .map((r) => (r.title ? `${r.title}: ` : "") + (r.body ?? ""))
        .filter(Boolean)
        .slice(0, 8);

      return {
        ok: true,
        data: {
          top_complaints: complaints.slice(0, 5),
          improvement_opportunities: [],
          sentiment_score: 0 // neutral baseline; 3-star = mixed sentiment
        },
        note: "Raw 3-star review excerpts returned; summarize the recurring complaints and turn them into an upgrade-to-demand spec."
      };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Amazon reviews request failed" };
    }
  }
};
