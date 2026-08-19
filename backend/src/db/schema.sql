-- Silvox — requests table
-- Every proxied request gets one row here, success or error, written
-- async via BullMQ so it never blocks the response path.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id TEXT NOT NULL,
  project_id TEXT,                    -- nullable until Phase 4 tagging exists
  model TEXT NOT NULL,
  status_code INTEGER NOT NULL,       -- upstream status, or our own 502 on timeout/unreachable
  stream BOOLEAN NOT NULL DEFAULT false,
  tokens_in INTEGER,                  -- null if usage unknown (e.g. errored before usage returned)
  tokens_out INTEGER,
  tokens_estimated BOOLEAN NOT NULL DEFAULT false, -- true if fallback estimator was used, not provider usage
  cost NUMERIC(12, 8),                -- null if model wasn't in the rate card — see costCalc.ts
  rate_card_hit BOOLEAN NOT NULL DEFAULT false,
  error_type TEXT,                    -- e.g. 'api_error', 'upstream_timeout', null on success
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_api_key_id ON requests (api_key_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);

-- Silvox — budget rules
-- Caps spend per api_key or per project, checked before forwarding each
-- request (rules-engine.ts). Most severe active trigger wins if several match.

CREATE TABLE IF NOT EXISTS budget_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('api_key', 'project')),
  scope_id TEXT NOT NULL,             -- matches requests.api_key_id or requests.project_id
  period TEXT NOT NULL CHECK (period IN ('daily', 'monthly')),
  limit_usd NUMERIC(10, 4) NOT NULL CHECK (limit_usd > 0),
  action TEXT NOT NULL CHECK (action IN ('alert', 'downgrade', 'block')),
  downgrade_model TEXT,               -- required if action = 'downgrade', ignored otherwise
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_rules_scope ON budget_rules (scope_type, scope_id) WHERE active = true;

-- Logs every time a rule actually fires. Doubles as the "alert flag" for
-- alert-mode rules (no Slack until Phase 6), and as dedup source for Phase 6
-- so the same threshold-crossing doesn't re-fire Slack repeatedly.
CREATE TABLE IF NOT EXISTS budget_rule_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES budget_rules (id) ON DELETE CASCADE,
  request_id UUID REFERENCES requests (id) ON DELETE SET NULL,  -- null if action was 'block' (request never happened)
  action_taken TEXT NOT NULL,
  spend_at_trigger NUMERIC(10, 4) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_triggers_rule_period ON budget_rule_triggers (rule_id, period_start);

-- Silvox — auth: users, projects, api_keys
-- Replaces Phase 1's hardcoded dev key. requests.api_key_id / project_id
-- stay TEXT (not FK'd) — they already hold free-form values from earlier
-- phases; new rows will hold real UUIDs cast to text.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  display_prefix TEXT NOT NULL,        -- e.g. "sv_live_a1b2c3d4" — safe to show in UI
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys (project_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'solo_team', 'growth')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'expired')) DEFAULT 'active',
  amount_usd NUMERIC(10, 2) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions (user_id, created_at DESC);

-- One purchase-history row per billing event (initial purchase, renewal).
-- No real payment processor is wired to this yet — rows only exist when
-- manually inserted (e.g. via a script) until Razorpay integration lands.
CREATE TABLE IF NOT EXISTS subscription_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
  amount_usd NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'failed', 'refunded')) DEFAULT 'paid',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT -- freeform, e.g. "manually granted" until real payment data exists
);

CREATE INDEX IF NOT EXISTS idx_subscription_purchases_sub ON subscription_purchases (subscription_id, purchased_at DESC);

CREATE TABLE proxy_errors (
  id            SERIAL PRIMARY KEY,
  error_type    TEXT NOT NULL,       -- e.g. 'queue_enqueue_failed', 'db_query_failed', 'unhandled_exception'
  message       TEXT NOT NULL,
  route         TEXT,                -- e.g. '/v1/messages', '/v1/chat/completions'
  api_key_id    TEXT,                -- nullable — some failures happen before key resolution
  context       JSONB,               -- free-form extra detail (stack trace, params, etc)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proxy_errors_created_at ON proxy_errors (created_at DESC);
CREATE INDEX idx_proxy_errors_error_type ON proxy_errors (error_type);
