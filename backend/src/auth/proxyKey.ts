import { randomBytes, createHash } from "node:crypto";

const KEY_PREFIX = "sv_live_";

export interface GeneratedKey {
  raw: string;       // shown to user ONCE, never stored
  hash: string;       // stored in DB
  displayPrefix: string; // e.g. "sv_live_a1b2c3d4" — safe to store/show for identification
}

export function generateProxyKey(): GeneratedKey {
  const secret = randomBytes(24).toString("hex"); // 48 hex chars
  const raw = `${KEY_PREFIX}${secret}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const displayPrefix = raw.slice(0, KEY_PREFIX.length + 8);
  return { raw, hash, displayPrefix };
}

export function hashProxyKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}