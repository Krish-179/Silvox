"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Zap, ShieldCheck, LineChart, Check } from "lucide-react";
import { BudgetGauge } from "@/components/BudgetGauge";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Point your app at Silvox",
    body: "Swap your provider's base URL for ours. One line, no SDK changes, works with your existing Anthropic or OpenAI client.",
  },
  {
    step: "02",
    title: "Every request is metered",
    body: "Tokens and cost are tracked in real time, per key and per project — streaming included, with no added latency to your app.",
  },
  {
    step: "03",
    title: "Set a limit, choose the response",
    body: "Alert, downgrade to a cheaper model, or hard-block — you decide what happens before the bill happens, not after.",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "$9",
    period: "/mo",
    description: "For solo devs watching spend on a couple of projects.",
    features: [
      "2 projects / keys",
      "Alert-only mode",
      "30-day request log retention",
      "1 dashboard seat",
      "Community + email support",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Solo / Team",
    price: "$25",
    period: "/mo",
    description:
      "Real enforcement — block or downgrade before the bill happens.",
    features: [
      "10 projects / keys",
      "Alert + enforcement (block, downgrade)",
      "Unlimited request log retention",
      "3 dashboard seats",
      "Email support",
    ],
    cta: "Get started",
    highlighted: true,
  },
  {
    name: "Growth",
    price: "$49",
    period: "/mo",
    description:
      "For teams running enforcement at scale, with more routing options.",
    features: [
      "Unlimited projects / keys",
      "Alert + enforcement (block, downgrade)",
      "Unlimited request log retention",
      "Unlimited dashboard seats",
      "Custom webhooks (PagerDuty, Email digest, Slack)",
      "Priority support",
    ],
    cta: "Get started",
    highlighted: false,
  },
];

