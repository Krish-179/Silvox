import { lookupRate } from "./rateCard.js";

export interface CostResult {
  cost: number | null;
  rateFound: boolean;
}

/**
 * Pure cost calculation. Returns null cost (not 0) when the model isn't in
 * the rate card — 0 would silently understate spend and look like "this
 * request was free," which is worse than admitting we don't know.
 */
export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): CostResult {
  const rate = lookupRate(model);
  if (!rate) {
    return { cost: null, rateFound: false };
  }
  const cost = (tokensIn / 1000) * rate.inputPer1k + (tokensOut / 1000) * rate.outputPer1k;
  return { cost, rateFound: true };
}