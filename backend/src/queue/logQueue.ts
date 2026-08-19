import { Queue } from "bullmq";
import { createConnection } from "./redisConnection.js";
import { logProxyError } from "../services/proxyErrorLog.js";
import { pool } from "../db/client.js";

export interface RequestLogJob {
  apiKeyId: string;
  projectId: string | null;
  model: string;
  statusCode: number;
  stream: boolean;
  tokensIn: number | null;
  tokensOut: number | null;
  tokensEstimated: boolean;
  cost: number | null;
  rateCardHit: boolean;
  errorType: string | null;
}

export const requestLogQueue = new Queue<RequestLogJob>("request-log", {
  connection: createConnection(),
});

// BullMQ REQUIRES maxRetriesPerRequest: null on its connections (see
// redisConnection.ts) — without it, workers don't function correctly.
// The tradeoff: ioredis then never gives up and rejects a command on its
// own. If Redis is unreachable, requestLogQueue.add() hangs indefinitely,
// silently retrying the underlying connection forever, with no rejection
// ever surfacing. That's the actual cause of "no error anywhere" when
// Redis is down — not a missing catch, a promise that never settles.
//
// Fix: race the enqueue against a manual timeout. If it doesn't resolve in
// time, treat it as failed for OUR observability purposes and move on.
// NOTE: this does not cancel the underlying ioredis command — it keeps
// retrying in the background and may still eventually succeed once Redis
// comes back. That's fine (the job still gets queued if so); worst case
// we log one avoidable proxy_error for a request that later self-healed.
// Better to over-report a transient blip than hang forever with zero signal.
const ENQUEUE_TIMEOUT_MS = 3000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${ms}ms — Redis likely unreachable`,
        ),
      );
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Fire-and-forget enqueue. Deliberately never throws — a logging failure
 * must never take down or slow down the proxy response path. Worst case,
 * we lose one log row; we do not fail the user's request.
 */
export async function enqueueRequestLog(job: RequestLogJob): Promise<void> {
  try {
    await withTimeout(
      requestLogQueue.add("log", job, {
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 3,
        backoff: { type: "exponential", delay: 500 },
      }),
      ENQUEUE_TIMEOUT_MS,
      "enqueueRequestLog",
    );
  } catch (err) {
    console.error(
      "Failed to enqueue request log job (request itself was NOT affected):",
      err,
    );
    logProxyError(pool, {
      errorType: "queue_enqueue_failed",
      message: (err as Error).message,
      apiKeyId: job.apiKeyId,
      context: { model: job.model, statusCode: job.statusCode },
    });
  }
}
