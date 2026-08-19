import type { FastifyRequest, FastifyReply } from "fastify";
import { verifySession } from "../auth/jwt.js";
import { logProxyError } from "../services/proxyErrorLog.js";
import { pool } from "../db/client.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
  }
}

export const SESSION_COOKIE = "sv_session";

/**
 * Unlike the other auth routes, this one doesn't touch DB or Redis — pure
 * JWT verification, no I/O, so it was never at risk of leaking a raw
 * connection error. The one real gap: if verifySession throws on some
 * malformed/unexpected token shape (rather than returning null, which the
 * rest of this function assumes), that was previously unhandled. Cheap,
 * defensive fix — not a high-severity gap like the DB-backed routes, just
 * consistency.
 */
export async function requireSession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    return reply
      .code(401)
      .send({ error: { type: "unauthorized", message: "No session" } });
  }

  let payload: { userId: string; email: string } | null;
  try {
    payload = verifySession(token);
  } catch (err) {
    // Fail closed — same as an invalid session, just recorded since an
    // unexpected throw here (vs. the normal null-on-invalid path) means
    // something about verifySession's behavior doesn't match assumptions.
    logProxyError(pool, {
      errorType: "session_verify_unexpected_throw",
      message: (err as Error).message,
      route: req.url,
    });
    return reply.code(401).send({
      error: { type: "unauthorized", message: "Invalid or expired session" },
    });
  }

  if (!payload) {
    return reply.code(401).send({
      error: { type: "unauthorized", message: "Invalid or expired session" },
    });
  }

  req.userId = payload.userId;
  req.userEmail = payload.email;
}
