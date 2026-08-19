import { FastifyRequest, FastifyReply } from "fastify";
import { Pool } from "pg";
import {
  checkBudget,
  logTrigger,
  BudgetCheckResult,
} from "../services/rulesEngine.js";

// Extend request context so the proxy route can read the decision
declare module "fastify" {
  interface FastifyRequest {
    budgetCheck?: BudgetCheckResult;
  }
}

export function budgetCheckMiddleware(pool: Pool) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Phase 1 placeholder auth attaches these — replaced properly in Phase 4
    const apiKeyId = (req as any).apiKeyId;
    const projectId = (req as any).projectId;

    if (!apiKeyId || !projectId) {
      // No identity resolved yet — shouldn't happen if auth middleware ran first
      return;
    }

    const result = await checkBudget(pool, { apiKeyId, projectId });
    req.budgetCheck = result;

    if (!result.triggered) return;

    if (result.action === "block") {
      // Log the trigger even though we never made the upstream call —
      // request_id is null here, it's logged as a rejection, not a billed request.
      await logTrigger(pool, result.rule!, result.currentSpend, null);
      return reply.code(429).send({
        error: "budget_exceeded",
        message: `Budget rule exceeded: $${result.currentSpend.toFixed(4)} spent against $${parseFloat(result.rule!.limit_usd).toFixed(2)} ${result.rule!.period} limit.`,
        rule_id: result.rule!.id,
      });
    }

    // downgrade and alert don't short-circuit — the proxy route handles them
    // (downgrade rewrites the model; alert just logs after the fact via logTrigger,
    // called from the route once it has a request_id to attach)
  };
}
