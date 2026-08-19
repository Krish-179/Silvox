import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCost } from "./costCalc.js";

// Fixed known example: Sonnet 4.6 at $3/$15 per MTok = $0.003/$0.015 per 1k.
// 10,000 input tokens + 2,000 output tokens is the exact example used in
// Anthropic's own pricing docs: $0.03 input + $0.03 output = $0.06 total.
test("calculateCost matches Anthropic's documented Sonnet 4.6 example", () => {
  const result = calculateCost("claude-sonnet-4-6", 10_000, 2_000);
  assert.equal(result.rateFound, true);
  assert.ok(result.cost !== null);
  assert.ok(Math.abs((result.cost as number) - 0.06) < 1e-9);
});

test("calculateCost handles zero tokens", () => {
  const result = calculateCost("claude-sonnet-4-6", 0, 0);
  assert.equal(result.cost, 0);
});

test("calculateCost returns null (not 0) for unknown model", () => {
  const result = calculateCost("some-model-not-in-rate-card", 1000, 1000);
  assert.equal(result.rateFound, false);
  assert.equal(result.cost, null);
});

test("calculateCost — Haiku 4.5 known rate", () => {
  // 1M input + 1M output tokens at $1/$5 per MTok = $1 + $5 = $6
  const result = calculateCost("claude-haiku-4-5", 1_000_000, 1_000_000);
  assert.ok(result.cost !== null);
  assert.ok(Math.abs((result.cost as number) - 6) < 1e-6);
});