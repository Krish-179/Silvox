import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";
import { requireProxyKey } from "../middleware/auth.js";
import { calculateCost } from "../services/costCalc.js";
import { estimateTokens } from "../services/tokenEstimate.js";
import { enqueueRequestLog } from "../queue/logQueue.js";
import {
  checkBudget,
  logTrigger,
  type BudgetCheckResult,
} from "../services/rulesEngine.js";
import { logProxyError } from "../services/proxyErrorLog.js";
import { pool } from "../db/client.js";
import type { ProviderAdapter } from "../services/providers/types.js";
import { anthropicAdapter } from "../services/providers/anthropic.js";
import { openaiAdapter } from "../services/providers/openai.js";

const UPSTREAM_TIMEOUT_MS = 15_000;

const NO_BUDGET_TRIGGER: BudgetCheckResult = {
  triggered: false,
  action: null,
  rule: null,
  currentSpend: 0,
  downgradeModel: null,
};

interface LogParams {
  apiKeyId: string;
  projectId: string | null;
  model: string;
  statusCode: number;
  stream: boolean;
  tokensIn: number | null;
  tokensOut: number | null;
  tokensEstimated: boolean;
  errorType: string | null;
}

function logRequest(params: LogParams): void {
  const { cost, rateFound } = calculateCost(
    params.model,
    params.tokensIn ?? 0,
    params.tokensOut ?? 0,
  );
  // FIX: this was a bare `void enqueueRequestLog(...)` with no failure
  // handling — if BullMQ/Redis is down, cost logging silently vanishes
  // (a data-integrity issue) AND, since the returned promise could reject
  // with nothing attached to observe it, Node treats it as an unhandled
  // rejection, which can crash the process outright. Both are now caught.
  void enqueueRequestLog({
    apiKeyId: params.apiKeyId,
    projectId: params.projectId,
    model: params.model,
    statusCode: params.statusCode,
    stream: params.stream,
    tokensIn: params.tokensIn,
    tokensOut: params.tokensOut,
    tokensEstimated: params.tokensEstimated,
    cost,
    rateCardHit: rateFound,
    errorType: params.errorType,
  }); // enqueueRequestLog reports its own failures now — see logQueue.ts
}

/**
 * Wraps checkBudget so a DB blip during the budget check can never take
 * down the actual LLM request it's gating. Per knowledge.md: Silvox
 * failing should never mean a client's production LLM calls stop working
 * — so on failure here we fail OPEN (treat as "no rule triggered") and
 * record the failure, rather than letting the request throw/500.
 */
async function checkBudgetSafely(
  apiKeyId: string,
  projectId: string,
  route: string,
): Promise<BudgetCheckResult> {
  try {
    return await checkBudget(pool, { apiKeyId, projectId });
  } catch (err) {
    logProxyError(pool, {
      errorType: "budget_check_failed",
      message: (err as Error).message,
      route,
      apiKeyId,
      context: { projectId },
    });
    return NO_BUDGET_TRIGGER;
  }
}

/**
 * logTrigger was previously fire-and-forget (`void logTrigger(...)`) with
 * no error handling — an unhandled rejection here (e.g. the Slack dedup
 * query or enqueueAlert failing) could crash the process. Now caught and
 * recorded instead. Trigger logging failing should never affect the
 * client's response, so this stays fire-and-forget by design — just safely.
 */
function logTriggerSafely(
  budgetResult: BudgetCheckResult,
  route: string,
  apiKeyId: string,
): void {
  logTrigger(pool, budgetResult.rule!, budgetResult.currentSpend, null).catch(
    (err) => {
      logProxyError(pool, {
        errorType: "budget_trigger_log_failed",
        message: (err as Error).message,
        route,
        apiKeyId,
        context: { ruleId: budgetResult.rule?.id, action: budgetResult.action },
      });
    },
  );
}

/**
 * Builds a Fastify handler for a given provider adapter. All budget-check,
 * timeout, streaming-vs-non-streaming, and logging logic is shared —
 * only request/response shape and usage extraction differ per provider,
 * and those are delegated to the adapter.
 */
