import type { FastifyInstance } from "fastify";
import { pool } from "../db/client.js";
import { requireSession } from "../middleware/session.js";

export async function registerProjectRoutes(app: FastifyInstance) {
  app.post("/projects", { preHandler: requireSession }, async (req, reply) => {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      return reply
        .code(400)
        .send({ error: { type: "invalid_request", message: "name required" } });
    }
    const result = await pool.query(
      `INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at, slack_webhook_url`,
      [req.userId, name.trim()],
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get("/projects", { preHandler: requireSession }, async (req, reply) => {
    const result = await pool.query(
      `SELECT id, name, created_at, slack_webhook_url FROM projects WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId],
    );
    return reply.send(result.rows);
  });

  app.patch(
    "/projects/:projectId",
    { preHandler: requireSession },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      const { name, slackWebhookUrl } = req.body as {
        name?: string;
        slackWebhookUrl?: string | null;
      };

      if (name !== undefined && !name.trim()) {
        return reply.code(400).send({
          error: { type: "invalid_request", message: "name cannot be empty" },
        });
      }

      // Build the update dynamically so callers can send just `name`, just
      // `slackWebhookUrl`, or both without clobbering the field they didn't send.
      const sets: string[] = [];
      const params: unknown[] = [];
      if (name !== undefined) {
        params.push(name.trim());
        sets.push(`name = $${params.length}`);
      }
      if (slackWebhookUrl !== undefined) {
        params.push(slackWebhookUrl || null);
        sets.push(`slack_webhook_url = $${params.length}`);
      }
      if (sets.length === 0) {
        return reply.code(400).send({
          error: { type: "invalid_request", message: "nothing to update" },
        });
      }

      params.push(projectId, req.userId);
      const result = await pool.query(
        `UPDATE projects SET ${sets.join(", ")}
     WHERE id = $${params.length - 1} AND user_id = $${params.length}
     RETURNING id, name, slack_webhook_url, created_at`,
        params,
      );
      if (result.rowCount === 0) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Project not found" } });
      }
      return reply.send(result.rows[0]);
    },
  );

  // Hard delete. api_keys cascades automatically via its FK to projects.
  // budget_rules and requests use TEXT scope_id/project_id (no FK — see
  // Phase 3/2 schema), so they don't cascade automatically. Rules are
  // explicitly cleaned up here since they're pure enforcement config with
  // no audit value once the project's gone. Request rows are deliberately
  // left in place — they're historical spend records, and destroying
  // history on project delete would silently lose real cost data that
  // might matter later (billing disputes, usage review), same reasoning
  // as why revoked keys and deleted rules stay visible instead of
  // vanishing elsewhere in the app.
  app.delete(
    "/projects/:projectId",
    { preHandler: requireSession },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      const owned = await pool.query(
        "SELECT 1 FROM projects WHERE id = $1 AND user_id = $2",
        [projectId, req.userId],
      );
      if (owned.rowCount === 0) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Project not found" } });
      }
      await pool.query(
        `DELETE FROM budget_rules WHERE scope_type = 'project' AND scope_id = $1`,
        [projectId],
      );
      await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      return reply.send({ ok: true });
    },
  );
}
