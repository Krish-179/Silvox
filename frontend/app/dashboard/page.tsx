"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Layers, Plug } from "lucide-react";
import { api, ApiError, type SpendData } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { BudgetGauge } from "@/components/BudgetGauge";
import { useProject } from "@/lib/ProjectContext";
import { PageSkeleton } from "@/components/Skeleton";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

const SEVERITY: Record<string, number> = { block: 3, downgrade: 2, alert: 1 };

interface RuleWithProgress {
  id: string;
  period: string;
  limitUsd: number;
  action: string;
  currentSpend: number;
  pct: number;
  scopeType: "project" | "api_key";
  keyDisplayPrefix: string | null;
}

function pickHeroRule(
  rules: SpendData["activeRules"],
): { hero: RuleWithProgress; rest: RuleWithProgress[] } | null {
  if (rules.length === 0) return null;
  const withProgress: RuleWithProgress[] = rules.map((r) => ({
    ...r,
    pct: r.limitUsd > 0 ? r.currentSpend / r.limitUsd : 0,
  }));
  withProgress.sort((a, b) => {
    const severityDiff = (SEVERITY[b.action] ?? 0) - (SEVERITY[a.action] ?? 0);
    if (severityDiff !== 0) return severityDiff;
    return b.pct - a.pct;
  });
  return { hero: withProgress[0], rest: withProgress.slice(1) };
}

