-- Initial business tables for local SQLite / D1-compatible development.
-- Keep provider-specific integration details in adapters; these tables store
-- platform-neutral business records and minimal AI call mirrors.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  user_agent_hash TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT,
  turnstile_passed_at TEXT,
  FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash
  ON sessions(session_token_hash);

CREATE INDEX IF NOT EXISTS idx_sessions_visitor_expires
  ON sessions(visitor_id, expires_at);

CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  word_normalized TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases)),
  categories TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(categories)),
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_words_normalized
  ON words(word_normalized);

CREATE INDEX IF NOT EXISTS idx_words_enabled_difficulty
  ON words(enabled, difficulty);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('playing', 'success', 'give_up', 'expired')),
  rule_version TEXT NOT NULL,
  model_name TEXT NOT NULL,
  thinking_mode TEXT NOT NULL CHECK (thinking_mode IN ('disabled', 'enabled')),
  guess_count INTEGER NOT NULL DEFAULT 0 CHECK (guess_count >= 0),
  best_guess_id TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ended_at TEXT,
  expires_at TEXT,
  expire_reason TEXT CHECK (expire_reason IS NULL OR expire_reason IN ('guess_limit', 'ttl')),
  FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE,
  FOREIGN KEY (answer_id) REFERENCES words(id)
);

CREATE INDEX IF NOT EXISTS idx_games_visitor_status
  ON games(visitor_id, status);

CREATE INDEX IF NOT EXISTS idx_games_answer_started
  ON games(answer_id, started_at);

CREATE TABLE IF NOT EXISTS guesses (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  guess_raw TEXT NOT NULL,
  guess_normalized TEXT NOT NULL,
  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  ai_score INTEGER CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  relation_type TEXT,
  reason TEXT,
  source TEXT NOT NULL CHECK (source IN ('exact_match', 'game_cache', 'global_cache', 'model', 'fallback')),
  counted INTEGER NOT NULL CHECK (counted IN (0, 1)),
  reject_reason TEXT,
  was_rule_adjusted INTEGER NOT NULL DEFAULT 0 CHECK (was_rule_adjusted IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guesses_game_normalized_counted
  ON guesses(game_id, guess_normalized)
  WHERE counted = 1;

CREATE INDEX IF NOT EXISTS idx_guesses_game_created
  ON guesses(game_id, created_at);

CREATE INDEX IF NOT EXISTS idx_guesses_relation_source
  ON guesses(relation_type, source);

CREATE TABLE IF NOT EXISTS score_cache (
  cache_key TEXT PRIMARY KEY,
  answer_id TEXT NOT NULL,
  guess_normalized TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  thinking_mode TEXT NOT NULL CHECK (thinking_mode IN ('disabled', 'enabled')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  ai_score INTEGER CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  relation_type TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  last_hit_at TEXT,
  FOREIGN KEY (answer_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_score_cache_identity
  ON score_cache(answer_id, guess_normalized, rule_version, model_name, thinking_mode);

CREATE TABLE IF NOT EXISTS score_feedback (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  guess_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('score_unreasonable')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (guess_id) REFERENCES guesses(id) ON DELETE CASCADE,
  FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_score_feedback_guess
  ON score_feedback(guess_id, created_at);

CREATE INDEX IF NOT EXISTS idx_score_feedback_game
  ON score_feedback(game_id, created_at);

CREATE TABLE IF NOT EXISTS ai_call_logs (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  guess_id TEXT,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  thinking_mode TEXT NOT NULL CHECK (thinking_mode IN ('disabled', 'enabled')),
  gateway_slug TEXT,
  gateway_request_id TEXT,
  provider_request_id TEXT,
  rule_version TEXT NOT NULL,
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  cache_status TEXT CHECK (cache_status IS NULL OR cache_status IN ('hit', 'miss', 'bypass')),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  estimated_cost_usd NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('success', 'timeout', 'error', 'invalid_json')),
  error_code TEXT,
  archive_object_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (guess_id) REFERENCES guesses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_call_logs_game_created
  ON ai_call_logs(game_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_call_logs_guess
  ON ai_call_logs(guess_id);

CREATE INDEX IF NOT EXISTS idx_ai_call_logs_status_created
  ON ai_call_logs(status, created_at);
