/**
 * Optional Postgres persistence (Deliverable 6 companion).
 * Lazily creates a pooled connection only when DATABASE_URL is configured.
 * All writes are best-effort and never block/break the analyze request.
 */

import { config } from "@/lib/config";
import type { ProductAnalysis } from "@/schemas/product.schema";

let pool: any = null;

function getPool(): any | null {
  if (!config.infra.databaseUrl) return null;
  if (pool) return pool;
  try {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: config.infra.databaseUrl });
  } catch {
    pool = null;
  }
  return pool;
}

export async function persistAnalysis(
  userId: string,
  analysis: ProductAnalysis
): Promise<void> {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      `INSERT INTO product_analyses (user_id, product_name, score, verdict, full_analysis)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        analysis.product_name,
        analysis.score,
        analysis.verdict,
        JSON.stringify(analysis)
      ]
    );
  } catch {
    /* best-effort: ignore persistence errors */
  }
}

export async function getRecentAnalyses(
  userId: string,
  limit = 20
): Promise<ProductAnalysis[]> {
  const p = getPool();
  if (!p) return [];
  try {
    const { rows } = await p.query(
      `SELECT full_analysis FROM product_analyses
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return rows.map((r: any) => r.full_analysis as ProductAnalysis);
  } catch {
    return [];
  }
}

/* ------------------------------ Watchlist --------------------------------- */

export interface WatchlistItem {
  id: string;
  product_name: string;
  notes: string | null;
  added_at: string;
}

export async function addToWatchlist(
  userId: string,
  productName: string,
  notes = ""
): Promise<WatchlistItem | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const { rows } = await p.query(
      `INSERT INTO product_watchlist (user_id, product_name, notes)
       VALUES ($1, $2, $3)
       RETURNING id, product_name, notes, added_at`,
      [userId, productName, notes || null]
    );
    return rows[0] as WatchlistItem;
  } catch {
    return null;
  }
}

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  const p = getPool();
  if (!p) return [];
  try {
    const { rows } = await p.query(
      `SELECT id, product_name, notes, added_at FROM product_watchlist
       WHERE user_id = $1 ORDER BY added_at DESC`,
      [userId]
    );
    return rows as WatchlistItem[];
  } catch {
    return [];
  }
}

export async function removeFromWatchlist(
  userId: string,
  id: string
): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    const res = await p.query(
      `DELETE FROM product_watchlist WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return (res.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/** True when a database is configured (used by routes to return 501 otherwise). */
export function isDbConfigured(): boolean {
  return Boolean(getPool());
}

/* ------------------------------ Analytics --------------------------------- */

export interface AnalyticsSummary {
  total_analyses: number;
  winners: number;
  tests: number;
  discards: number;
  win_rate_pct: number;
  avg_score: number;
  top_products: { product_name: string; count: number; avg_score: number }[];
}

export async function getAnalyticsSummary(userId: string): Promise<AnalyticsSummary> {
  const empty: AnalyticsSummary = {
    total_analyses: 0,
    winners: 0,
    tests: 0,
    discards: 0,
    win_rate_pct: 0,
    avg_score: 0,
    top_products: []
  };
  const p = getPool();
  if (!p) return empty;
  try {
    const totals = await p.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE verdict = 'Winner')::int AS winners,
         COUNT(*) FILTER (WHERE verdict = 'Test')::int AS tests,
         COUNT(*) FILTER (WHERE verdict = 'Discard')::int AS discards,
         COALESCE(AVG(score), 0)::float AS avg_score
       FROM product_analyses WHERE user_id = $1`,
      [userId]
    );
    const top = await p.query(
      `SELECT product_name, COUNT(*)::int AS count, COALESCE(AVG(score),0)::float AS avg_score
       FROM product_analyses WHERE user_id = $1
       GROUP BY product_name ORDER BY count DESC, avg_score DESC LIMIT 10`,
      [userId]
    );
    const t = totals.rows[0];
    const total = t.total ?? 0;
    return {
      total_analyses: total,
      winners: t.winners ?? 0,
      tests: t.tests ?? 0,
      discards: t.discards ?? 0,
      win_rate_pct: total ? Math.round(((t.winners ?? 0) / total) * 1000) / 10 : 0,
      avg_score: Math.round((t.avg_score ?? 0) * 10) / 10,
      top_products: top.rows.map((r: any) => ({
        product_name: r.product_name,
        count: r.count,
        avg_score: Math.round(r.avg_score * 10) / 10
      }))
    };
  } catch {
    return empty;
  }
}
