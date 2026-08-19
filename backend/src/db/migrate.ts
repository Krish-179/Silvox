import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  console.log(
    "Applying schema.sql to",
    process.env.DB_URL?.replace(/:[^:@]+@/, ":***@"),
  );
  await pool.query(sql);
  console.log("Done. `requests` table is ready.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
