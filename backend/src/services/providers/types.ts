// Shared contract every provider adapter implements. Adding a new provider
// later (Groq, DeepSeek, etc — most are OpenAI-schema-compatible per the
// discussion) means writing one new file that satisfies this interface,
// not touching the route or logging logic.

export interface ProviderUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  outputTokensEstimated: boolean;
}

export interface UsageAccumulator {
  /** Feed raw SSE bytes as they arrive — same bytes being forwarded live. */
  push(chunk: Uint8Array): void;
  getResult(): ProviderUsage;
}

export interface NonStreamResult {
  tokensIn: number;
  tokensOut: number;
  estimated: boolean;
  errorType: string | null;
}

export interface ProviderAdapter {
  readonly providerName: "anthropic" | "openai";
  /** Path this adapter is mounted on, e.g. "/v1/messages" */
  readonly routePath: string;

  buildUpstreamUrl(baseUrl: string): string;
  buildHeaders(upstreamApiKey: string | undefined): Record<string, string>;

  /**
   * Chance to mutate the outgoing body before it's forwarded. Used by the
   * OpenAI adapter to force `stream_options.include_usage` — without it
   * OpenAI never returns token counts on streamed responses and every
   * streamed request would silently fall back to estimation.
   */
  prepareForwardBody(body: unknown, isStream: boolean): unknown;

  isStreamContentType(contentType: string): boolean;

  /** Parse usage out of a non-streaming JSON response, with estimation fallback. */
  parseNonStreamResult(
    status: number,
    parsedBody: any,
    promptText: string,
  ): NonStreamResult;

  createUsageAccumulator(): UsageAccumulator;
}
