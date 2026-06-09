/**
 * Centralized runtime configuration, read from environment variables.
 * All values have safe defaults so the module boots even with a partial .env.
 */

export const config = {
  llm: {
    provider: (process.env.LLM_PROVIDER ?? inferProvider()) as
      | "anthropic"
      | "openai",
    model: process.env.LLM_MODEL ?? "claude-opus-4-6",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 30_000),
    maxTokens: Number(process.env.LLM_MAX_TOKENS ?? 4096)
  },
  limits: {
    maxProductsPerRequest: Number(process.env.MAX_PRODUCTS_PER_REQUEST ?? 5),
    rateLimitPerHour: Number(process.env.RATE_LIMIT_PER_HOUR ?? 10),
    cacheTtlHours: Number(process.env.CACHE_TTL_HOURS ?? 24),
    minScoreForSourcing: Number(process.env.MIN_SCORE_FOR_SOURCING ?? 7)
  },
  infra: {
    redisUrl: process.env.REDIS_URL ?? "",
    databaseUrl: process.env.DATABASE_URL ?? "",
    jwtSecret: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me"
  },
  tools: {
    serpApiKey: process.env.SERPAPI_KEY ?? "",
    alibabaAppKey: process.env.ALIBABA_APP_KEY ?? "",
    rainforestApiKey: process.env.RAINFOREST_API_KEY ?? ""
  }
};

function inferProvider(): "anthropic" | "openai" {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "anthropic";
}

export type AppConfig = typeof config;
