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
