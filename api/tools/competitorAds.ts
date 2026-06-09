/**
 * Tool — competitor_ad_spy
 * Finds active competitor ads for a product via the Meta (Facebook/Instagram)
 * Ad Library API. Reveals demand, angles, and saturation — the closest thing
 * to "are people already selling this with paid ads?".
 *
 * Uses META_AD_LIBRARY_TOKEN when present; otherwise returns `unavailable`
 * with guidance (never fabricates ads). TikTok Creative Center can be wired in
 * the same way via TIKTOK_ADS_TOKEN.
 */

import type { ToolDefinition, ToolResult } from "./types";

export interface CompetitorAdsArgs {
  keyword: string;
  /** ISO country code, e.g. "US", "MX", "CO". Defaults to "US". */
  country?: string;
  limit?: number;
}

export interface AdCreative {
  page_name: string;
  ad_snapshot_url?: string;
  body?: string;
  started_running?: string;
}

export interface CompetitorAdsData {
  ads_found: number;
  active_advertisers: number;
  saturation: "low" | "medium" | "high";
  top_ads: AdCreative[];
}

export const competitorAdsTool: ToolDefinition<CompetitorAdsArgs, CompetitorAdsData> = {
  schema: {
    name: "competitor_ad_spy",
    description:
      "Busca anuncios activos de competidores (Meta Ad Library) para medir demanda, ángulos y saturación de un producto.",
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Product/search term" },
        country: { type: "string", description: "ISO country code (US, MX, CO...)" },
        limit: { type: "number", description: "Max ads to return (default 15)" }
      },
      required: ["keyword"]
    }
  },

  async execute(args): Promise<ToolResult<CompetitorAdsData>> {
    const { keyword, country = "US", limit = 15 } = args ?? {};
    const token = process.env.META_AD_LIBRARY_TOKEN;

    if (!keyword) return { ok: false, error: "keyword is required" };
    if (!token) {
      return {
        ok: false,
        unavailable: true,
        note: "META_AD_LIBRARY_TOKEN not configured; competitor ad data unavailable. Reason qualitatively about saturation from category knowledge instead of inventing ads."
      };
    }

    try {
      const url = new URL("https://graph.facebook.com/v19.0/ads_archive");
      url.searchParams.set("access_token", token);
      url.searchParams.set("search_terms", keyword);
      url.searchParams.set("ad_reached_countries", `["${country}"]`);
      url.searchParams.set("ad_active_status", "ACTIVE");
      url.searchParams.set("ad_type", "ALL");
      url.searchParams.set("limit", String(Math.min(limit, 50)));
      url.searchParams.set(
        "fields",
        "page_name,ad_snapshot_url,ad_creative_bodies,ad_delivery_start_time"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return { ok: false, error: `Meta Ad Library responded ${res.status}` };

      const json: any = await res.json();
      const data: any[] = json?.data ?? [];

      const top_ads: AdCreative[] = data.map((d) => ({
        page_name: d.page_name,
        ad_snapshot_url: d.ad_snapshot_url,
        body: Array.isArray(d.ad_creative_bodies) ? d.ad_creative_bodies[0] : undefined,
        started_running: d.ad_delivery_start_time
      }));

      const advertisers = new Set(top_ads.map((a) => a.page_name)).size;
      const saturation: CompetitorAdsData["saturation"] =
        data.length >= 25 ? "high" : data.length >= 8 ? "medium" : "low";

      return {
        ok: true,
        data: {
          ads_found: data.length,
          active_advertisers: advertisers,
          saturation,
          top_ads: top_ads.slice(0, limit)
        }
      };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Ad library request failed" };
    }
  }
};
