# ODM Sourcing Intelligence Agent — Web Module

Autonomous dropshipping product-validation & ODM factory-sourcing agent. Score
any product against a 10-point winning-product framework and, for winners
(score > 7), generate a complete Alibaba ODM sourcing strategy: keywords,
filters, the 3-star upgrade hack, and copy-paste supplier messages (EN/ES).

Built as a self-contained module you can drop into any Next.js (or Express) app.

## Stack
- **Frontend:** Next.js 14 (App Router) + React + Tailwind CSS
- **Backend:** Next.js route handler **or** standalone Express server
- **LLM:** Anthropic Claude **or** OpenAI GPT (function calling)
- **Cache / rate limit:** Redis (optional) with in-memory fallback
- **DB:** PostgreSQL (optional persistence + watchlist + cache table)
- **MCP:** stdio MCP server to use the agent as a subagent

## Project layout
```
system_prompt.txt                 # Agent system prompt (English, JSON-strict)
schemas/product.schema.ts         # Types + Zod validators + normalizeAnalyses()
api/
  analyze.ts                      # Framework-agnostic handler (auth/validate/cache/llm)
  cache.ts                        # Analysis cache (Redis or in-memory)
  tools/                          # Function-calling tools (Trends/Alibaba/Amazon)
app/
  api/analyze-product/route.ts    # Next.js POST endpoint
  page.tsx, layout.tsx            # Demo page mounting the module
lib/
  config.ts, auth.ts, llm.ts, rateLimit.ts, db.ts
  agent-tools.ts                  # evaluate/generate-message/keywords helpers
  mcp-server.ts                   # MCP server (3 tools)
components/
  ProductAnalyzer.jsx             # Main UI (input + dashboard + states)
  AnalysisCard.jsx                # Per-product result card
  SourcingSection.jsx             # Expandable sourcing strategy
  pdfReport.js                    # Dependency-free PDF export
server/express.ts                 # Express variant of the endpoint
database/migrations/001_init.sql  # Tables + indexes
```

## Setup
```bash
npm install
cp .env.example .env.local        # fill in at least an LLM API key + JWT_SECRET
npm run migrate                   # optional: create DB tables (needs DATABASE_URL)
npm run dev                       # http://localhost:3000
```

## API
`POST /api/analyze-product`
```
Headers: Authorization: Bearer <JWT>, Content-Type: application/json
Body:    { "products": ["Corrector de postura magnético", "Licuadora portátil"] }
200:     { "success": true, "analyses": [ { ...ProductAnalysis } ] }
4xx/5xx: { "success": false, "error": "descriptive message" }
```
- Validates input (1–5 products), enforces `RATE_LIMIT_PER_HOUR`, caches results
  for `CACHE_TTL_HOURS`, validates the LLM JSON against the schema, and recomputes
  score/verdict server-side. `sourcing.enabled` is forced to `score > 7`.

> The frontend reads a JWT from `localStorage.auth_token`. Wire this to your
> existing auth system — the module does not replace it.

## MCP (multi-agent)
Run the agent as an MCP subagent:
```bash
npm run mcp        # tsx lib/mcp-server.ts (stdio)
```
Register it in a parent orchestrator's `mcpServers` config (see the header of
`lib/mcp-server.ts`). Exposed tools: `evaluate_product`,
`generate_supplier_message`, `search_alibaba_keywords`.

## External data tools
The 3 function-calling tools use real APIs when keys are set
(`SERPAPI_KEY`, `ALIBABA_APP_KEY`, `RAINFOREST_API_KEY`). When a key is absent
the tool returns an `unavailable` flag with guidance — **it never fabricates
data**, per the agent's anti-hallucination rules.

## Integration notes (protected modules)
- Does **not** modify your auth system, existing DB, or global design system.
- DB migration only **adds** tables and references `users(id)`.
- To add to navigation, link the page that renders `<ProductAnalyzer />`.


## Static preview (no build needed)
A self-contained visual mockup lives at `preview/index.html`. It needs no
dependencies and renders the UI with sample data — handy for previewing on
mobile via an HTML viewer. The real app still requires `npm install` + an LLM
key.

## Deploy to Vercel
1. Import `andresorobio/SUPER-ECOM` in Vercel (framework auto-detected: Next.js).
2. Add the env vars from `.env.example` (at minimum an LLM key + `JWT_SECRET`).
3. Deploy. The analyze route runs as a Node serverless function (`vercel.json`
   sets `maxDuration: 60`). Use a hosted Redis/Postgres if you enable caching
   and persistence in production.

## Add to navigation
- A ready page exists at `app/tools/odm-agent/page.tsx` (route `/tools/odm-agent`).
- Drop `OdmAgentNavItem` from `components/NavIntegrationExample.jsx` into your
  sidebar to link it (does not modify your existing nav/design system).


## Super-agent capabilities
See `SUPERAGENT.md` for the full list. Highlights added on top of the core analyzer:

**New endpoints**
- `POST /api/analyze-stream` — Server-Sent Events; cards stream in as each
  product is analyzed (events: `start`, `progress`, `result`, `error`, `done`).
- `POST /api/analyze-image` — vision: send `{ imageUrl }` (https or base64 data
  URL) to identify + score a product from a screenshot/photo.
- `POST /api/generate-marketing` — `{ product, audience?, language? }` returns a
  launch kit: ad angles, hooks, ad copy, landing-page outline, UGC ideas.
- `GET /api/history` and `GET/POST/DELETE /api/watchlist` — require `DATABASE_URL`
  (return 501 otherwise).

**New function-calling tools** (auto-used by the agent)
- `profit_calculator` — unit economics, break-even ROAS/CPA, recommended price (offline).
- `compliance_risk_check` — flags batteries, IP/trademark, medical claims, vape,
  liquids, electricals affecting ads/payments/shipping (offline).
- `competitor_ad_spy` — active competitor ads via Meta Ad Library (`META_AD_LIBRARY_TOKEN`).

**New exports**: CSV and JSON (in addition to PDF) from the results dashboard.

**MCP**: also exposes `calculate_profit`, `compliance_risk_check`,
`generate_marketing_kit` to a parent orchestrator.


## Round 2 — automation & integrations
- `POST /api/monitor` — re-scan watchlist (JWT or `x-cron-secret`), webhook alert
  on new winners. Schedule it with Vercel Cron / GitHub Actions.
- `GET /api/analytics` — win-rate, verdict distribution, avg score, top products.
- New tools (auto-used by the agent): `shipping_estimator` (volumetric offline),
  `supplier_comparator` (weighted ODM supplier ranking).
- API-key auth for server-to-server (`API_KEYS="key:userId,..."`) in addition to JWT.

### Frontend now wired to the superpowers
- **Streaming**: text mode uses `/api/analyze-stream`; cards appear progressively.
- **Image mode**: paste a URL or upload a screenshot → vision analysis.
- **Per-card**: inline profit/ROAS calculator, "Generar marketing" (Winners),
  "Seguir producto" (watchlist).
