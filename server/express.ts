/**
 * Deliverable 3A (Express variant) — standalone Node.js / Express server.
 *
 * Use this if you prefer Express over the Next.js route. Same handler, same
 * validation, caching, rate limiting and error handling.
 *
 *   POST /api/analyze-product
 *   Headers: { Authorization: "Bearer <JWT>", Content-Type: "application/json" }
 *   Body:    { products: ["Corrector de postura magnético", "Licuadora portátil"] }
 *   200:     { success: true, analyses: [ ...ProductAnalysis ] }
 *
 * Run with:  tsx server/express.ts   (or compile then node)
 */

import express, { type Request, type Response } from "express";
import { handleAnalyze } from "@/api/analyze";

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/analyze-product", async (req: Request, res: Response) => {
  const result = await handleAnalyze({
    authorization: req.header("authorization"),
    body: req.body
  });
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  }
  res.status(result.status).json(result.body);
});

const PORT = Number(process.env.PORT ?? 3001);

// Only auto-listen when run directly (not when imported in tests).
if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`analyze-product API listening on :${PORT}`);
  });
}

export { app };
