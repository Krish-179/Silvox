import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config.js";

export interface SessionPayload {
  userId: string;
  email: string;
}

export function signSession(
  payload: SessionPayload,
  expiresIn: SignOptions["expiresIn"] = "1d",
): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as SessionPayload;
  } catch {
    return null;
  }
}
