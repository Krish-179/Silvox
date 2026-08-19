import { redis } from "../lib/redisClient.js";

export const OTP_EXPIRY_SECONDS = 10 * 60;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_OTP_ATTEMPTS = 5;

interface SignupRecord {
  passwordHash: string;
  codeHash: string;
  attempts: number;
  lastSentAt: number; // epoch ms — used for the resend cooldown check
}

interface ResetRecord {
  codeHash: string;
  attempts: number;
  lastSentAt: number;
}

const signupKey = (email: string) => `signup:${email}`;
const resetKey = (userId: string) => `reset:${userId}`;

// Redis handles expiry natively (EX seconds) — no expires_at column, no
// "is this row stale" query. A key that's gone IS the expired state.

export async function getSignup(email: string): Promise<SignupRecord | null> {
  const raw = await redis.get(signupKey(email));
  return raw ? JSON.parse(raw) : null;
}

export async function setSignup(
  email: string,
  record: SignupRecord,
): Promise<void> {
  await redis.set(
    signupKey(email),
    JSON.stringify(record),
    "EX",
    OTP_EXPIRY_SECONDS,
  );
}

export async function bumpSignupAttempts(
  email: string,
  record: SignupRecord,
): Promise<void> {
  const ttl = await redis.ttl(signupKey(email));
  await redis.set(
    signupKey(email),
    JSON.stringify({ ...record, attempts: record.attempts + 1 }),
    "EX",
    ttl > 0 ? ttl : OTP_EXPIRY_SECONDS,
  );
}

export async function deleteSignup(email: string): Promise<void> {
  await redis.del(signupKey(email));
}

export async function getReset(userId: string): Promise<ResetRecord | null> {
  const raw = await redis.get(resetKey(userId));
  return raw ? JSON.parse(raw) : null;
}

export async function setReset(
  userId: string,
  record: ResetRecord,
): Promise<void> {
  await redis.set(
    resetKey(userId),
    JSON.stringify(record),
    "EX",
    OTP_EXPIRY_SECONDS,
  );
}

export async function bumpResetAttempts(
  userId: string,
  record: ResetRecord,
): Promise<void> {
  const ttl = await redis.ttl(resetKey(userId));
  await redis.set(
    resetKey(userId),
    JSON.stringify({ ...record, attempts: record.attempts + 1 }),
    "EX",
    ttl > 0 ? ttl : OTP_EXPIRY_SECONDS,
  );
}

export async function deleteReset(userId: string): Promise<void> {
  await redis.del(resetKey(userId));
}
