/**
 * Tool 2 — alibaba_product_search
 * Searches ODM manufacturers on Alibaba with specific filters.
 *
 * Alibaba's official Open Platform API requires app key + signed requests.
 * This implementation calls the configured endpoint when ALIBABA_APP_KEY is
 * present; otherwise returns `unavailable` (no fabricated suppliers/URLs).
 */

import { config } from "@/lib/config";
import type { ToolDefinition, ToolResult } from "./types";

export interface AlibabaSearchArgs {
  keyword: string;
  filters?: string[]; // e.g. ["ODM","R&D","Verified"]
  min_rating?: number;
}

export interface AlibabaSupplier {
  name: string;
  url: string;
  rating?: number;
  moq?: number;
  verified?: boolean;
}

export interface AlibabaSearchData {
  suppliers_found: number;
  top_results: AlibabaSupplier[];
  avg_moq: number;
}

export const alibabaSearchTool: ToolDefinition<AlibabaSearchArgs, AlibabaSearchData> = {
  schema: {
    name: "alibaba_product_search",
    description: "Busca fabricantes ODM en Alibaba con filtros específicos.",
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Product search keyword (English)" },
        filters: {
          type: "array",
          items: { type: "string" },
          description: 'Filters to apply, e.g. ["ODM","R&D","Verified"]'
        },
        min_rating: { type: "number", description: "Minimum supplier rating 0-5" }
      },
      required: ["keyword"]
    }
  },

  async execute(args): Promise<ToolResult<AlibabaSearchData>> {
    const { keyword, filters = [], min_rating = 0 } = args;
    const endpoint = process.env.ALIBABA_API_ENDPOINT;

    if (!config.tools.alibabaAppKey || !endpoint) {
      return {
        ok: false,
        unavailable: true,
        note: "ALIBABA_APP_KEY / ALIBABA_API_ENDPOINT not configured; supplier search unavailable. Provide search keywords & filters for the user to run manually instead of inventing suppliers."
      };
    }

    try {
      const url = new URL(endpoint);
      url.searchParams.set("appKey", config.tools.alibabaAppKey);
      url.searchParams.set("keyword", keyword);
      if (filters.length) url.searchParams.set("filters", filters.join(","));
      if (min_rating) url.searchParams.set("minRating", String(min_rating));

      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return { ok: false, error: `Alibaba API responded ${res.status}` };

      const json: any = await res.json();
      const suppliers: AlibabaSupplier[] = (json?.suppliers ?? []).map((s: any) => ({
        name: s.companyName ?? s.name,
        url: s.productUrl ?? s.url,
        rating: s.rating,
        moq: s.minOrderQuantity ?? s.moq,
        verified: Boolean(s.verified)
      }));

      const moqs = suppliers.map((s) => s.moq ?? 0).filter((m) => m > 0);
      const avgMoq = moqs.length ? Math.round(moqs.reduce((a, b) => a + b, 0) / moqs.length) : 0;

      return {
        ok: true,
        data: {
          suppliers_found: json?.total ?? suppliers.length,
          top_results: suppliers.slice(0, 10),
          avg_moq: avgMoq
        }
      };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Alibaba request failed" };
    }
  }
};
