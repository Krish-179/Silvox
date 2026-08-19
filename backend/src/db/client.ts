import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({
  connectionString: config.dbUrl,
});

pool.on("error", (err) => {
  // Idle client errors shouldn't crash the process — log and move on.
  console.error("Unexpected Postgres pool error", err);
});