import { Pool } from "pg";
import { checkBudget } from "../services/rulesEngine.js";
import { config } from "../config.js";

async function main() {
  const pool = new Pool({ connectionString: config.dbUrl });

  const TEST_KEY = "test-key-001";
  const TEST_PROJECT = "test-project-001";

  console.log("Cleaning previous test data...");
  await pool.query(
    `DELETE FROM budget_rule_triggers WHERE rule_id IN
    (SELECT id FROM budget_rules WHERE scope_id IN ($1, $2))`,
    [TEST_KEY, TEST_PROJECT],
  );
  await pool.query(`DELETE FROM budget_rules WHERE scope_id IN ($1, $2)`, [
    TEST_KEY,
    TEST_PROJECT,
  ]);
  await pool.query(`DELETE FROM requests WHERE api_key_id = $1`, [TEST_KEY]);

  console.log(
    "Seeding fake historical spend ($8.50 today, under a $10 daily cap)...",
  );
  await pool.query(
    `INSERT INTO requests (api_key_id, project_id, model, status_code, stream, tokens_in, tokens_out, tokens_estimated, cost, rate_card_hit, created_at)
   VALUES ($1, $2, 'claude-sonnet-4-6', 200, false, 10000, 5000, false, 8.50, true, now())`,
    [TEST_KEY, TEST_PROJECT],
  );

  console.log(
    "\n--- Test 1: alert rule at $5, spend is $8.50 -> should trigger alert ---",
  );
  await pool.query(
    `INSERT INTO budget_rules (scope_type, scope_id, period, limit_usd, action)
     VALUES ('api_key', $1, 'daily', 5.00, 'alert')`,
    [TEST_KEY],
  );
  let result = await checkBudget(pool, {
    apiKeyId: TEST_KEY,
    projectId: TEST_PROJECT,
  });
  console.log(
    result.triggered && result.action === "alert" ? "PASS" : "FAIL",
    result,
  );

  console.log(
    "\n--- Test 2: add downgrade rule at $8, spend is $8.50 -> downgrade beats alert ---",
  );
  await pool.query(
    `INSERT INTO budget_rules (scope_type, scope_id, period, limit_usd, action, downgrade_model)
     VALUES ('api_key', $1, 'daily', 8.00, 'downgrade', 'claude-haiku-4-5')`,
    [TEST_KEY],
  );
  result = await checkBudget(pool, {
    apiKeyId: TEST_KEY,
    projectId: TEST_PROJECT,
  });
  console.log(
    result.action === "downgrade" &&
      result.downgradeModel === "claude-haiku-4-5"
      ? "PASS"
      : "FAIL",
    result,
  );

  console.log(
    "\n--- Test 3: add block rule at $8.40, spend is $8.50 -> block beats everything ---",
  );
  await pool.query(
    `INSERT INTO budget_rules (scope_type, scope_id, period, limit_usd, action)
     VALUES ('api_key', $1, 'daily', 8.40, 'block')`,
    [TEST_KEY],
  );
  result = await checkBudget(pool, {
    apiKeyId: TEST_KEY,
    projectId: TEST_PROJECT,
  });
  console.log(result.action === "block" ? "PASS" : "FAIL", result);

  console.log(
    "\n--- Test 4: monthly project-scoped rule, unaffected by daily key-scoped spend reset ---",
  );
  await pool.query(
    `INSERT INTO budget_rules (scope_type, scope_id, period, limit_usd, action)
     VALUES ('project', $1, 'monthly', 100.00, 'alert')`,
    [TEST_PROJECT],
  );
  result = await checkBudget(pool, {
    apiKeyId: TEST_KEY,
    projectId: TEST_PROJECT,
  });
  console.log(
    result.action === "block"
      ? "PASS (block still wins, monthly rule under limit)"
      : "FAIL",
    result,
  );

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
