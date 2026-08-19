import { estimateTokens } from "../tokenEstimate.js";
import type {
  ProviderAdapter,
  UsageAccumulator,
  ProviderUsage,
  NonStreamResult,
} from "./types.js";

/**
 * HARD PART: OpenAI's SSE stream does NOT include token usage by default —
 * unlike Anthropic, which always sends input_tokens/output_tokens inline.
 * OpenAI only emits a final `usage` object if the request explicitly sets
 * `stream_options: { include_usage: true }`. We force that flag on in
 * prepareForwardBody() below so every streamed request gets real usage
 * instead of silently falling back to estimation 100% of the time.
 *
 * That extra usage-only chunk arrives just before `data: [DONE]`, with an
 * empty `choices` array — documented OpenAI behavior, already handled by
 * their own client SDKs, safe to inject.
 *
 * Until that chunk arrives (or if it never does — malformed stream, client
 * disconnect), fall back to estimating output tokens from accumulated
 * delta text, same pattern as the Anthropic accumulator.
 */
class OpenAiSseUsageAccumulator implements UsageAccumulator {
  private buffer = "";
  private decoder = new TextDecoder();
  private inputTokens: number | null = null;
  private outputTokens: number | null = null;
  private deltaText = "";

  push(chunk: Uint8Array): void {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    const events = this.buffer.split("\n\n");
    this.buffer = events.pop() ?? "";
    for (const event of events) {
      this.parseEvent(event);
    }
  }

  private parseEvent(eventText: string): void {
    const dataLine = eventText
      .split("\n")
      .find((line) => line.startsWith("data:"));
    if (!dataLine) return;
    const jsonStr = dataLine.slice(5).trim();
    if (!jsonStr || jsonStr === "[DONE]") return;

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return;
    }

    const delta = parsed?.choices?.[0]?.delta;
    if (typeof delta?.content === "string") {
      this.deltaText += delta.content;
    }

    if (
      parsed?.usage &&
      typeof parsed.usage.prompt_tokens === "number" &&
      typeof parsed.usage.completion_tokens === "number"
    ) {
      this.inputTokens = parsed.usage.prompt_tokens;
      this.outputTokens = parsed.usage.completion_tokens;
    }
  }

  getResult(): ProviderUsage {
    if (this.outputTokens !== null) {
      return {
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        outputTokensEstimated: false,
      };
    }
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.deltaText ? estimateTokens(this.deltaText) : null,
      outputTokensEstimated: true,
    };
  }
}

export const openaiAdapter: ProviderAdapter = {
  providerName: "openai",
  routePath: "/v1/chat/completions",

  buildUpstreamUrl(baseUrl) {
    return `${baseUrl}/v1/chat/completions`;
  },

  buildHeaders(upstreamApiKey) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (upstreamApiKey) {
      headers["Authorization"] = `Bearer ${upstreamApiKey}`;
    }
    return headers;
  },

  prepareForwardBody(body, isStream) {
    if (!isStream || typeof body !== "object" || body === null) return body;
    return { ...(body as object), stream_options: { include_usage: true } };
  },

  isStreamContentType(contentType) {
    return contentType.includes("text/event-stream");
  },

  parseNonStreamResult(status, parsedBody, promptText): NonStreamResult {
    const success = status >= 200 && status < 300;

    if (
      success &&
      typeof parsedBody?.usage?.prompt_tokens === "number" &&
      typeof parsedBody?.usage?.completion_tokens === "number"
    ) {
      return {
        tokensIn: parsedBody.usage.prompt_tokens,
        tokensOut: parsedBody.usage.completion_tokens,
        estimated: false,
        errorType: null,
      };
    }

    const tokensIn = estimateTokens(promptText);
    const content = parsedBody?.choices?.[0]?.message?.content;
    const tokensOut =
      success && content
        ? estimateTokens(
            typeof content === "string" ? content : JSON.stringify(content),
          )
        : 0;
    const errorType = success
      ? null
      : (parsedBody?.error?.type ?? parsedBody?.error?.code ?? "unknown_error");

    return { tokensIn, tokensOut, estimated: true, errorType };
  },

  createUsageAccumulator() {
    return new OpenAiSseUsageAccumulator();
  },
};
