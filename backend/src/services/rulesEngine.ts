import { Pool } from "pg";
import { enqueueAlert } from "../queue/alertQueue.js";

export type ScopeType = "api_key" | "project";
export type Period = "daily" | "monthly";
export type RuleAction = "alert" | "downgrade" | "block";

export interface BudgetRule {
  id: string;
  scope_type: ScopeType;
  scope_id: string;
  period: Period;
  limit_usd: string; // numeric comes back as string from pg
  action: RuleAction;
  downgrade_model: string | null;
  active: boolean;
}

export interface BudgetCheckInput {
  apiKeyId: string;
  projectId: string;
}

export interface BudgetCheckResult {
  triggered: boolean;
  action: RuleAction | null;
  rule: BudgetRule | null;
  currentSpend: number;
  downgradeModel: string | null;
}

const ACTION_SEVERITY: Record<RuleAction, number> = {
  alert: 0,
  downgrade: 1,
  block: 2,
};

function periodStart(period: Period): Date {
  const now = new Date();
  if (period === "daily") {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
  // monthly
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function getCurrentSpend(
  pool: Pool,
  scopeType: ScopeType,
  scopeId: string,
  period: Period,
): Promise<number> {
  const start = periodStart(period);
  const column = scopeType === "api_key" ? "api_key_id" : "project_id";
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(cost), 0) AS total
     FROM requests
     WHERE ${column} = $1 AND created_at >= $2`,
    [scopeId, start],
  );
  return parseFloat(rows[0].total);
}

async function getActiveRules(
  pool: Pool,
  apiKeyId: string,
  projectId: string,
): Promise<BudgetRule[]> {
  const { rows } = await pool.query(
    `SELECT * FROM budget_rules
     WHERE active = true
       AND ((scope_type = 'api_key' AND scope_id = $1)
         OR (scope_type = 'project' AND scope_id = $2))`,
    [apiKeyId, projectId],
  );
  return rows;
}

/**
 * Runs BEFORE forwarding a request. Checks all active rules for this
 * api_key/project against already-logged spend for the rule's period.
 * If multiple rules trigger, the most severe action wins (block > downgrade > alert).
 * Does NOT log the trigger — caller does that after deciding what to do,
 * so the request_id can be attached.
 */
export async function checkBudget(
  pool: Pool,
  input: BudgetCheckInput,
): Promise<BudgetCheckResult> {
  const rules = await getActiveRules(pool, input.apiKeyId, input.projectId);

  let best: { rule: BudgetRule; spend: number } | null = null;

  for (const rule of rules) {
    const spend = await getCurrentSpend(
      pool,
      rule.scope_type,
      rule.scope_id,
      rule.period,
    );
    if (spend >= parseFloat(rule.limit_usd)) {
      if (
        !best ||
        ACTION_SEVERITY[rule.action] > ACTION_SEVERITY[best.rule.action]
      ) {
        best = { rule, spend };
      }
    }
  }

  if (!best) {
    return {
      triggered: false,
      action: null,
      rule: null,
      currentSpend: 0,
      downgradeModel: null,
    };
  }

  return {
    triggered: true,
    action: best.rule.action,
    rule: best.rule,
    currentSpend: best.spend,
    downgradeModel: best.rule.downgrade_model,
  };
}

// Resolves the Slack webhook URL + display name for whichever project a
// rule's scope belongs to. api_key-scoped rules resolve through the key's
// project_id; project-scoped rules use scope_id directly.
async function resolveProjectForRule(
  pool: Pool,
  rule: BudgetRule,
): Promise<{
  id: string;
  name: string;
  slackWebhookUrl: string | null;
} | null> {
  if (rule.scope_type === "project") {
    const { rows } = await pool.query(
      `SELECT id, name, slack_webhook_url FROM projects WHERE id = $1`,
      [rule.scope_id],
    );
    return rows[0]
      ? {
          id: rows[0].id,
          name: rows[0].name,
          slackWebhookUrl: rows[0].slack_webhook_url,
        }
      : null;
  }
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.slack_webhook_url
     FROM api_keys ak JOIN projects p ON p.id = ak.project_id
     WHERE ak.id = $1`,
    [rule.scope_id],
  );
  return rows[0]
    ? {
        id: rows[0].id,
        name: rows[0].name,
        slackWebhookUrl: rows[0].slack_webhook_url,
      }
    : null;
}

/**
 * Call after checkBudget has decided the outcome, to record it.
 *
 * Dispatches a Slack notification the FIRST time a rule crosses its
 * threshold within the current period, for ALL action types (alert,
 * downgrade, block) — a block/downgrade silently changing production
 * behavior is arguably more important to know about than a passive alert,
 * so this is no longer restricted to alert-mode rules.
 *
 * Dedup is scoped by rule_id + period_start + action_taken, and only
 * counts trigger rows logged since the rule's config was last edited
 * (budget_rules.updated_at) — so switching a rule's action, or adjusting
 * its limit, always gives it a clean slate for notification purposes
 * within the current period, instead of silently inheriting "already
 * notified" state from before the edit.
 */
export async function logTrigger(
  pool: Pool,
  rule: BudgetRule,
  spend: number,
  requestId: string | null,
): Promise<void> {
  const start = periodStart(rule.period);

  await pool.query(
    `INSERT INTO budget_rule_triggers (rule_id, request_id, action_taken, spend_at_trigger, period_start)
     VALUES ($1, $2, $3, $4, $5)`,
    [rule.id, requestId, rule.action, spend, start],
  );

  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM budget_rule_triggers brt
     JOIN budget_rules br ON br.id = brt.rule_id
     WHERE brt.rule_id = $1
       AND brt.period_start = $2
       AND brt.action_taken = $3
       AND brt.created_at >= br.updated_at`,
    [rule.id, start, rule.action],
  );
  const isFirstCrossingThisPeriod = parseInt(rows[0]?.count ?? "0", 10) === 1;
  if (!isFirstCrossingThisPeriod) return;

  const project = await resolveProjectForRule(pool, rule);
  if (!project?.slackWebhookUrl) return; // no webhook configured — nothing to send, not an error

  await enqueueAlert({
    webhookUrl: project.slackWebhookUrl,
    ruleId: rule.id,
    scopeType: rule.scope_type,
    scopeId: rule.scope_id,
    period: rule.period,
    limitUsd: parseFloat(rule.limit_usd),
    spend,
    projectName: project.name,
    action: rule.action,
    downgradeModel: rule.downgrade_model,
  });
}
