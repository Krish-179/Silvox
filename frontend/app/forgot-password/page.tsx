"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { api, ApiError } from "@/lib/api";
import { BudgetGauge } from "@/components/BudgetGauge";
import { CornerFrame } from "@/components/CornerFrame";
import { OtpInput } from "@/components/OtpInput";

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

type Step = "request" | "code" | "password" | "done";

export default function ForgotPasswordPage() {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otpKey, setOtpKey] = useState(0);
  const [verifiedCode, setVerifiedCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(c - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setStep("code");
      setCooldown(DEFAULT_COOLDOWN);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Just advances to the password screen locally — the code isn't
  // actually validated against the backend until the password is
  // submitted, since reset-password checks code + sets password in one
  // call. If it turns out wrong, handleReset sends the user back here.
  function handleOtpComplete(code: string) {
    setVerifiedCode(code);
    setError(null);
    setStep("password");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword(email, verifiedCode, newPassword);
      setStep("done");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong.";
      // A wrong/expired code means the problem is on the OTP screen, not
      // the password screen — send them back there with the error shown,
      // rather than failing confusingly on a screen with no code field.
      if (
        err instanceof ApiError &&
        (err.type === "invalid_code" ||
          err.type === "otp_expired" ||
          err.type === "too_many_attempts")
      ) {
        setStep("code");
        setOtpKey((k) => k + 1);
        setError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendMessage(null);
    try {
      await api.forgotPassword(email);
      setCooldown(DEFAULT_COOLDOWN);
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

  const statusLabel =
    step === "request"
      ? "awaiting email"
      : step === "code"
        ? "awaiting code"
        : step === "password"
          ? "code confirmed"
          : "complete";

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel */}
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
            Locked out?
            <br />
            Let's fix that.
          </h2>
          <p className="text-muted text-[15px] max-w-sm leading-relaxed">
            A short code and a new password is all it takes to get back into
            your account — no support ticket required.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
          className="relative z-10 w-full"
        >
          <CornerFrame
            label="recovery"
            tag={email || "awaiting email"}
            className="w-full"
          >
            <div className="flex items-center justify-between gap-8">
              <BudgetGauge target={0} limit={null} size={190} />
              <div className="flex flex-col gap-3 flex-1 max-w-[160px]">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                    Status
                  </div>
                  <div className="font-mono text-sm text-warn">
                    {statusLabel}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                    Expires in
                  </div>
                  <div className="font-mono text-sm">10 min</div>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${step === "done" ? "bg-ok" : "bg-warn"}`}
                  />
                  <span className="text-[11px] text-muted font-mono">
                    {step === "done"
                      ? "access restored"
                      : "recovery in progress"}
                  </span>
                </div>
              </div>
            </div>
          </CornerFrame>
        </motion.div>
      </div>

      {/* Right */}
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
          ?
        </span>

        <div className="relative z-10 w-full max-w-md text-center">
          <AnimatePresence mode="wait">
            {step === "request" && (
              <motion.div
                key="request"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  custom={0}
                  className="mb-10"
                >
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-accent mb-6 md:hidden">
                    <span className="font-mono text-xs font-semibold text-bg">
                      SV
                    </span>
                  </div>
                  <h1
                    className="font-display text-[38px] leading-[1.05] tracking-tight"
                    style={{ fontWeight: 500 }}
                  >
                    Reset your password
                  </h1>
                  <p className="text-muted text-[15px] mt-3">
                    Enter your email and we'll send you a code to reset it.
                  </p>
                </motion.div>

                <motion.form
                  onSubmit={handleRequest}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  custom={1}
                  className="space-y-5 text-left"
                >
                  <div className="group relative">
                    <label className="block text-sm text-muted mb-2.5 group-focus-within:text-accent transition-colors duration-300 ease-out">
                      Email address
                    </label>
                    <div className="flex items-center gap-3 border-b border-border pb-3 transition-colors duration-300 ease-out group-focus-within:border-accent">
                      <Mail
                        size={16}
                        className="text-muted group-focus-within:text-accent transition-colors duration-300 ease-out shrink-0"
                      />
                      <input
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full bg-transparent outline-none text-base text-text placeholder:text-muted/60"
                      />
                    </div>
                  </div>

                  <StatusPill loading={loading} error={error} success={null} />

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent text-bg font-medium text-sm rounded-md py-3.5 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-accent/25 disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send reset code"}
                  </button>
                </motion.form>
              </motion.div>
            )}

            {step === "code" && (
              <motion.div
                key="code"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
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
                    Enter your code
                  </h1>
                  <p className="text-muted text-[15px] mt-3">
                    Sent to <span className="text-text">{email}</span>
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
                    onComplete={handleOtpComplete}
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
              </motion.div>
            )}

            {step === "password" && (
              <motion.div
                key="password"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  custom={0}
                  className="mb-10"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-ok/10 border border-ok/30 mb-6">
                    <CheckCircle2 size={22} className="text-ok" />
                  </div>
                  <h1
                    className="font-display text-[34px] sm:text-[38px] leading-[1.05] tracking-tight"
                    style={{ fontWeight: 500 }}
                  >
                    Choose a new password
                  </h1>
                  <p className="text-muted text-[15px] mt-3">
                    Code confirmed — set your new password below.
                  </p>
                </motion.div>

                <motion.form
                  onSubmit={handleReset}
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  custom={1}
                  className="space-y-5 text-left"
                >
                  <div className="group relative">
                    <label className="block text-sm text-muted mb-2.5 group-focus-within:text-accent transition-colors duration-300 ease-out">
                      New password
                    </label>
                    <div className="flex items-center gap-3 border-b border-border pb-3 transition-colors duration-300 ease-out group-focus-within:border-accent">
                      <Lock
                        size={16}
                        className="text-muted group-focus-within:text-accent transition-colors duration-300 ease-out shrink-0"
                      />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        autoFocus
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full bg-transparent outline-none text-base text-text placeholder:text-muted/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        tabIndex={-1}
                        className="text-muted hover:text-accent transition-colors duration-300 ease-out shrink-0"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <StatusPill loading={loading} error={error} success={null} />

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent text-bg font-medium text-sm rounded-md py-3.5 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-accent/25 disabled:opacity-50"
                  >
                    {loading ? "Resetting..." : "Reset password"}
                  </button>
                </motion.form>
              </motion.div>
            )}

            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-ok/10 border border-ok/30 mb-6">
                  <CheckCircle2 size={22} className="text-ok" />
                </div>
                <h1
                  className="font-display text-[34px] sm:text-[38px] leading-[1.05] tracking-tight mb-3"
                  style={{ fontWeight: 500 }}
                >
                  Password updated
                </h1>
                <p className="text-muted text-[15px] mb-10">
                  You can sign in with your new password now.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 bg-accent text-bg font-medium text-sm rounded-md px-6 py-3.5 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-accent/25"
                >
                  Back to sign in
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {step !== "done" && (
            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-muted hover:text-text transition-colors duration-300 ease-out"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
