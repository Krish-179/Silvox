import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SignOptions } from "jsonwebtoken";
import { pool } from "../db/client.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signSession } from "../auth/jwt.js";
import { generateOtpCode, hashOtpCode } from "../auth/otp.js";
import { sendOtpEmail } from "../services/email.js";
import { requireSession, SESSION_COOKIE } from "../middleware/session.js";
import { logProxyError } from "../services/proxyErrorLog.js";
import {
  OTP_EXPIRY_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  MAX_OTP_ATTEMPTS,
  getSignup,
  setSignup,
  bumpSignupAttempts,
  deleteSignup,
  getReset,
  setReset,
  bumpResetAttempts,
  deleteReset,
} from "../auth/otpStore.js";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

function devLogOtp(email: string, purpose: string, code: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] OTP for ${email} (${purpose}): ${code}`);
  }
}

async function sendOtpSafe(
  email: string,
  code: string,
  purpose: "verify_email" | "reset_password",
) {
  try {
    await sendOtpEmail(email, code, purpose);
  } catch (err) {
    console.error(`Failed to send ${purpose} OTP email to ${email}:`, err);
  }
}

/**
 * Every route below touches Postgres and/or Redis (via otpStore). None of
 * that was previously guarded — an outage on either meant a raw connection
 * error (e.g. "connect ECONNREFUSED ...") leaked straight to the client as
 * an unhandled 500, and nothing was recorded anywhere durable.
 *
 * These are auth/account routes — unlike the proxy's budget check, they
 * must fail CLOSED on infra failure (an outage must never let an
 * unauthenticated action succeed). So the fix here is not "fail open,"
 * it's: catch, log to proxy_errors, return an honest 503 instead of
 * leaking internals or crashing.
 */
function infraErrorReply(
  req: FastifyRequest,
  reply: FastifyReply,
  err: unknown,
  errorType: string,
  context?: Record<string, unknown>,
) {
  logProxyError(pool, {
    errorType,
    message: (err as Error).message,
    route: req.url,
    context,
  });
  return reply.code(503).send({
    error: {
      type: "service_unavailable",
      message:
        "Something went wrong on our end — please try again in a moment.",
    },
  });
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };
    if (!email || !password || password.length < 8) {
      return reply.code(400).send({
        error: {
          type: "invalid_request",
          message: "email and password (min 8 chars) required",
        },
      });
    }

    try {
      const existingUser = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [email],
      );
      if (existingUser.rows.length > 0) {
        return reply.code(409).send({
          error: { type: "conflict", message: "Email already registered" },
        });
      }

      const existingPending = await getSignup(email);
      if (existingPending) {
        const secondsSinceLast =
          (Date.now() - existingPending.lastSentAt) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
          return reply.code(429).send({
            error: {
              type: "cooldown",
              message: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before trying again.`,
            },
          });
        }
      }

      const passwordHash = await hashPassword(password);
      const code = generateOtpCode();
      const codeHash = hashOtpCode(code);

      await setSignup(email, {
        passwordHash,
        codeHash,
        attempts: 0,
        lastSentAt: Date.now(),
      });

      devLogOtp(email, "verify_email", code);
      await sendOtpSafe(email, code, "verify_email");

      return reply.code(201).send({ email, requiresVerification: true });
    } catch (err) {
      return infraErrorReply(req, reply, err, "auth_register_failed", {
        email,
      });
    }
  });

  app.post("/auth/verify-email", async (req, reply) => {
    const { email, code } = req.body as { email?: string; code?: string };
    if (!email || !code) {
      return reply.code(400).send({
        error: {
          type: "invalid_request",
          message: "email and code required",
        },
      });
    }

    try {
      const pending = await getSignup(email);
      if (!pending) {
        return reply.code(400).send({
          error: {
            type: "otp_expired",
            message: "Code expired or not found. Please sign up again.",
          },
        });
      }
      if (pending.attempts >= MAX_OTP_ATTEMPTS) {
        return reply.code(429).send({
          error: {
            type: "too_many_attempts",
            message: "Too many incorrect attempts. Please sign up again.",
          },
        });
      }
      if (hashOtpCode(code) !== pending.codeHash) {
        await bumpSignupAttempts(email, pending);
        return reply
          .code(400)
          .send({ error: { type: "invalid_code", message: "Incorrect code" } });
      }

      const userResult = await pool.query<{ id: string; email: string }>(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
        [email, pending.passwordHash],
      );
      const user = userResult.rows[0];
      await deleteSignup(email);

      const token = signSession({ userId: user.id, email: user.email });
      reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTS);
      return reply.send({ id: user.id, email: user.email });
    } catch (err) {
      return infraErrorReply(req, reply, err, "auth_verify_email_failed", {
        email,
      });
    }
  });

  app.post("/auth/resend-otp", async (req, reply) => {
    const { email, purpose } = req.body as {
      email?: string;
      purpose?: "verify_email" | "reset_password";
    };
    if (
      !email ||
      !purpose ||
      !["verify_email", "reset_password"].includes(purpose)
    ) {
      return reply.code(400).send({
        error: {
          type: "invalid_request",
          message: "email and valid purpose required",
        },
      });
    }

    try {
      if (purpose === "verify_email") {
        const pending = await getSignup(email);
        if (!pending) {
          return reply.send({
            ok: true,
            cooldownSeconds: RESEND_COOLDOWN_SECONDS,
          });
        }
        const secondsSinceLast = (Date.now() - pending.lastSentAt) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
          return reply.code(429).send({
            error: {
              type: "cooldown",
              message: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another code.`,
            },
          });
        }
        const code = generateOtpCode();
        const codeHash = hashOtpCode(code);
        await setSignup(email, {
          ...pending,
          codeHash,
          attempts: 0,
          lastSentAt: Date.now(),
        });
        devLogOtp(email, purpose, code);
        await sendOtpSafe(email, code, purpose);
        return reply.send({
          ok: true,
          cooldownSeconds: RESEND_COOLDOWN_SECONDS,
        });
      }

      const userResult = await pool.query<{ id: string; email: string }>(
        `SELECT id, email FROM users WHERE email = $1`,
        [email],
      );
      const user = userResult.rows[0];
      if (!user) {
        return reply.send({
          ok: true,
          cooldownSeconds: RESEND_COOLDOWN_SECONDS,
        });
      }

      const existing = await getReset(user.id);
      if (existing) {
        const secondsSinceLast = (Date.now() - existing.lastSentAt) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
          return reply.code(429).send({
            error: {
              type: "cooldown",
              message: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another code.`,
            },
          });
        }
      }
      const code = generateOtpCode();
      const codeHash = hashOtpCode(code);
      await setReset(user.id, {
        codeHash,
        attempts: 0,
        lastSentAt: Date.now(),
      });
      devLogOtp(email, purpose, code);
      await sendOtpSafe(user.email, code, purpose);
      return reply.send({ ok: true, cooldownSeconds: RESEND_COOLDOWN_SECONDS });
    } catch (err) {
      return infraErrorReply(req, reply, err, "auth_resend_otp_failed", {
        email,
        purpose,
      });
    }
  });

  app.post("/auth/forgot-password", async (req, reply) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      return reply.code(400).send({
        error: { type: "invalid_request", message: "email required" },
      });
    }

    try {
      const userResult = await pool.query<{ id: string; email: string }>(
        `SELECT id, email FROM users WHERE email = $1`,
        [email],
      );
      const user = userResult.rows[0];

      if (user) {
        const code = generateOtpCode();
        const codeHash = hashOtpCode(code);
        await setReset(user.id, {
          codeHash,
          attempts: 0,
          lastSentAt: Date.now(),
        });
        devLogOtp(email, "reset_password", code);
        await sendOtpSafe(user.email, code, "reset_password");
      }
      return reply.send({ ok: true });
    } catch (err) {
      return infraErrorReply(req, reply, err, "auth_forgot_password_failed", {
        email,
      });
    }
  });

  app.post("/auth/reset-password", async (req, reply) => {
    const { email, code, newPassword } = req.body as {
      email?: string;
      code?: string;
      newPassword?: string;
    };
    if (!email || !code || !newPassword || newPassword.length < 8) {
      return reply.code(400).send({
        error: {
          type: "invalid_request",
          message: "email, code, and newPassword (min 8 chars) required",
        },
      });
    }

    try {
      const userResult = await pool.query<{ id: string }>(
        `SELECT id FROM users WHERE email = $1`,
        [email],
      );
      const user = userResult.rows[0];
      if (!user) {
        return reply.code(400).send({
          error: { type: "invalid_code", message: "Invalid or expired code" },
        });
      }

      const otp = await getReset(user.id);
      if (!otp) {
        return reply.code(400).send({
          error: {
            type: "otp_expired",
            message: "Code expired or not found. Request a new one.",
          },
        });
      }
      if (otp.attempts >= MAX_OTP_ATTEMPTS) {
        return reply.code(429).send({
          error: {
            type: "too_many_attempts",
            message: "Too many incorrect attempts. Request a new code.",
          },
        });
      }
      if (hashOtpCode(code) !== otp.codeHash) {
        await bumpResetAttempts(user.id, otp);
        return reply
          .code(400)
          .send({ error: { type: "invalid_code", message: "Incorrect code" } });
      }

      const passwordHash = await hashPassword(newPassword);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
        passwordHash,
        user.id,
      ]);
      await deleteReset(user.id);

      return reply.send({ ok: true });
    } catch (err) {
      return infraErrorReply(req, reply, err, "auth_reset_password_failed", {
        email,
      });
    }
  });

  app.post("/auth/login", async (req, reply) => {
    const { email, password, rememberMe } = req.body as {
      email?: string;
      password?: string;
      rememberMe?: boolean;
    };
    if (!email || !password) {
      return reply.code(400).send({
        error: {
          type: "invalid_request",
          message: "email and password required",
        },
      });
    }

    try {
      const result = await pool.query<{
        id: string;
        email: string;
        password_hash: string;
      }>("SELECT id, email, password_hash FROM users WHERE email = $1", [
        email,
      ]);
      const user = result.rows[0];
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return reply.code(401).send({
          error: {
            type: "authentication_error",
            message: "Invalid email or password",
          },
        });
      }

      const expiresIn: SignOptions["expiresIn"] = rememberMe ? "30d" : "1d";
      const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

      const token = signSession(
        { userId: user.id, email: user.email },
        expiresIn,
      );
      reply.setCookie(SESSION_COOKIE, token, { ...COOKIE_OPTS, maxAge });
      return reply.send({ id: user.id, email: user.email });
    } catch (err) {
      return infraErrorReply(req, reply, err, "auth_login_failed", { email });
    }
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/auth/me", { preHandler: requireSession }, async (req, reply) => {
    return reply.send({ userId: req.userId, email: req.userEmail });
  });
}
