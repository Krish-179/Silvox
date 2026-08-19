import { Worker } from "bullmq";
import { createConnection } from "./redisConnection.js";
import { pool } from "../db/client.js";
import type { RequestLogJob } from "./logQueue.js";

export function startRequestLogWorker(): Worker<RequestLogJob> {
  const worker = new Worker<RequestLogJob>(
    "request-log",
    async (job) => {
      const d = job.data;
      await pool.query(
        `INSERT INTO requests
           (api_key_id, project_id, model, status_code, stream,
            tokens_in, tokens_out, tokens_estimated, cost, rate_card_hit, error_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          d.apiKeyId,
          d.projectId,
          d.model,
          d.statusCode,
          d.stream,
          d.tokensIn,
          d.tokensOut,
          d.tokensEstimated,
          d.cost,
          d.rateCardHit,
          d.errorType,
        ],
      );
    },
    { connection: createConnection() },
  );

  worker.on("failed", (job, err) => {
    console.error(`Request log job ${job?.id} failed after retries:`, err);
  });

  return worker;
}
