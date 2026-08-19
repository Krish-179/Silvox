import { randomInt, createHash } from "node:crypto";

export function generateOtpCode(): string {
  return randomInt(100000, 999999).toString();
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
