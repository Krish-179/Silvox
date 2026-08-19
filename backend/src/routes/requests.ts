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

interface RequestRow {
  id: string;
  api_key_id: string;
  display_prefix: string | null;
  model: string;
  status_code: number;
  stream: boolean;
  tokens_in: number | null;
  tokens_out: number | null;
  cost: string | null;
  error_type: string | null;
  created_at: string;
}

export async function registerRequestRoutes(app: FastifyInstance) {
  app.get(
    "/projects/:projectId/requests",
    { preHandler: requireSession },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      if (!(await assertProjectOwnership(req.userId!, projectId))) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Project not found" } });
      }

      const query = req.query as {
        model?: string;
        status?: "success" | "error";
        keyId?: string;
        from?: string; // ISO date
        to?: string; // ISO date
        page?: string;
        pageSize?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
      };

      const page = Math.max(parseInt(query.page ?? "1", 10) || 1, 1);
      const pageSize = Math.min(
        Math.max(parseInt(query.pageSize ?? "50", 10) || 50, 1),
        100,
      );
      const offset = (page - 1) * pageSize;

      // Build WHERE clause dynamically — params array order must match
      // placeholder numbers exactly, so every branch appends to both in lockstep.
      const conditions: string[] = ["r.project_id = $1"];
      const params: unknown[] = [projectId];

      if (query.model) {
        params.push(query.model);
        conditions.push(`model = $${params.length}`);
      }
      if (query.status === "success") {
        conditions.push(`status_code >= 200 AND status_code < 300`);
      } else if (query.status === "error") {
        conditions.push(`(status_code < 200 OR status_code >= 300)`);
      }
      if (query.keyId) {
        params.push(query.keyId);
        conditions.push(`api_key_id = $${params.length}`);
      }
      if (query.from) {
        params.push(query.from);
        conditions.push(`created_at >= $${params.length}`);
      }
      if (query.to) {
        params.push(query.to);
        conditions.push(`created_at <= $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");

      const SORTABLE_COLUMNS: Record<string, string> = {
        createdAt: "r.created_at",
        cost: "r.cost",
        tokensIn: "r.tokens_in",
        tokensOut: "r.tokens_out",
        model: "r.model",
      };

      // inside the route handler, alongside the existing query destructuring:
      const sortBy =
        SORTABLE_COLUMNS[(query.sortBy as string) ?? "createdAt"] ??
        "r.created_at";
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      // Total count for pagination UI — separate query since LIMIT/OFFSET
      // would otherwise make COUNT(*) OVER() awkward to reason about, and
      // this table's indexed on created_at/api_key_id so a plain count is
      // cheap enough at MVP scale.
      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM requests r WHERE ${whereClause}`,
        params,
      );
      const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

      const rowsResult = await pool.query<RequestRow>(
        `SELECT r.id, r.api_key_id, ak.display_prefix, r.model, r.status_code, r.stream,
            r.tokens_in, r.tokens_out, r.cost, r.error_type, r.created_at
            FROM requests r
            LEFT JOIN api_keys ak ON ak.id::text = r.api_key_id
            WHERE ${whereClause}
            ORDER BY ${sortBy} ${sortOrder} NULLS LAST
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset],
      );

      return reply.send({
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
        rows: rowsResult.rows.map((r) => ({
          id: r.id,
          apiKeyId: r.api_key_id,
          displayPrefix: r.display_prefix ?? "unknown",
          model: r.model,
          statusCode: r.status_code,
          stream: r.stream,
          tokensIn: r.tokens_in,
          tokensOut: r.tokens_out,
          cost: r.cost ? parseFloat(r.cost) : null,
          errorType: r.error_type,
          createdAt: r.created_at,
        })),
      });
    },
  );

  // Distinct models seen for this project — powers the model filter
  // dropdown without hardcoding a list on the frontend.
  app.get(
    "/projects/:projectId/requests/models",
    { preHandler: requireSession },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string };
      if (!(await assertProjectOwnership(req.userId!, projectId))) {
        return reply
          .code(404)
          .send({ error: { type: "not_found", message: "Project not found" } });
      }
      const result = await pool.query<{ model: string }>(
        `SELECT DISTINCT model FROM requests WHERE project_id = $1 ORDER BY model ASC`,
        [projectId],
      );
      return reply.send(result.rows.map((r) => r.model));
    },
  );
}
