import type { Pool } from "pg";

interface ProxyErrorParams {
  errorType: string;
  message: string;
  route?: string;
  apiKeyId?: string | null;
  context?: Record<string, unknown>;
}

/**
 * Fire-and-forget insert for Silvox's OWN infra failures — not client
 * request outcomes (those go in `requests`, via enqueueRequestLog). This
 * answers "is Silvox itself healthy", not "what did this LLM call cost."
 *
 * Never throws into the caller — a failure here should never take down
 * the actual request path it's trying to report on. If even the insert
 * fails, fall back to stdout as a last resort.
 */
export function logProxyError(pool: Pool, params: ProxyErrorParams): void {
  void pool
    .query(
      `INSERT INTO proxy_errors (error_type, message, route, api_key_id, context)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.errorType,
        params.message,
        params.route ?? null,
        params.apiKeyId ?? null,
        params.context ? JSON.stringify(params.context) : null,
      ],
    )
    .catch((err) => {
      console.error("proxy_errors insert failed", err, params);
    });
}
