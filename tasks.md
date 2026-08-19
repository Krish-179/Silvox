# Silvox — Task List

Update only individual checkboxes as you go. Don't regenerate this file's structure/wording — just flip `[ ]` to `[x]` and add a short note if needed.

## Phase 0 — Setup

- [x] Create monorepo root with `backend/`, `frontend/`, `mock-provider/`
      as sibling folders (or separate repos if you prefer — pick one and
      don't switch later)
- [x] Backend folder structure (Fastify):
      `     backend/
    src/
      routes/          (proxy route, rules route, keys route)
      services/         (cost calc, token counting, rate card)
      middleware/       (auth, budget-check)
      db/               (postgres client, schema/migrations)
      queue/             (BullMQ jobs: log-request, send-alert)
      config.ts          (reads single .env)
      server.ts           (Fastify app entry)
    .env
    package.json
    tsconfig.json
  `
- [x] Frontend folder structure (Next.js):
      `     frontend/
    app/
      dashboard/         (spend charts, breakdown)
      rules/              (budget rule management)
      keys/                (API key management)
      login/
    components/
    lib/                   (API client to talk to backend)
    .env.local
    package.json
    tailwind.config.ts
  `
- [x] Mock provider folder structure:
      `     mock-provider/
    server.ts             (fake SSE responses, matches Anthropic format)
    package.json
  `
- [x] Single `.env` in backend root — BASE_URL, DB_URL, REDIS_URL, JWT_SECRET
- [x] Init TS in each folder (tsconfig, eslint/prettier) — keep consistent
      config across backend/frontend where possible
- [x] Set up local Postgres (or Neon branch) and local Redis (or Upstash)
- [x] Build the mock provider server itself (implementation, not just the
      folder) — fake SSE chunks matching Anthropic's format, runs on its
      own port, BASE_URL in .env points here initially

## Phase 1 — Bare Passthrough Proxy (against mock server)

- [x] Fastify route that forwards POST /v1/messages to upstream BASE_URL
- [x] Confirm non-streaming request/response passthrough works end-to-end
- [x] Confirm streaming (SSE) passthrough forwards chunks live, no buffering
- [x] Confirm error passthrough (mock returns 500) doesn't crash proxy
- [x] Confirm timeout/hang handling (mock hangs) fails fast, doesn't hang forever
- [x] Hardcoded single dev API key in middleware (placeholder auth, just
      enough to populate api_key_id for Phase 2 logging — full auth is Phase 4)

## Phase 2 — Logging + Cost Calculation

- [x] Postgres schema: requests(id, api_key_id, project_id, model,
      tokens_in, tokens_out, cost, created_at)
- [x] Accumulate streamed chunks server-side while forwarding, count tokens
      after stream ends
- [x] Hardcoded rate card table (model → $/1k tokens in, $/1k tokens out)
- [x] Write cost calc function, unit test against known fixed-prompt example
- [x] Log every request (success and error) to Postgres via BullMQ job
      (don't block the response path on the DB write)

## Phase 3 — Budget Rules Engine

- [x] Rules table: scope (api_key/project), limit, period (daily/monthly),
      action (alert/downgrade/block)
- [x] Pre-request check: sum current period spend for scope, compare to rule
- [x] Alert-only mode (default) — log a flag, don't interfere with request
- [x] Downgrade mode — swap model param before forwarding if over limit
- [x] Block mode — return 429 with clear error message if over limit
- [x] Seed-based testing: insert fake historical spend rows, verify each
      mode triggers correctly without needing real spend

## Phase 4 — Auth / API Keys

- [x] Dashboard login (human) — email/password with JWT in httpOnly cookie,
      or magic link email; bcrypt for password hashing if used
- [x] Proxy key (machine) — generate `sv_live_xxxx` style key on project
      creation, store hash only (never raw key) in Postgres
- [x] Middleware: validate incoming Bearer key against stored hash, resolve
      to project_id, attach to request context — replaces the Phase 1
      hardcoded dev key
- [x] Basic key rotation/revocation (regenerate, invalidate old one)

## Phase 5 — Dashboard (Next.js + Tailwind)

- [x] Read frontend-design skill before building any screen
- [x] Login / register screen
- [x] API key management UI (view, rotate, revoke)
- [x] Spend-over-time chart (per project)
- [x] Spend breakdown by model / by key
- [x] Rule management UI (create/edit/delete budget rules)
- [x] Request log table (searchable/filterable)
- [x] Landing page
- [x] projects management

## Phase 6 — Alerts

- [x] Slack webhook integration
- [x] Trigger alert job via BullMQ when a rule's alert threshold is crossed
- [x] Avoid duplicate alert spam (only fire once per threshold crossing per period)

## Phase 7 — Real Provider Validation (real $ involved)

- [ ] Switch BASE_URL in `.env` to real Anthropic endpoint, small prepaid balance
- [ ] Run same fixed-prompt test script used against mock, compare actual
      provider bill to your calculated cost
- [ ] Fix any drift in rate card or token counting logic
- [ ] Repeat for OpenAI if supporting it in MVP
- [ ] Switch BASE_URL back to mock server when done validating (no reason
      to keep burning real credits on further dev)

## Phase 8 — Launch Prep

- [x] Multi-provider adapter cleanup (OpenAI + Anthropic minimum)
- [x] Basic error/observability logging for the proxy itself (not just
      logged LLM requests — is Silvox itself healthy?)
- [ ] Write a short setup doc for first users (swap base URL, get API key)
- [x] Decide free tier limits / pricing (later step, not before MVP works)



## Pricing (locked, paid-only, no free tier)
- Starter — $9/mo: 2 projects/keys, alert-only mode, 30-day log retention,
  1 dashboard seat, community/email sPupport
- Solo/Team — $25/mo: 10 projects/keys, alert + enforcement (block/downgrade),
  unlimited retention, 3 dashboard seats, email support
- Growth — $49/mo: unlimited projects/keys, alert + enforcement, unlimited
  retention, unlimited dashboard seats, custom webhooks (PagerDuty/email
  digest beyond Slack), priority support
Enforcement is gated at Solo/Team tier and above — it's the core
differentiator, not locked behind the top tier. Multi-provider support
(once built) is NOT tier-gated — available to all paying tiers equally,
gating is by usage volume + feature depth only.