-- ============================================================
-- Social Autopilot — Migration: multi-account + batch support
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Extend accounts table with per-account Typefully key
--    and editorial configuration fields
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS typefully_api_key    TEXT,
  ADD COLUMN IF NOT EXISTS niche                TEXT,
  ADD COLUMN IF NOT EXISTS subniche             TEXT,
  ADD COLUMN IF NOT EXISTS system_prompt        TEXT,
  ADD COLUMN IF NOT EXISTS tone                 TEXT    DEFAULT 'casual',
  ADD COLUMN IF NOT EXISTS language             TEXT    DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS evergreen_only       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tweets_per_day_default INTEGER DEFAULT 5;

-- 2. Create content_batches table
--    One batch = one generation run for one account over N days
CREATE TABLE IF NOT EXISTS content_batches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  topic           TEXT        NOT NULL,
  start_date      DATE        NOT NULL,
  days            INTEGER     NOT NULL DEFAULT 30,
  tweets_per_day  INTEGER     NOT NULL DEFAULT 5,
  total_tweets    INTEGER     NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','generating','scheduled','completed','failed')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Add batch_id to ai_generated_posts
ALTER TABLE ai_generated_posts
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES content_batches(id) ON DELETE SET NULL;

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_content_batches_account_id
  ON content_batches(account_id);

CREATE INDEX IF NOT EXISTS idx_ai_generated_posts_batch_id
  ON ai_generated_posts(batch_id);

CREATE INDEX IF NOT EXISTS idx_ai_generated_posts_scheduled_time
  ON ai_generated_posts(scheduled_time);

-- 5. Auto-update updated_at on content_batches
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_content_batches_updated_at ON content_batches;
CREATE TRIGGER set_content_batches_updated_at
  BEFORE UPDATE ON content_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
