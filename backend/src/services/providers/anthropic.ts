import { estimateTokens } from "../tokenEstimate.js";
import type {
  ProviderAdapter,
  UsageAccumulator,
  ProviderUsage,
  NonStreamResult,
} from "./types.js";

/**
 * Anthropic's stream carries input_tokens in `message_start` and the final
 * output_tokens in `message_delta`. If the client disconnects early or the
 * provider sends a malformed stream, `message_delta` may never arrive —
 * getResult() falls back to estimating output tokens from the accumulated
 * text deltas rather than leaving cost data as a hole.
 *
 * Unchanged from the pre-multi-provider version — moved here as-is.
 */
class AnthropicSseUsageAccumulator implements UsageAccumulator {
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
    if (!jsonStr) return;

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return;
    }

    if (
      parsed?.type === "message_start" &&
      typeof parsed?.message?.usage?.input_tokens === "number"
    ) {
      this.inputTokens = parsed.message.usage.input_tokens;
    }
    if (
      parsed?.type === "content_block_delta" &&
      parsed?.delta?.type === "text_delta"
    ) {
      this.deltaText += parsed.delta.text ?? "";
    }
    if (
      parsed?.type === "message_delta" &&
      typeof parsed?.usage?.output_tokens === "number"
    ) {
      this.outputTokens = parsed.usage.output_tokens;
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

export const anthropicAdapter: ProviderAdapter = {
  providerName: "anthropic",
  routePath: "/v1/messages",

  buildUpstreamUrl(baseUrl) {
    return `${baseUrl}/v1/messages`;
  },

  buildHeaders(upstreamApiKey) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (upstreamApiKey) {
      headers["x-api-key"] = upstreamApiKey;
      headers["anthropic-version"] = "2023-06-01";
    }
    return headers;
  },

  prepareForwardBody(body) {
    return body; // no mutation needed for Anthropic
  },

  isStreamContentType(contentType) {
    return contentType.includes("text/event-stream");
  },

  parseNonStreamResult(status, parsedBody, promptText): NonStreamResult {
    const success = status >= 200 && status < 300;

    if (
      success &&
      typeof parsedBody?.usage?.input_tokens === "number" &&
      typeof parsedBody?.usage?.output_tokens === "number"
    ) {
      return {
        tokensIn: parsedBody.usage.input_tokens,
        tokensOut: parsedBody.usage.output_tokens,
        estimated: false,
        errorType: null,
      };
    }

    const tokensIn = estimateTokens(promptText);
    const tokensOut =
      success && parsedBody?.content
        ? estimateTokens(JSON.stringify(parsedBody.content))
        : 0;
    const errorType = success
      ? null
      : (parsedBody?.error?.type ?? "unknown_error");

    return { tokensIn, tokensOut, estimated: true, errorType };
  },

  createUsageAccumulator() {
    return new AnthropicSseUsageAccumulator();
  },
};
