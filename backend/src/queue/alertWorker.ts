import { Worker } from "bullmq";
import { createConnection } from "./redisConnection.js";
import type { AlertJob } from "./alertQueue.js";

const ACTION_COPY: Record<AlertJob["action"], { emoji: string; verb: string }> =
  {
    alert: { emoji: ":rotating_light:", verb: "Budget alert" },
    downgrade: { emoji: ":arrow_down:", verb: "Budget downgrade triggered" },
    block: { emoji: ":no_entry:", verb: "Requests blocked" },
  };

export function startAlertWorker(): Worker<AlertJob> {
  const worker = new Worker<AlertJob>(
    "send-alert",
    async (job) => {
      const d = job.data;
      const periodLabel = d.period === "daily" ? "today" : "this month";
      const { emoji, verb } = ACTION_COPY[d.action];

      let text =
        `${emoji} *${verb} — ${d.projectName}*\n` +
        `Spend has reached *$${d.spend.toFixed(2)}* against a *$${d.limitUsd.toFixed(2)} ${periodLabel}* limit ` +
        `(${d.scopeType === "project" ? "project-wide" : "single API key"}).`;

      if (d.action === "downgrade" && d.downgradeModel) {
        text += `\nNew requests are being downgraded to \`${d.downgradeModel}\`.`;
      }
      if (d.action === "block") {
        text += `\nNew requests are being rejected with a 429 until the period resets.`;
      }

      const res = await fetch(d.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        // Throwing here lets BullMQ's built-in retry/backoff handle
        // transient Slack outages, consistent with how log-request retries.
        throw new Error(`Slack webhook responded ${res.status}`);
      }
    },
    { connection: createConnection() },
  );

  worker.on("failed", (job, err) => {
    console.error(`Alert job ${job?.id} failed after retries:`, err);
  });

  return worker;
}
