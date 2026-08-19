"use client";

import { useState, useEffect } from "react";
import { CreditCard, Check, Mail, Receipt } from "lucide-react";
import { api, type Subscription, type SubscriptionPurchase } from "@/lib/api";
import { AppShell } from "@/components/AppShell";

const PLANS = [
  {
    name: "Starter",
    price: "$9",
    period: "/mo",
    features: [
      "2 projects / keys",
      "Alert-only mode",
      "30-day log retention",
      "1 dashboard seat",
      "Community / email support",
    ],
  },
  {
    name: "Solo / Team",
    price: "$25",
    period: "/mo",
    features: [
      "10 projects / keys",
      "Alert + enforcement (block / downgrade)",
      "Unlimited retention",
      "3 dashboard seats",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: "$49",
    period: "/mo",
    features: [
      "Unlimited projects / keys",
      "Alert + enforcement",
      "Unlimited retention",
      "Unlimited dashboard seats",
      "Custom webhooks (PagerDuty, Slack, email digest)",
      "Priority support",
    ],
  },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "text-ok" },
  canceled: { label: "Canceled", color: "text-warn" },
  expired: { label: "Expired", color: "text-block" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BillingPageContent() {
  const [email, setEmail] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [purchases, setPurchases] = useState<SubscriptionPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.me(), api.getSubscription()])
      .then(([meRes, billingRes]) => {
        setEmail(meRes.email);
        setSubscription(billingRes.subscription);
        setPurchases(billingRes.purchases);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusMeta = subscription ? STATUS_META[subscription.status] : null;

  return (
    <>
      <div className="mb-10">
        <h2 className="font-display text-3xl mb-2" style={{ fontWeight: 500 }}>
          Billing
        </h2>
        <p className="text-muted text-base">
          Your plan and subscription status.
        </p>
      </div>

      {/* Current status */}
      <div className="border border-border rounded-md p-6 mb-10">
        {loading ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : subscription ? (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
              <CreditCard size={18} className="text-accent" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-base font-medium">
                  {subscription.planName}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-surface ${statusMeta?.color}`}
                >
                  {statusMeta?.label}
                </span>
              </div>
              <p className="text-sm text-muted">
                <span className="font-mono text-text">
                  ${subscription.amountUsd.toFixed(2)}/mo
                </span>
                {subscription.status === "active" && (
                  <> · renews {formatDate(subscription.currentPeriodEnd)}</>
                )}
                {subscription.status === "canceled" &&
                  subscription.canceledAt && (
                    <> · canceled {formatDate(subscription.canceledAt)}</>
                  )}
              </p>
              {email && (
                <p className="text-sm text-muted mt-1">
                  Signed in as <span className="text-text">{email}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
              <CreditCard size={18} className="text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-base font-medium">
                  No active subscription
                </span>
                <span className="text-[10px] uppercase tracking-widest text-warn bg-warn/10 px-2 py-0.5 rounded-full">
                  Billing not yet live
                </span>
              </div>
              <p className="text-sm text-muted leading-relaxed max-w-md">
                Silvox is currently free to use while billing is being
                finalized
                {email && (
                  <>
                    {" "}
                    — you're signed in as{" "}
                    <span className="text-text">{email}</span>
                  </>
                )}
                . All features are unrestricted for now. You'll be notified
                before any billing changes take effect.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Purchase history — row-list pattern matching Keys/Rules/Projects, not a bare table */}
      {!loading && purchases.length > 0 && (
        <div className="mb-10">
          <h3 className="text-sm uppercase tracking-widest text-muted mb-4">
            Purchase history
          </h3>
          <div className="border-t border-border">
            {purchases.map((p) => {
              const statusColor =
                p.status === "paid"
                  ? "text-ok"
                  : p.status === "refunded"
                    ? "text-warn"
                    : "text-block";
              const statusBg =
                p.status === "paid"
                  ? "bg-ok/10 border-ok/30"
                  : p.status === "refunded"
                    ? "bg-warn/10 border-warn/30"
                    : "bg-block/10 border-block/30";
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 py-4 border-b border-border"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${statusBg}`}
                    >
                      <Receipt size={16} className={statusColor} />
                    </div>
                    <div>
                      <div className="font-mono text-base">
                        ${p.amountUsd.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted mt-0.5">
                        {formatDate(p.purchasedAt)}
                        {p.note && (
                          <span className="text-muted/70"> · {p.note}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border shrink-0 ${statusColor} ${statusBg}`}
                  >
                    {p.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !subscription && (
        <div className="flex flex-col items-center text-center py-12 border-t border-border mb-10">
          <Receipt size={24} className="text-muted mb-3" />
          <p className="text-base text-muted mb-1">No purchase history yet</p>
          <p className="text-sm text-muted/70">
            Nothing's been billed — you're on the house for now.
          </p>
        </div>
      )}

      {/* Plan reference */}
      <div className="mb-6">
        <h3 className="text-sm uppercase tracking-widest text-muted mb-4">
          Plans
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="border border-border rounded-md p-5"
            >
              <h4
                className="font-display text-lg mb-1"
                style={{ fontWeight: 500 }}
              >
                {plan.name}
              </h4>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="font-mono text-2xl">{plan.price}</span>
                <span className="text-muted text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={14} className="text-accent shrink-0 mt-0.5" />
                    <span className="text-muted">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted">
        <Mail size={14} />
        Want early access to enforcement features on a paid tier?{" "}
        <a
          href="mailto:hello@silvox.dev"
          className="text-accent hover:underline"
        >
          Reach out
        </a>
      </div>
    </>
  );
}

export default function BillingPage() {
  return (
    <AppShell>
      <BillingPageContent />
    </AppShell>
  );
}
