import type { FastifyRequest, FastifyReply } from "fastify";
import { pool } from "../db/client.js";
import { hashProxyKey } from "../auth/proxyKey.js";
import { logProxyError } from "../services/proxyErrorLog.js";

declare module "fastify" {
  interface FastifyRequest {
    apiKeyId?: string;
    projectId?: string;
  }
}

// Replaces Phase 1's hardcoded dev key. Validates the Bearer token against
// the hash stored in api_keys, resolves project_id, attaches both to the
// request for the proxy route and downstream logging to use.
//
// FIX: the DB lookup below was previously unguarded — if the query threw
// (DB unreachable), Fastify's default error handler returned a raw 500
// with the underlying connection error leaked straight to the client
// (e.g. "connect ECONNREFUSED 127.0.0.1:9999"), and nothing was recorded.
//
// This must NOT fail open like the budget check does — failing open here
// would mean an auth outage lets unauthenticated requests through, which
// is a real security hole, not just a missing feature. So this stays
// fail-CLOSED, but now: doesn't leak internals, returns an honest 503
// ("we couldn't verify this right now") instead of a misleading generic
// 500 or 401, and is recorded in proxy_errors.
export async function requireProxyKey(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({
      type: "error",
      error: { type: "authentication_error", message: "Missing Bearer token" },
    });
  }

  const rawKey = authHeader.slice("Bearer ".length).trim();
  const keyHash = hashProxyKey(rawKey);

  let row: { id: string; project_id: string; active: boolean } | undefined;
  try {
    const result = await pool.query<{
      id: string;
      project_id: string;
      active: boolean;
    }>(`SELECT id, project_id, active FROM api_keys WHERE key_hash = $1`, [
      keyHash,
    ]);
    row = result.rows[0];
  } catch (err) {
    logProxyError(pool, {
      errorType: "auth_db_query_failed",
      message: (err as Error).message,
      route: req.url,
    });
    return reply.code(503).send({
      type: "error",
      error: {
        type: "service_unavailable",
        message: "Could not verify API key right now — please retry.",
      },
    });
  }

  if (!row || !row.active) {
    return reply.code(401).send({
      type: "error",
      error: {
        type: "authentication_error",
        message: "Invalid or revoked API key",
      },
    });
  }

  req.apiKeyId = row.id;
  req.projectId = row.project_id;
}
