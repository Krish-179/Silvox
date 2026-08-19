import type { FastifyInstance } from "fastify";
import { pool } from "../db/client.js";
import { requireSession } from "../middleware/session.js";

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

interface DailySpendRow {
  day: string;
  spend: string;
}
interface ModelSpendRow {
  model: string;
  spend: string;
}
interface KeySpendRow {
  api_key_id: string | null;
  display_prefix: string | null;
  spend: string;
}
interface ActiveRuleRow {
  id: string;
  scope_type: "project" | "api_key";
  scope_id: string;
  period: "daily" | "monthly";
  limit_usd: string;
  action: string;
  key_display_prefix: string | null;
}

export async function registerSpendRoutes(app: FastifyInstance) {
  app.get(
    "/projects/:projectId/spend",
    { preHandler: requireSession },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      const { days: daysParam } = req.query as { days?: string };

      if (!(await assertProjectOwnership(req.userId!, projectId))) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Project not found" } });
      }

      const days = Math.min(
        Math.max(parseInt(daysParam ?? "7", 10) || 7, 1),
        90,
      );

      const dayResult = await pool.query<{ spend: string }>(
        `SELECT SUM(COALESCE(cost, 0))::text AS spend
        FROM requests
        WHERE project_id = $1 AND created_at >= date_trunc('day', now())`,
        [projectId],
      );

      const dailyResult = await pool.query<DailySpendRow>(
        `SELECT date_trunc('day', created_at) AS day, SUM(COALESCE(cost, 0))::text AS spend
       FROM requests
       WHERE project_id = $1 AND created_at >= now() - ($2 || ' days')::interval
       GROUP BY day
       ORDER BY day ASC`,
        [projectId, days],
      );

      const modelResult = await pool.query<ModelSpendRow>(
        `SELECT model, SUM(COALESCE(cost, 0))::text AS spend
       FROM requests
       WHERE project_id = $1 AND created_at >= now() - ($2 || ' days')::interval
       GROUP BY model
       ORDER BY SUM(COALESCE(cost, 0)) DESC`,
        [projectId, days],
      );

      const keyResult = await pool.query<KeySpendRow>(
        `SELECT r.api_key_id, ak.display_prefix, SUM(COALESCE(r.cost, 0))::text AS spend
       FROM requests r
       LEFT JOIN api_keys ak ON ak.id::text = r.api_key_id
       WHERE r.project_id = $1 AND r.created_at >= now() - ($2 || ' days')::interval
       GROUP BY r.api_key_id, ak.display_prefix
       ORDER BY SUM(COALESCE(r.cost, 0)) DESC`,
        [projectId, days],
      );

      const monthResult = await pool.query<{ spend: string }>(
        `SELECT SUM(COALESCE(cost, 0))::text AS spend
       FROM requests
       WHERE project_id = $1 AND created_at >= date_trunc('month', now())`,
        [projectId],
      );

      // Active rules for this project — BOTH project-scoped AND rules
      // scoped to any key belonging to this project. Previously only
      // fetched scope_type = 'project', which made per-key rules invisible
      // to the dashboard gauge entirely.
      const activeRulesResult = await pool.query<ActiveRuleRow>(
        `SELECT br.id, br.scope_type, br.scope_id, br.period, br.limit_usd, br.action,
                ak.display_prefix AS key_display_prefix
         FROM budget_rules br
         LEFT JOIN api_keys ak ON br.scope_type = 'api_key' AND ak.id::text = br.scope_id
         WHERE br.active = true
           AND (
             (br.scope_type = 'project' AND br.scope_id = $1)
             OR (br.scope_type = 'api_key' AND ak.project_id::text = $1)
           )`,
        [projectId],
      );

      // Each rule's current spend has to be computed against ITS OWN scope
      // (a key-scoped rule cares about that key's spend, not the whole
      // project's) and ITS OWN period window — not the project-wide totals
      // computed above, which are for the chart's default view only.
      async function currentSpendForRule(row: ActiveRuleRow): Promise<number> {
        const start =
          row.period === "daily"
            ? `date_trunc('day', now())`
            : `date_trunc('month', now())`;
        const column =
          row.scope_type === "api_key" ? "api_key_id" : "project_id";
        const { rows } = await pool.query<{ spend: string }>(
          `SELECT SUM(COALESCE(cost, 0))::text AS spend
           FROM requests
           WHERE ${column} = $1 AND created_at >= ${start}`,
          [row.scope_id],
        );
        return parseFloat(rows[0]?.spend ?? "0");
      }

      const activeRulesWithSpend = await Promise.all(
        activeRulesResult.rows.map(async (r) => ({
          id: r.id,
          scopeType: r.scope_type,
          period: r.period,
          limitUsd: parseFloat(r.limit_usd),
          action: r.action,
          keyDisplayPrefix: r.key_display_prefix,
          currentSpend: await currentSpendForRule(r),
        })),
      );

      return reply.send({
        windowDays: days,
        currentDaySpend: parseFloat(dayResult.rows[0]?.spend ?? "0"),
        daily: dailyResult.rows.map((r) => ({
          day: r.day,
          spend: parseFloat(r.spend),
        })),
        byModel: modelResult.rows.map((r) => ({
          model: r.model,
          spend: parseFloat(r.spend),
        })),
        byKey: keyResult.rows.map((r) => ({
          apiKeyId: r.api_key_id,
          displayPrefix: r.display_prefix ?? "unknown",
          spend: parseFloat(r.spend),
        })),
        currentMonthSpend: parseFloat(monthResult.rows[0]?.spend ?? "0"),
        activeRules: activeRulesWithSpend,
      });
    },
  );
}
