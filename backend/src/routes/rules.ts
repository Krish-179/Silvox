import type { FastifyInstance } from "fastify";
import { pool } from "../db/client.js";
import { requireSession } from "../middleware/session.js";
import { RATE_CARD } from "../services/rateCard.js";

async function assertProjectOwnership(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

async function assertKeyBelongsToProject(
  keyId: string,
  projectId: string,
): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM api_keys WHERE id = $1 AND project_id = $2",
    [keyId, projectId],
  );
  return (result.rowCount ?? 0) > 0;
}

async function assertRuleOwnership(
  userId: string,
  ruleId: string,
): Promise<{ id: string; scope_type: string; scope_id: string } | null> {
  const result = await pool.query<{
    id: string;
    scope_type: string;
    scope_id: string;
  }>(
    `SELECT br.id, br.scope_type, br.scope_id
     FROM budget_rules br
     WHERE br.id = $1
       AND (
         (br.scope_type = 'project' AND EXISTS (
           SELECT 1 FROM projects p WHERE p.id::text = br.scope_id AND p.user_id = $2
         ))
         OR
         (br.scope_type = 'api_key' AND EXISTS (
           SELECT 1 FROM api_keys ak JOIN projects p ON p.id = ak.project_id
           WHERE ak.id::text = br.scope_id AND p.user_id = $2
         ))
       )`,
    [ruleId, userId],
  );
  return result.rows[0] ?? null;
}

interface RuleBody {
  period?: "daily" | "monthly";
  limitUsd?: number;
  action?: "alert" | "downgrade" | "block";
  downgradeModel?: string;
  keyId?: string;
}

function validateRuleBody(body: RuleBody): string | null {
  if (!body.period || !["daily", "monthly"].includes(body.period)) {
    return "period must be 'daily' or 'monthly'";
  }
  if (typeof body.limitUsd !== "number" || body.limitUsd <= 0) {
    return "limitUsd must be a positive number";
  }
  if (!body.action || !["alert", "downgrade", "block"].includes(body.action)) {
    return "action must be 'alert', 'downgrade', or 'block'";
  }
  if (body.action === "downgrade" && !body.downgradeModel) {
    return "downgradeModel is required when action is 'downgrade'";
  }
  return null;
}

export async function registerRuleRoutes(app: FastifyInstance) {
  app.get(
    "/projects/:projectId/rules",
    { preHandler: requireSession },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      if (!(await assertProjectOwnership(req.userId!, projectId))) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Project not found" } });
      }
      const result = await pool.query(
        `SELECT br.id, br.scope_type, br.scope_id, br.period, br.limit_usd, br.action,
              br.downgrade_model, br.active, br.created_at, br.updated_at,
              ak.display_prefix AS key_display_prefix
       FROM budget_rules br
       LEFT JOIN api_keys ak ON br.scope_type = 'api_key' AND ak.id::text = br.scope_id
       WHERE (br.scope_type = 'project' AND br.scope_id = $1)
          OR (br.scope_type = 'api_key' AND ak.project_id::text = $1)
       ORDER BY br.active DESC, br.created_at DESC`,
        [projectId],
      );
      return reply.send(result.rows);
    },
  );

  app.post(
    "/projects/:projectId/rules",
    { preHandler: requireSession },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      if (!(await assertProjectOwnership(req.userId!, projectId))) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Project not found" } });
      }
      const body = req.body as RuleBody;
      const validationError = validateRuleBody(body);
      if (validationError) {
        return reply
          .code(400)
          .send({
            error: { type: "invalid_request", message: validationError },
          });
      }

      let scopeType: "project" | "api_key" = "project";
      let scopeId = projectId;

      if (body.keyId) {
        if (!(await assertKeyBelongsToProject(body.keyId, projectId))) {
          return reply.code(400).send({
            error: {
              type: "invalid_request",
              message: "That key does not belong to this project",
            },
          });
        }
        scopeType = "api_key";
        scopeId = body.keyId;
      }

      const result = await pool.query(
        `INSERT INTO budget_rules (scope_type, scope_id, period, limit_usd, action, downgrade_model)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, scope_type, scope_id, period, limit_usd, action, downgrade_model, active, created_at, updated_at`,
        [
          scopeType,
          scopeId,
          body.period,
          body.limitUsd,
          body.action,
          body.downgradeModel ?? null,
        ],
      );
      return reply.code(201).send(result.rows[0]);
    },
  );

  app.patch(
    "/rules/:ruleId",
    { preHandler: requireSession },
    async (req, reply) => {
      const { ruleId } = req.params as { ruleId: string };
      const owned = await assertRuleOwnership(req.userId!, ruleId);
      if (!owned) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Rule not found" } });
      }
      const body = req.body as RuleBody;
      const validationError = validateRuleBody(body);
      if (validationError) {
        return reply
          .code(400)
          .send({
            error: { type: "invalid_request", message: validationError },
          });
      }
      const result = await pool.query(
        `UPDATE budget_rules
       SET period = $1, limit_usd = $2, action = $3, downgrade_model = $4, updated_at = now()
       WHERE id = $5
       RETURNING id, scope_type, scope_id, period, limit_usd, action, downgrade_model, active, created_at, updated_at`,
        [
          body.period,
          body.limitUsd,
          body.action,
          body.downgradeModel ?? null,
          ruleId,
        ],
      );
      return reply.send(result.rows[0]);
    },
  );

  app.delete(
    "/rules/:ruleId",
    { preHandler: requireSession },
    async (req, reply) => {
      const { ruleId } = req.params as { ruleId: string };
      const owned = await assertRuleOwnership(req.userId!, ruleId);
      if (!owned) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Rule not found" } });
      }
      await pool.query(
        `UPDATE budget_rules SET active = false, updated_at = now() WHERE id = $1`,
        [ruleId],
      );
      return reply.send({ ok: true });
    },
  );

  app.get("/rate-card", { preHandler: requireSession }, async (_req, reply) => {
    const entries = Object.entries(RATE_CARD).map(([model, rates]) => ({
      model,
      inputPer1k: rates.inputPer1k,
      outputPer1k: rates.outputPer1k,
    }));
    return reply.send(entries);
  });
}