function DashboardContent() {
  const { selectedProject: project } = useProject();
  const [spend, setSpend] = useState<SpendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    setError(null);
    api
      .getSpend(project.id, 7)
      .then(setSpend)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Could not load spend data.",
        ),
      )
      .finally(() => setLoading(false));
  }, [project]);

  if (loading) return <PageSkeleton />;
  if (error)
    return (
      <div className="text-sm text-block bg-block/10 border border-block/30 rounded-md px-4 py-3">
        {error}
      </div>
    );
  if (!spend) return null;

  const hasAnyRequests = spend.daily.length > 0 || spend.byModel.length > 0;
  const maxDaily = Math.max(1, ...spend.daily.map((d) => d.spend));
  const totalByModel = spend.byModel.reduce((sum, m) => sum + m.spend, 0);
  const totalByKey = spend.byKey.reduce((sum, k) => sum + k.spend, 0);

  const ruleSelection = pickHeroRule(spend.activeRules);
  const heroRule = ruleSelection?.hero ?? null;
  const otherRules = ruleSelection?.rest ?? [];

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        custom={0}
        className="mb-10"
      >
        <h2 className="font-display text-3xl mb-2" style={{ fontWeight: 500 }}>
          Overview
        </h2>
        <p className="text-muted text-base">
          Where your spend stands right now.
        </p>
      </motion.div>

      {!hasAnyRequests ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
          className="flex flex-col items-center text-center py-20 border-t border-b border-border"
        >
          <Plug size={28} className="text-muted mb-4" />
          <h3 className="font-display text-xl mb-2" style={{ fontWeight: 500 }}>
            No requests yet
          </h3>
          <p className="text-muted text-base max-w-sm mb-1">
            Point your app at Silvox and send a request — spend and usage will
            show up here in real time.
          </p>
          <p className="text-muted text-sm font-mono mt-3">POST /v1/messages</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
          {/* Gauge card — hero rule + secondary rules list */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="lg:col-span-2 border border-border rounded-md p-6 flex flex-col items-center"
          >
            <div className="text-xs uppercase tracking-widest text-muted self-start mb-2">
              {heroRule
                ? `${heroRule.period === "daily" ? "Daily" : "Monthly"} spend`
                : "Monthly spend"}
            </div>
            <BudgetGauge
              target={
                heroRule ? heroRule.currentSpend : spend.currentMonthSpend
              }
              limit={heroRule?.limitUsd ?? null}
              size={200}
            />
            {heroRule && (
              <div className="flex items-center gap-1.5 mt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-warn" />
                <span className="text-xs text-muted font-mono">
                  {heroRule.action} @ {heroRule.period}
                  {heroRule.scopeType === "api_key" &&
                    heroRule.keyDisplayPrefix &&
                    ` · ${heroRule.keyDisplayPrefix}···`}
                </span>
              </div>
            )}

            {otherRules.length > 0 && (
              <div className="w-full mt-6 pt-5 border-t border-border-soft space-y-3">
                <div className="text-xs text-muted uppercase tracking-widest">
                  Other active rules
                </div>
                {otherRules.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="text-xs font-mono w-16 shrink-0 capitalize">
                      {r.action}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(r.pct * 100, 100)}%`,
                          backgroundColor:
                            r.pct > 0.85
                              ? "rgb(var(--color-block))"
                              : "rgb(var(--color-accent))",
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted shrink-0">
                      ${r.currentSpend.toFixed(2)}/${r.limitUsd.toFixed(0)}
                      {r.scopeType === "api_key" &&
                        r.keyDisplayPrefix &&
                        ` · ${r.keyDisplayPrefix}···`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Spend over time */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="lg:col-span-3 border border-border rounded-md p-6 flex flex-col"
          >
            <div className="text-xs uppercase tracking-widest text-muted mb-4">
              Spend, last {spend.windowDays} days
            </div>
            {spend.daily.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <BarChart3 size={22} className="text-muted mb-2" />
                <p className="text-sm text-muted">
                  No spend recorded in this window.
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 flex items-end gap-3 min-h-[160px]">
                  {spend.daily.map((d) => (
                    <div
                      key={d.day}
                      className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
                    >
                      <div className="w-full flex-1 flex items-end justify-center">
                        <div
                          className="rounded-t-sm"
                          style={{
                            height: `${Math.max((d.spend / maxDaily) * 100, d.spend > 0 ? 4 : 0)}%`,
                            backgroundColor: "rgb(var(--color-accent))",
                            width: "60%",
                          }}
                        />
                      </div>
                      <span className="text-[10px] uppercase text-muted shrink-0">
                        {new Date(d.day).toLocaleDateString(undefined, {
                          weekday: "short",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-border flex justify-between shrink-0">
                  <span className="text-xs text-muted">
                    Total, {spend.windowDays}d
                  </span>
                  <span className="font-mono text-sm">
                    $
                    {spend.daily
                      .reduce((sum, d) => sum + d.spend, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {hasAnyRequests && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={3}
          className="border border-border rounded-md p-6"
        >
          <div className="text-xs uppercase tracking-widest text-muted mb-4">
            Breakdown by model
          </div>
          {spend.byModel.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Layers size={22} className="text-muted mb-2" />
              <p className="text-sm text-muted">
                No model data in this window.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {spend.byModel.map((m) => {
                const pct =
                  totalByModel > 0
                    ? Math.round((m.spend / totalByModel) * 100)
                    : 0;
                return (
                  <div key={m.model} className="flex items-center gap-4">
                    <span className="font-mono text-sm w-44 shrink-0 truncate">
                      {m.model}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs w-12 text-right text-muted">
                      {pct}%
                    </span>
                    <span className="font-mono text-sm w-20 text-right">
                      ${m.spend.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {hasAnyRequests && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={4}
          className="border border-border rounded-md p-6 mt-6"
        >
          <div className="text-xs uppercase tracking-widest text-muted mb-4">
            Breakdown by key
          </div>
          {spend.byKey.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Layers size={22} className="text-muted mb-2" />
              <p className="text-sm text-muted">No key data in this window.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {spend.byKey.map((k) => {
                const pct =
                  totalByKey > 0 ? Math.round((k.spend / totalByKey) * 100) : 0;
                return (
                  <div
                    key={k.apiKeyId ?? "unknown"}
                    className="flex items-center gap-4"
                  >
                    <span className="font-mono text-sm w-44 shrink-0 truncate">
                      {k.displayPrefix}···
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs w-12 text-right text-muted">
                      {pct}%
                    </span>
                    <span className="font-mono text-sm w-20 text-right">
                      ${k.spend.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
