-- Deliverable 6 — Database schema for the ODM Sourcing Intelligence module.
-- Idempotent: safe to run multiple times.
-- PROTECTED MODULES: does NOT touch the existing `users` table or auth system;
-- it only references users(id) and adds new tables.

-- Needed for gen_random_uuid() on PostgreSQL < 13. (pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Saved analyses per user
CREATE TABLE IF NOT EXISTS product_analyses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  product_name  VARCHAR(200) NOT NULL,
  score         SMALLINT CHECK (score >= 0 AND score <= 10),
  verdict       VARCHAR(10) CHECK (verdict IN ('Winner','Test','Discard')),
  full_analysis JSONB NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Products flagged as favorites for follow-up
CREATE TABLE IF NOT EXISTS product_watchlist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  product_name  VARCHAR(200) NOT NULL,
  notes         TEXT,
  added_at      TIMESTAMP DEFAULT NOW()
);

-- Analysis cache to avoid repeated LLM calls
CREATE TABLE IF NOT EXISTS analysis_cache (
  product_hash  VARCHAR(64) PRIMARY KEY,
  result        JSONB NOT NULL,
  expires_at    TIMESTAMP NOT NULL
);

-- Indexes for frequent lookups
CREATE INDEX IF NOT EXISTS idx_analyses_user
  ON product_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_verdict
  ON product_analyses(verdict);
CREATE INDEX IF NOT EXISTS idx_cache_expires
  ON analysis_cache(expires_at);
