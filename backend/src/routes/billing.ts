import type { FastifyInstance } from "fastify";
import { pool } from "../db/client.js";
import { requireSession } from "../middleware/session.js";

const PLAN_META: Record<string, { name: string; amount: number }> = {
  starter: { name: "Starter", amount: 9 },
  solo_team: { name: "Solo / Team", amount: 25 },
  growth: { name: "Growth", amount: 49 },
};

interface SubscriptionRow {
  id: string;
  plan: string;
  status: string;
  amount_usd: string;
  started_at: string;
  current_period_end: string;
  canceled_at: string | null;
}

interface PurchaseRow {
  id: string;
  amount_usd: string;
  status: string;
  purchased_at: string;
  note: string | null;
}

export async function registerBillingRoutes(app: FastifyInstance) {
  // Returns the current subscription (most recent row, any status) plus
  // its full purchase history. No processor is wired up — this reads
  // whatever's actually in the table, which is nothing until a row is
  // manually inserted.
  app.get(
    "/billing/subscription",
    { preHandler: requireSession },
    async (req, reply) => {
      const subResult = await pool.query<SubscriptionRow>(
        `SELECT id, plan, status, amount_usd, started_at, current_period_end, canceled_at
       FROM subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
        [req.userId],
      );
      const sub = subResult.rows[0];

      if (!sub) {
        return reply.send({ subscription: null, purchases: [] });
      }

      const purchasesResult = await pool.query<PurchaseRow>(
        `SELECT id, amount_usd, status, purchased_at, note
       FROM subscription_purchases
       WHERE subscription_id = $1
       ORDER BY purchased_at DESC`,
        [sub.id],
      );

      return reply.send({
        subscription: {
          id: sub.id,
          plan: sub.plan,
          planName: PLAN_META[sub.plan]?.name ?? sub.plan,
          status: sub.status,
          amountUsd: parseFloat(sub.amount_usd),
          startedAt: sub.started_at,
          currentPeriodEnd: sub.current_period_end,
          canceledAt: sub.canceled_at,
        },
        purchases: purchasesResult.rows.map((p) => ({
          id: p.id,
          amountUsd: parseFloat(p.amount_usd),
          status: p.status,
          purchasedAt: p.purchased_at,
          note: p.note,
        })),
      });
    },
  );
}
