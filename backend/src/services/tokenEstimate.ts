// Fallback token count estimator. NOT a real tokenizer — this is a rough
// chars-per-token heuristic used only when the provider fails to return
// usage cleanly (errors, timeouts, malformed responses). Anthropic's real
// tokenizer will disagree with this, sometimes by a lot — see knowledge.md
// note that Opus 4.7+'s tokenizer can produce up to 35% more tokens than
// older ones for the same text. Good enough to avoid a hole in cost data,
// not good enough to trust for billing-accuracy claims.
//
// ~4 chars/token is the commonly-cited rough average for English text
// across GPT/Claude-family tokenizers.
const CHARS_PER_TOKEN_ESTIMATE = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}