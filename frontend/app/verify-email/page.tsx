"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { api, ApiError } from "@/lib/api";
import { OtpInput } from "@/components/OtpInput";
import { BudgetGauge } from "@/components/BudgetGauge";
import { CornerFrame } from "@/components/CornerFrame";
import { Mail } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";

const STORAGE_KEY = "silvox:pendingVerificationEmail";
const DEFAULT_COOLDOWN = 60;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.11,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [otpKey, setOtpKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setEmail(stored);
      setCooldown(DEFAULT_COOLDOWN);
    } else {
      router.replace("/login");
    }
    setChecked(true);
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(c - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleVerify(code: string) {
    if (!email) return;
    setError(null);
    setLoading(true);
    try {
      await api.verifyEmail(email, code);
      sessionStorage.removeItem(STORAGE_KEY);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setOtpKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setError(null);
    setResendMessage(null);
    try {
      const res = await api.resendOtp(email, "verify_email");
      setCooldown(res.cooldownSeconds);
      setResendMessage("A new code has been sent.");
    } catch (err) {
      if (err instanceof ApiError && err.type === "cooldown") {
        const match = err.message.match(/(\d+)s/);
        setCooldown(match ? parseInt(match[1], 10) : DEFAULT_COOLDOWN);
        return;
      }
      setError(
        err instanceof ApiError ? err.message : "Could not resend code.",
      );
    }
  }

  if (!checked || !email) {
    return <div className="min-h-screen bg-bg" />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — same instrument-panel visual as login */}
      <div className="relative hidden md:flex md:w-1/2 bg-nav border-r border-border overflow-hidden flex-col justify-between p-12">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--color-muted)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--color-muted)) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {!shouldReduceMotion && (
          <motion.div
            className="absolute left-0 right-0 h-px pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgb(var(--color-accent) / 0.6), transparent)",
            }}
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
        )}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="relative z-10"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-accent mb-10">
            <span className="font-mono text-sm font-semibold text-bg">SV</span>
          </div>
          <h2
            className="font-display text-4xl leading-[1.1] mb-4"
            style={{ fontWeight: 500 }}
          >
            One code
            <br />
            between you and the meter.
          </h2>
          <p className="text-muted text-[15px] max-w-sm leading-relaxed">
            We've sent a 6-digit code to confirm it's really you — check your
            inbox and enter it to finish setting up your account.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
          className="relative z-10 w-full"
        >
          <CornerFrame label="verifying" tag={email} className="w-full">
            <div className="flex items-center justify-between gap-8">
              <BudgetGauge target={0} limit={null} size={190} />
              <div className="flex flex-col gap-3 flex-1 max-w-[160px]">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                    Status
                  </div>
                  <div className="font-mono text-sm text-warn">
                    awaiting code
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                    Expires in
                  </div>
                  <div className="font-mono text-sm">10 min</div>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
                  <span className="text-[11px] text-muted font-mono">
                    one step from live
                  </span>
                </div>
              </div>
            </div>
          </CornerFrame>
        </motion.div>
      </div>

      {/* Right — OTP flow */}
      <div className="relative flex-1 flex items-center justify-center px-8 md:px-20 py-12 bg-bg overflow-hidden">
        <span
          className="absolute select-none pointer-events-none font-display"
          style={{
            top: "6%",
            right: "-4%",
            fontSize: "clamp(220px, 30vw, 420px)",
            fontWeight: 300,
            color: "rgb(var(--color-accent) / 0.05)",
            lineHeight: 1,
          }}
        >
          #
        </span>

        <div className="relative z-10 w-full max-w-md text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="mb-3"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 border border-accent/30 mb-6">
              <Mail size={22} className="text-accent" />
            </div>
            <h1
              className="font-display text-[34px] sm:text-[38px] leading-[1.05] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Check your email
            </h1>
            <p className="text-muted text-[15px] mt-3">
              We sent a code to <span className="text-text">{email}</span>
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="mt-10"
          >
            <OtpInput
              key={otpKey}
              onComplete={handleVerify}
              disabled={loading}
            />
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="mt-6"
          >
            <StatusPill
              loading={loading}
              error={error}
              success={resendMessage}
              loadingLabel="Verifying..."
            />
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
            className="mt-4"
          >
            <button
              onClick={handleResend}
              disabled={cooldown > 0}
              className="text-sm text-accent hover:underline disabled:opacity-50 disabled:no-underline transition-colors duration-300 ease-out"
            >
              {cooldown > 0
                ? `Resend code in ${cooldown}s`
                : "Didn't get it? Resend code"}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