export default function LandingPage() {
  const shouldReduceMotion = useReducedMotion();
  const [gaugeValue] = useState(62.4);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 sm:px-10 lg:px-16 py-6 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-accent">
            <span className="font-mono text-xs font-semibold text-bg">SV</span>
          </div>
          <span
            className="font-mono tracking-tight text-lg"
            style={{ fontWeight: 600 }}
          >
            SILVOX
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="#pricing"
            className="hidden sm:block text-sm text-muted hover:text-text transition-colors duration-300 ease-out"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted hover:text-text transition-colors duration-300 ease-out"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="bg-accent text-bg text-sm font-medium px-4 py-2 rounded-md transition-all duration-300 ease-out hover:shadow-lg hover:shadow-accent/25"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 sm:px-10 lg:px-16 py-10 lg:py-16">
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--color-muted)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--color-muted)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 text-xs text-warn bg-warn/10 border border-warn/30 rounded-full px-3 py-1.5 mb-6">
              <Zap size={12} />A circuit breaker for your LLM bill
            </div>
            <h1
              className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mb-6"
              style={{ fontWeight: 500 }}
            >
              Know your spend
              <br />
              before it knows you.
            </h1>
            <p className="text-muted text-lg leading-relaxed max-w-lg mb-8">
              Silvox sits between your app and your LLM provider — tracking
              every token, enforcing budgets, and stopping runaway costs before
              they hit your card.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 bg-accent text-bg font-medium px-6 py-3.5 rounded-md transition-all duration-300 ease-out hover:shadow-lg hover:shadow-accent/25"
              >
                Get started free
                <ArrowRight size={16} />
              </Link>
              <Link
                href="#how-it-works"
                className="flex items-center justify-center gap-2 border border-border text-text font-medium px-6 py-3.5 rounded-md transition-colors duration-300 ease-out hover:border-accent"
              >
                See how it works
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="flex justify-center lg:justify-end"
          >
            <div className="border border-border rounded-md p-8 bg-surface/50 w-full max-w-sm">
              <div className="text-xs uppercase tracking-widest text-muted mb-4">
                Monthly spend
              </div>
              <div className="flex justify-center">
                <BudgetGauge target={gaugeValue} limit={100} size={220} />
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
                <span className="text-xs text-muted font-mono">
                  live, updated in real time
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="px-6 sm:px-10 lg:px-16 py-20 border-t border-border"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="mb-14 max-w-xl"
          >
            <h2
              className="font-display text-3xl sm:text-4xl mb-4"
              style={{ fontWeight: 500 }}
            >
              How it works
            </h2>
            <p className="text-muted text-base">
              Three steps between you and a bill you can actually predict.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={item.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
              >
                <div className="font-mono text-sm text-accent mb-4">
                  {item.step}
                </div>
                <h3
                  className="font-display text-xl mb-3"
                  style={{ fontWeight: 500 }}
                >
                  {item.title}
                </h3>
                <p className="text-muted text-[15px] leading-relaxed">
                  {item.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Value props strip */}
      <section className="px-6 sm:px-10 lg:px-16 py-16 border-t border-border bg-surface/30">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10">
          {[
            {
              Icon: LineChart,
              title: "Real-time tracking",
              body: "Spend updates as requests stream, not after the bill arrives.",
            },
            {
              Icon: ShieldCheck,
              title: "Enforcement, not just alerts",
              body: "Alert, downgrade, or block — enforcement is opt-in, alerting is the default.",
            },
            {
              Icon: Zap,
              title: "No SDK changes",
              body: "Point your existing client at a new base URL. That's the whole integration.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-md border border-border flex items-center justify-center shrink-0">
                <item.Icon size={18} className="text-accent" />
              </div>
              <div>
                <h4 className="text-base font-medium mb-1.5">{item.title}</h4>
                <p className="text-muted text-sm leading-relaxed">
                  {item.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="px-6 sm:px-10 lg:px-16 py-20 border-t border-border"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="mb-14 max-w-xl"
          >
            <h2
              className="font-display text-3xl sm:text-4xl mb-4"
              style={{ fontWeight: 500 }}
            >
              Simple pricing
            </h2>
            <p className="text-muted text-base">
              Simple, usage-based plans. Enforcement unlocks at Solo/Team.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                className="rounded-md p-7 flex flex-col"
                style={{
                  border: tier.highlighted
                    ? "1px solid rgb(var(--color-accent))"
                    : "1px solid rgb(var(--color-border))",
                  backgroundColor: tier.highlighted
                    ? "rgb(var(--color-accent) / 0.06)"
                    : "transparent",
                }}
              >
                {tier.highlighted && (
                  <span className="text-[10px] uppercase tracking-widest text-accent mb-3">
                    Most popular
                  </span>
                )}
                <h3
                  className="font-display text-xl mb-1"
                  style={{ fontWeight: 500 }}
                >
                  {tier.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="font-mono text-3xl">{tier.price}</span>
                  <span className="text-muted text-sm">{tier.period}</span>
                </div>
                <p className="text-muted text-sm mb-6">{tier.description}</p>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check
                        size={15}
                        className="text-accent shrink-0 mt-0.5"
                      />
                      <span className="text-muted">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className="text-center text-sm font-medium py-3 rounded-md transition-all duration-300 ease-out"
                  style={{
                    backgroundColor: tier.highlighted
                      ? "rgb(var(--color-accent))"
                      : "transparent",
                    color: tier.highlighted
                      ? "rgb(var(--color-bg))"
                      : "rgb(var(--color-text))",
                    border: tier.highlighted
                      ? "none"
                      : "1px solid rgb(var(--color-border))",
                  }}
                >
                  {tier.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 sm:px-10 lg:px-16 py-20 border-t border-border text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="max-w-xl mx-auto"
        >
          <h2
            className="font-display text-3xl sm:text-4xl mb-4"
            style={{ fontWeight: 500 }}
          >
            Stop finding out from the bill.
          </h2>
          <p className="text-muted text-base mb-8">
            Set up your first budget rule in under five minutes.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-accent text-bg font-medium px-6 py-3.5 rounded-md transition-all duration-300 ease-out hover:shadow-lg hover:shadow-accent/25"
          >
            Get started free
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      </section>

      <footer className="px-6 sm:px-10 lg:px-16 py-8 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted">© 2026 Silvox</span>
        <span className="text-xs text-muted font-mono">
          a circuit breaker for your LLM bill
        </span>
      </footer>
    </div>
  );
}
