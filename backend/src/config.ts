import "dotenv/config";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  baseUrl: required("BASE_URL", process.env.BASE_URL),
  upstreamApiKey: process.env.UPSTREAM_API_KEY ?? "",
  port: Number(process.env.PORT ?? 3000),
  dbUrl: required("DB_URL", process.env.DB_URL),
  redisUrl: required("REDIS_URL", process.env.REDIS_URL),
  jwtSecret: required("JWT_SECRET", process.env.JWT_SECRET),
  // Placeholder single dev key for Phase 1/2 — not real key management.
  // Defaults so this works without an .env edit; override if you want.
  devApiKey: process.env.DEV_API_KEY ?? "dev-key-local-123",
  // Mode is inferred, not set separately — avoids config drift between
  // BASE_URL and a redundant MODE flag.
  isMock:
    !required("BASE_URL", process.env.BASE_URL).includes("anthropic.com") &&
    !required("BASE_URL", process.env.BASE_URL).includes("openai.com"),
  resendApiKey: required("RESEND_API_KEY", process.env.RESEND_API_KEY),
  emailFrom: process.env.EMAIL_FROM ?? "Silvox <onboarding@resend.dev>",
};
