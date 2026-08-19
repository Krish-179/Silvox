import type { FastifyInstance } from "fastify";
import { pool } from "../db/client.js";
import { requireSession } from "../middleware/session.js";
import { generateProxyKey } from "../auth/proxyKey.js";

// Without this check, any logged-in user could rotate/revoke keys on any
// project_id they guessed — ownership isn't implied by session alone.
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

export async function registerKeyRoutes(app: FastifyInstance) {
  // Raw key is returned ONCE here and never retrievable again — only the
  // hash is stored. Tell the frontend to force a "copy this now" UI.
  app.post(
    "/projects/:projectId/keys",
    { preHandler: requireSession },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      if (!(await assertProjectOwnership(req.userId!, projectId))) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Project not found" } });
      }

      const { raw, hash, displayPrefix } = generateProxyKey();
      const result = await pool.query<{ id: string; created_at: string }>(
        `INSERT INTO api_keys (project_id, key_hash, display_prefix) VALUES ($1, $2, $3)
       RETURNING id, created_at`,
        [projectId, hash, displayPrefix],
      );

      return reply.code(201).send({
        id: result.rows[0].id,
        key: raw,
        displayPrefix,
        createdAt: result.rows[0].created_at,
      });
    },
  );

  // Never returns the raw key or hash — only display_prefix, so the user
  // can tell keys apart without Silvox ever holding a readable secret.
  app.get(
    "/projects/:projectId/keys",
    { preHandler: requireSession },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      if (!(await assertProjectOwnership(req.userId!, projectId))) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Project not found" } });
      }
      const result = await pool.query(
        `SELECT id, display_prefix, active, created_at, revoked_at FROM api_keys
       WHERE project_id = $1 ORDER BY created_at DESC`,
        [projectId],
      );
      return reply.send(result.rows);
    },
  );

  // Rotation = revoke old + issue new in one call so there's never a
  // window where the project has zero active keys from the caller's view.
  app.post(
    "/keys/:keyId/rotate",
    { preHandler: requireSession },
    async (req, reply) => {
      const { keyId } = req.params as { keyId: string };
      const existing = await pool.query<{ project_id: string }>(
        `SELECT ak.project_id FROM api_keys ak
       JOIN projects p ON p.id = ak.project_id
       WHERE ak.id = $1 AND p.user_id = $2`,
        [keyId, req.userId],
      );
      const row = existing.rows[0];
      if (!row) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Key not found" } });
      }

      await pool.query(
        `UPDATE api_keys SET active = false, revoked_at = now() WHERE id = $1`,
        [keyId],
      );

      const { raw, hash, displayPrefix } = generateProxyKey();
      const result = await pool.query<{ id: string; created_at: string }>(
        `INSERT INTO api_keys (project_id, key_hash, display_prefix) VALUES ($1, $2, $3)
       RETURNING id, created_at`,
        [row.project_id, hash, displayPrefix],
      );

      return reply.send({
        id: result.rows[0].id,
        key: raw,
        displayPrefix,
        createdAt: result.rows[0].created_at,
      });
    },
  );

  app.post(
    "/keys/:keyId/revoke",
    { preHandler: requireSession },
    async (req, reply) => {
      const { keyId } = req.params as { keyId: string };
      const result = await pool.query(
        `UPDATE api_keys SET active = false, revoked_at = now()
       FROM projects p
       WHERE api_keys.id = $1 AND api_keys.project_id = p.id AND p.user_id = $2
       RETURNING api_keys.id`,
        [keyId, req.userId],
      );
      if (result.rowCount === 0) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Key not found" } });
      }
      return reply.send({ ok: true });
    },
  );
}