function createProxyHandler(adapter: ProviderAdapter) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const route = adapter.routePath;
    const apiKeyId = req.apiKeyId ?? "unknown";
    const projectId = req.projectId ?? null;

    try {
      const upstreamUrl = adapter.buildUpstreamUrl(config.baseUrl);
      const reqBody = req.body as
        | { stream?: boolean; model?: string; messages?: unknown }
        | undefined;
      const isStreamRequest = reqBody?.stream === true;
      let model = reqBody?.model ?? "unknown";

      // --- Phase 3: budget rule check, before forwarding anything ---
      // FIX: now fails open on DB error instead of throwing unhandled.
      const budgetResult = await checkBudgetSafely(
        apiKeyId,
        projectId ?? apiKeyId,
        route,
      );

      if (budgetResult.triggered && budgetResult.action === "block") {
        logTriggerSafely(budgetResult, route, apiKeyId);
        return reply.code(429).send({
          type: "error",
          error: {
            type: "budget_exceeded",
            message: `Budget rule exceeded: $${budgetResult.currentSpend.toFixed(4)} spent against $${parseFloat(budgetResult.rule!.limit_usd).toFixed(2)} ${budgetResult.rule!.period} limit.`,
          },
        });
      }

      let forwardBody: unknown = req.body;
      if (
        budgetResult.triggered &&
        budgetResult.action === "downgrade" &&
        budgetResult.downgradeModel
      ) {
        model = budgetResult.downgradeModel;
        forwardBody = { ...(req.body as object), model };
      }

      if (budgetResult.triggered && budgetResult.action !== "block") {
        logTriggerSafely(budgetResult, route, apiKeyId);
      }
      // --- end Phase 3 addition ---

      forwardBody = adapter.prepareForwardBody(forwardBody, isStreamRequest);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

      const headers = adapter.buildHeaders(config.upstreamApiKey);
      const scenarioHeader = req.headers["x-mock-scenario"];
      if (typeof scenarioHeader === "string") {
        headers["x-mock-scenario"] = scenarioHeader;
      }

      let upstreamRes: Response;
      try {
        upstreamRes = await fetch(upstreamUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(forwardBody),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        const aborted = (err as Error).name === "AbortError";
        const errorType = aborted ? "upstream_timeout" : "upstream_unreachable";
        req.log.error({ err, upstreamUrl }, errorType);

        const promptText = JSON.stringify(reqBody?.messages ?? "");
        logRequest({
          apiKeyId,
          projectId,
          model,
          statusCode: 502,
          stream: isStreamRequest,
          tokensIn: estimateTokens(promptText),
          tokensOut: null,
          tokensEstimated: true,
          errorType,
        });

        return reply.code(502).send({
          type: "error",
          error: {
            type: errorType,
            message: aborted
              ? `Upstream did not respond within ${UPSTREAM_TIMEOUT_MS}ms`
              : "Could not reach upstream provider",
          },
        });
      }
      clearTimeout(timeout);

      const contentType = upstreamRes.headers.get("content-type") ?? "";
      const isStreamResponse =
        isStreamRequest && adapter.isStreamContentType(contentType);

      if (!isStreamResponse) {
        const text = await upstreamRes.text();
        reply.code(upstreamRes.status);
        reply.header("content-type", contentType || "application/json");

        let parsedBody: any = null;
        try {
          parsedBody = JSON.parse(text);
        } catch {
          // Non-JSON response — adapter's estimation fallback handles this.
        }

        const promptText = JSON.stringify(reqBody?.messages ?? "");
        const result = adapter.parseNonStreamResult(
          upstreamRes.status,
          parsedBody,
          promptText,
        );

        logRequest({
          apiKeyId,
          projectId,
          model,
          statusCode: upstreamRes.status,
          stream: false,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          tokensEstimated: result.estimated,
          errorType: result.errorType,
        });

        return reply.send(text);
      }

      reply.hijack();
      reply.raw.socket?.setNoDelay(true);
      reply.raw.writeHead(upstreamRes.status, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const body = upstreamRes.body;
      if (!body) {
        reply.raw.end();
        logRequest({
          apiKeyId,
          projectId,
          model,
          statusCode: upstreamRes.status,
          stream: true,
          tokensIn: null,
          tokensOut: null,
          tokensEstimated: true,
          errorType: "empty_body",
        });
        return;
      }

      const reader = body.getReader();
      const usageAcc = adapter.createUsageAccumulator();

      reply.raw.on("close", () => {
        reader.cancel().catch(() => {});
      });

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(value);
          usageAcc.push(value);
        }
      } catch (err) {
        req.log.error({ err }, "error while streaming upstream response");
      } finally {
        reply.raw.end();
        const usage = usageAcc.getResult();
        logRequest({
          apiKeyId,
          projectId,
          model,
          statusCode: upstreamRes.status,
          stream: true,
          tokensIn: usage.inputTokens,
          tokensOut: usage.outputTokens,
          tokensEstimated: usage.outputTokensEstimated,
          errorType: null,
        });
      }
    } catch (err) {
      // Last-resort net: a genuinely unexpected bug in Silvox's own code
      // (not an upstream failure, not a budget-check failure — those are
      // already handled above). Without this, an uncaught throw here would
      // hit Fastify's default error handler with no durable record at all.
      req.log.error({ err }, "unhandled_exception in proxy handler");
      logProxyError(pool, {
        errorType: "unhandled_exception",
        message: (err as Error).message,
        route,
        apiKeyId,
        context: { stack: (err as Error).stack },
      });
      if (!reply.sent) {
        return reply.code(500).send({
          type: "error",
          error: { type: "internal_error", message: "Silvox internal error" },
        });
      }
    }
  };
}

export async function registerProxyRoutes(app: FastifyInstance) {
  app.post(
    anthropicAdapter.routePath,
    { preHandler: requireProxyKey },
    createProxyHandler(anthropicAdapter),
  );

  app.post(
    openaiAdapter.routePath,
    { preHandler: requireProxyKey },
    createProxyHandler(openaiAdapter),
  );
}
