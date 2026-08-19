"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  animate,
} from "framer-motion";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BudgetGauge } from "@/components/BudgetGauge";
import { CornerFrame } from "@/components/CornerFrame";

function useCountUp(target: number, duration = 1.8) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [target, duration]);
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const trackedSpend = useCountUp(184290);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await api.login(email, password, rememberMe);
        router.push("/dashboard");
      } else {
        await api.register(email, password);
        sessionStorage.setItem("silvox:pendingVerificationEmail", email);
        router.push("/verify-email");
      }
    } catch (err) {
      if (err instanceof ApiError && err.type === "email_not_verified") {
        sessionStorage.setItem("silvox:pendingVerificationEmail", email);
        router.push("/verify-email");
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const fadeUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 24 },
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

  const headline = mode === "login" ? "Welcome back" : "Let's get started";

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
            Know your spend
            <br />
            before it knows you.
          </h2>
          <p className="text-muted text-[15px] max-w-sm leading-relaxed">
            Silvox sits in front of every request to your LLM provider —
            tracking cost in real time and holding the line when a budget's
            about to break.
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
            label="live readout"
            tag="proj: silvox-dev"
            className="w-full"
          >
            <div className="flex items-center justify-between gap-8">
              <BudgetGauge target={62.4} limit={100} size={190} />
              <div className="flex flex-col gap-3 flex-1 max-w-[160px]">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                    Period
                  </div>
                  <div className="font-mono text-sm">Monthly</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                    Days left
                  </div>
                  <div className="font-mono text-sm">18</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted mb-1">
                    Rule
                  </div>
                  <div className="font-mono text-sm text-warn">alert @ 80%</div>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
                  <span className="text-[11px] text-muted font-mono">
                    live, 2s ago
                  </span>
                </div>
              </div>
            </div>
          </CornerFrame>
        </motion.div>
      </div>

      {/* Right — editorial typographic treatment, no box */}
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
          $
        </span>

        <div className="relative z-10 w-full max-w-md">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="mb-3"
          >
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-accent mb-6 md:hidden">
              <span className="font-mono text-xs font-semibold text-bg">
                SV
              </span>
            </div>
            <h1
              className="font-display text-[42px] leading-[1.05] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={headline}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block"
                >
                  {headline}
                </motion.span>
              </AnimatePresence>
            </h1>
            <p className="text-muted text-[15px] mt-3">
              {mode === "login"
                ? "Sign in to see where your spend stands."
                : "Create a free account — takes about a minute."}
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="mb-10"
          >
            <p className="text-sm text-muted">
              <span className="font-mono text-accent text-base">
                ${Math.round(trackedSpend).toLocaleString()}
              </span>{" "}
              in spend tracked and enforced this month
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="flex gap-8 mb-9 border-b border-border"
          >
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className="relative pb-3 text-sm transition-colors duration-300 ease-out"
                style={{
                  color:
                    mode === m
                      ? "rgb(var(--color-text))"
                      : "rgb(var(--color-muted))",
                }}
              >
                {m === "login" ? "Sign in" : "Create account"}
                {mode === m && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute left-0 right-0 -bottom-px h-[2px] bg-accent"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
            className="space-y-6"
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent outline-none text-base text-text placeholder:text-muted/60"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div className="group relative">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-sm text-muted group-focus-within:text-accent transition-colors duration-300 ease-out">
                  Password
                </label>
                {mode === "login" && (
                  <Link
                    href="/forgot-password"
                    className="text-xs text-accent hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-3 border-b border-border pb-3 transition-colors duration-300 ease-out group-focus-within:border-accent">
                <Lock
                  size={16}
                  className="text-muted group-focus-within:text-accent transition-colors duration-300 ease-out shrink-0"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent outline-none text-base text-text placeholder:text-muted/60"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-muted hover:text-accent transition-colors duration-300 ease-out shrink-0"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === "login" && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                <span className="relative inline-flex items-center justify-center w-4 h-4 shrink-0">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="absolute inset-0 rounded-[4px] border border-border transition-colors duration-300 ease-out peer-checked:border-accent peer-checked:bg-accent" />
                  <motion.svg
                    viewBox="0 0 16 16"
                    className="relative w-2.5 h-2.5 pointer-events-none"
                    initial={false}
                    animate={{
                      opacity: rememberMe ? 1 : 0,
                      scale: rememberMe ? 1 : 0.6,
                    }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <path
                      d="M2 8 L6 12 L14 3"
                      stroke="rgb(var(--color-bg))"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </motion.svg>
                </span>
                <span className="text-sm text-muted">Remember me</span>
              </label>
            )}

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key={error}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="text-sm text-block bg-block/10 border border-block/30 rounded-md px-3 py-2.5 overflow-hidden"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={shouldReduceMotion ? undefined : "hover"}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              className="group w-full bg-accent text-bg font-medium text-sm rounded-md py-3.5 mt-2 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-accent/25 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>
                {loading
                  ? "One moment..."
                  : mode === "login"
                    ? "Sign in"
                    : "Create my account"}
              </span>
              {!loading && (
                <motion.span
                  variants={{ hover: { x: 4 } }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-flex"
                >
                  <ArrowRight size={16} />
                </motion.span>
              )}
            </motion.button>

            {mode === "register" && (
              <p className="text-center text-xs text-muted">
                By creating an account you agree to our{" "}
                <Link href="/terms" className="text-accent hover:underline">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-accent hover:underline">
                  privacy policy
                </Link>
                .
              </p>
            )}
          </motion.form>
        </div>
      </div>
    </div>
  );
}
