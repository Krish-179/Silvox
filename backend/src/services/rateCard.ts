// Hardcoded rate card. Prices are $ per 1,000 tokens (not per million —
// matches the schema/task-list convention, just divide published
// per-million rates by 1000).
//
// THIS WILL GO STALE. Providers change pricing without much notice (see
// knowledge.md). There is no live pricing API — this table has to be
// updated by hand when rates change. Wrong cost data is worse than no
// cost data, so if a model isn't in this table, costCalc returns null
// instead of silently guessing.
//
// --- Anthropic ---
// SOURCE: platform.claude.com/docs/en/about-claude/pricing, checked 2026-08-05.
// KNOWN UPCOMING CHANGE: Sonnet 5 is on introductory pricing through
// 2026-08-31. Standard pricing ($3/$15 per MTok) takes effect 2026-09-01.
// Update the sonnet-5 entry below when that happens.
//
// --- OpenAI ---
// SOURCE: third-party aggregators (aimodelcalc.com, pricepertoken.com,
// vortenza.com), checked 2026-08-15 — could NOT verify directly against
// platform.openai.com/api/pricing from this environment. Sources broadly
// agreed on GPT-4o / GPT-4o mini figures below; minor discrepancies exist
// on batch/discounted rates which are not modeled here (this rate card
// only covers standard synchronous pricing, no batch API discount logic).
// VERIFY AGAINST platform.openai.com/api/pricing BEFORE PHASE 7 — do not
// trust these numbers for the real-provider validation pass without
// re-checking against OpenAI's own page first.

export interface RateCardEntry {
  inputPer1k: number;
  outputPer1k: number;
}

export const RATE_CARD: Record<string, RateCardEntry> = {
  // --- Anthropic: current generation (as of 2026-08-05) ---
  "claude-haiku-4-5": { inputPer1k: 0.001, outputPer1k: 0.005 },
  "claude-haiku-4-5-20251001": { inputPer1k: 0.001, outputPer1k: 0.005 },
  "claude-sonnet-5": { inputPer1k: 0.002, outputPer1k: 0.01 }, // intro price, expires 2026-08-31
  "claude-opus-5": { inputPer1k: 0.005, outputPer1k: 0.025 },
  "claude-fable-5": { inputPer1k: 0.01, outputPer1k: 0.05 },
  "claude-mythos-5": { inputPer1k: 0.01, outputPer1k: 0.05 },

  // --- Anthropic: previous generation (still seen in the wild / used in
  // our own mock-provider test fixtures) ---
  "claude-sonnet-4-6": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-opus-4-8": { inputPer1k: 0.005, outputPer1k: 0.025 },

  // --- OpenAI: current default family for new integrations (as of
  // 2026-08-15, UNVERIFIED against OpenAI's own pricing page — see note above) ---
  "gpt-4.1": { inputPer1k: 0.005, outputPer1k: 0.015 },
  "gpt-4.1-mini": { inputPer1k: 0.0004, outputPer1k: 0.0016 },
  "gpt-4.1-nano": { inputPer1k: 0.0001, outputPer1k: 0.0004 },

  // --- OpenAI: legacy/grandfathered, still in wide use ---
  "gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
};

export function lookupRate(model: string): RateCardEntry | null {
  return RATE_CARD[model] ?? null;
}
