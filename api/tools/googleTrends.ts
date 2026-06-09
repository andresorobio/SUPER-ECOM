/**
 * Tool 1 — google_trends_check
 * Verifies a product's search-interest trend via Google Trends (through SerpApi).
 *
 * Real implementation: calls SerpApi's `google_trends` engine when SERPAPI_KEY
 * is configured. Without a key it returns `unavailable` (no fabricated data).
 */

import { config } from "@/lib/config";
import type { ToolDefinition, ToolResult } from "./types";

export interface GoogleTrendsArgs {
  keyword: string;
  region?: string; // e.g. "US", "MX", "CO"
  timeframe?: string; // e.g. "today 12-m"
}

export interface GoogleTrendsData {
  trend: "rising" | "stable" | "declining";
  peak_month: string;
  interest_score: number; // 0-100
}

export const googleTrendsTool: ToolDefinition<GoogleTrendsArgs, GoogleTrendsData> = {
  schema: {
    name: "google_trends_check",
    description:
      "Verifica la tendencia de búsqueda de un producto en Google Trends.",
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Search term to evaluate" },
        region: {
          type: "string",
          description: "ISO-ish region code, e.g. US, MX, CO. Empty = worldwide"
        },
        timeframe: {
          type: "string",
          description: 'Google Trends timeframe, e.g. "today 12-m"'
        }
      },
      required: ["keyword"]
    }
  },

  async execute(args): Promise<ToolResult<GoogleTrendsData>> {
    const { keyword, region = "", timeframe = "today 12-m" } = args;
    if (!config.tools.serpApiKey) {
      return {
        ok: false,
        unavailable: true,
        note: "SERPAPI_KEY not configured; Google Trends data unavailable. Reason qualitatively about seasonality instead of inventing numbers."
      };
    }

    try {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_trends");
      url.searchParams.set("q", keyword);
      url.searchParams.set("data_type", "TIMESERIES");
      url.searchParams.set("date", timeframe);
      if (region) url.searchParams.set("geo", region);
      url.searchParams.set("api_key", config.tools.serpApiKey);

      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) {
        return { ok: false, error: `SerpApi responded ${res.status}` };
      }
      const json: any = await res.json();
      const timeline: any[] = json?.interest_over_time?.timeline_data ?? [];
      if (timeline.length === 0) {
        return { ok: false, error: "No timeline data returned" };
      }

      const values = timeline.map((p) => Number(p.values?.[0]?.extracted_value ?? 0));
      const peakIndex = values.indexOf(Math.max(...values));
      const peakMonth = timeline[peakIndex]?.date ?? "unknown";

      // Trend = compare avg of last third vs first third of the window.
      const third = Math.max(1, Math.floor(values.length / 3));
      const firstAvg = avg(values.slice(0, third));
      const lastAvg = avg(values.slice(-third));
      const delta = lastAvg - firstAvg;
      const trend: GoogleTrendsData["trend"] =
        delta > 5 ? "rising" : delta < -5 ? "declining" : "stable";

      return {
        ok: true,
        data: {
          trend,
          peak_month: peakMonth,
          interest_score: Math.round(lastAvg)
        }
      };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Google Trends request failed" };
    }
  }
};

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
