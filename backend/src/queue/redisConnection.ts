import { Redis } from "ioredis";
import { config } from "../config.js";

// BullMQ recommends separate Redis connections for Queue (producer) vs
// Worker (consumer) — the worker issues blocking commands that can stall
// a shared connection's other traffic. Call this once per role, don't share
// the instance.
export function createConnection(): Redis {
  const conn = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });
  conn.on("error", (err: Error) => {
    console.error("Redis connection error", err);
  });
  return conn;
}
