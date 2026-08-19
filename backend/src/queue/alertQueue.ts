import { Queue } from "bullmq";
import { createConnection } from "./redisConnection.js";

export interface AlertJob {
  webhookUrl: string;
  ruleId: string;
  scopeType: "api_key" | "project";
  scopeId: string;
  period: "daily" | "monthly";
  limitUsd: number;
  spend: number;
  projectName: string;
  action: "alert" | "downgrade" | "block";
  downgradeModel?: string | null;
}

export const alertQueue = new Queue<AlertJob>("send-alert", {
  connection: createConnection(),
});

/**
 * Fire-and-forget enqueue, same contract as enqueueRequestLog — never
 * throws. A failed Slack notification must never affect the proxy's
 * response path or the rules engine's own logging.
 */
export async function enqueueAlert(job: AlertJob): Promise<void> {
  try {
    await alertQueue.add("alert", job, {
      removeOnComplete: 1000,
      removeOnFail: 1000,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  } catch (err) {
    console.error(
      "Failed to enqueue alert job (rule trigger itself was NOT affected):",
      err,
    );
  }
}
