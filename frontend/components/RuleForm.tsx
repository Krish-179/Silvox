"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import {
  api,
  type RuleInput,
  type RateCardEntry,
  type ApiKeySummary,
} from "@/lib/api";
import { Bell, ArrowDownCircle, AlertOctagon } from "lucide-react";

export const ACTION_META = {
  alert: { label: "Alert", Icon: Bell, color: "text-warn" },
  downgrade: {
    label: "Downgrade",
    Icon: ArrowDownCircle,
    color: "text-accent",
  },
  block: { label: "Block", Icon: AlertOctagon, color: "text-block" },
} as const;

export function emptyForm(): RuleInput {
  return {
    period: "monthly",
    limitUsd: 50,
    action: "alert",
    downgradeModel: "",
  };
}

const CURRENT_GEN = new Set([
  "claude-haiku-4-5",
  "claude-sonnet-5",
  "claude-opus-5",
]);

function dedupeRateCard(entries: RateCardEntry[]): RateCardEntry[] {
  const byModel = new Map(entries.map((e) => [e.model, e]));
  return entries.filter((e) => {
    const isDatedAlias = /-\d{8}$/.test(e.model);
    if (!isDatedAlias) return true;
    const baseName = e.model.replace(/-\d{8}$/, "");
    const base = byModel.get(baseName);
    const isDuplicateOfBase =
      base &&
      base.inputPer1k === e.inputPer1k &&
      base.outputPer1k === e.outputPer1k;
    return !isDuplicateOfBase;
  });
}

export function RuleForm({
  initial,
  onSubmit,
  onCancel,
  busy,
  projectId,
  isEditing = false,
}: {
  initial: RuleInput;
  onSubmit: (input: RuleInput) => void;
  onCancel: () => void;
  busy: boolean;
  projectId?: string; // needed to fetch the key list for the scope picker — only required when creating
  isEditing?: boolean; // hides the scope picker when editing, since scope is immutable after creation
}) {
  const [form, setForm] = useState<RuleInput>(initial);
  const [rateCard, setRateCard] = useState<RateCardEntry[]>([]);
  const [rateCardLoading, setRateCardLoading] = useState(true);
  const [showOlder, setShowOlder] = useState(false);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [scopeMode, setScopeMode] = useState<"project" | "key">(
    initial.keyId ? "key" : "project",
  );

  useEffect(() => {
    api
      .getRateCard()
      .then((entries) => setRateCard(dedupeRateCard(entries)))
      .catch(() => {})
      .finally(() => setRateCardLoading(false));
  }, []);

  useEffect(() => {
    if (!projectId || isEditing) return;
    api
      .listKeys(projectId)
      .then((list) => setKeys(list.filter((k) => k.active)))
      .catch(() => {});
  }, [projectId, isEditing]);

  const currentModels = rateCard
    .filter((e) => CURRENT_GEN.has(e.model))
    .sort((a, b) => a.outputPer1k - b.outputPer1k);
  const olderModels = rateCard
    .filter((e) => !CURRENT_GEN.has(e.model))
    .sort((a, b) => a.outputPer1k - b.outputPer1k);

  function ModelOption({ entry }: { entry: RateCardEntry }) {
    const selected = form.downgradeModel === entry.model;
    return (
      <button
        type="button"
        onClick={() => setForm({ ...form, downgradeModel: entry.model })}
        className="w-full flex items-center justify-between px-4 py-3 rounded-md border text-sm transition-colors duration-300 ease-out"
        style={{
          borderColor: selected
            ? "rgb(var(--color-accent))"
            : "rgb(var(--color-border))",
          backgroundColor: selected
            ? "rgb(var(--color-accent) / 0.12)"
            : "transparent",
        }}
      >
        <span className={`font-mono ${selected ? "text-text" : "text-muted"}`}>
          {entry.model}
        </span>
        <span className="text-xs text-muted font-mono">
          ${entry.inputPer1k.toFixed(4)} in / ${entry.outputPer1k.toFixed(4)}{" "}
          out per 1k
        </span>
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: RuleInput = { ...form };
    if (scopeMode === "project") {
      delete payload.keyId;
    }
    onSubmit(payload);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-accent/40 bg-accent/5 rounded-md p-6 space-y-5"
    >
      {!isEditing && (
        <div>
          <label className="block text-sm text-muted mb-2">Applies to</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(["project", "key"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScopeMode(mode)}
                className="px-3 py-2.5 rounded-md border text-sm transition-colors duration-300 ease-out"
                style={{
                  borderColor:
                    scopeMode === mode
                      ? "rgb(var(--color-accent))"
                      : "rgb(var(--color-border))",
                  backgroundColor:
                    scopeMode === mode
                      ? "rgb(var(--color-accent) / 0.12)"
                      : "transparent",
                  color:
                    scopeMode === mode
                      ? "rgb(var(--color-text))"
                      : "rgb(var(--color-muted))",
                }}
              >
                {mode === "project" ? "Entire project" : "Specific key"}
              </button>
            ))}
          </div>
          {scopeMode === "key" && (
            <select
              value={form.keyId ?? ""}
              onChange={(e) => setForm({ ...form, keyId: e.target.value })}
              required
              className="w-full bg-bg border border-border rounded-md px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors duration-300 ease-out"
            >
              <option value="" disabled>
                Select a key
              </option>
              {keys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.display_prefix}···
                </option>
              ))}
            </select>
          )}
          {scopeMode === "key" && keys.length === 0 && (
            <p className="text-xs text-muted mt-2">
              No active keys on this project yet.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm text-muted mb-2">Period</label>
          <select
            value={form.period}
            onChange={(e) =>
              setForm({
                ...form,
                period: e.target.value as "daily" | "monthly",
              })
            }
            className="w-full bg-bg border border-border rounded-md px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors duration-300 ease-out"
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-muted mb-2">Limit (USD)</label>
          <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2.5 focus-within:border-accent transition-colors duration-300 ease-out">
            <span className="text-muted text-sm">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.limitUsd}
              onChange={(e) =>
                setForm({ ...form, limitUsd: parseFloat(e.target.value) || 0 })
              }
              className="w-full bg-transparent outline-none text-sm text-text"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm text-muted mb-2">
          Action when limit is reached
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(Object.keys(ACTION_META) as Array<keyof typeof ACTION_META>).map(
            (key) => {
              const meta = ACTION_META[key];
              const selected = form.action === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, action: key })}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm transition-colors duration-300 ease-out"
                  style={{
                    borderColor: selected
                      ? "rgb(var(--color-accent))"
                      : "rgb(var(--color-border))",
                    backgroundColor: selected
                      ? "rgb(var(--color-accent) / 0.12)"
                      : "transparent",
                    color: selected
                      ? "rgb(var(--color-text))"
                      : "rgb(var(--color-muted))",
                  }}
                >
                  <meta.Icon size={15} className={selected ? meta.color : ""} />
                  {meta.label}
                </button>
              );
            },
          )}
        </div>
        <p className="text-xs text-muted mt-2">
          {form.action === "alert" &&
            "Logs the breach — the request still goes through unchanged."}
          {form.action === "downgrade" &&
            "Swaps the request to a cheaper model instead of blocking it."}
          {form.action === "block" &&
            "Rejects the request with a 429 once the limit is hit."}
        </p>
      </div>

      {form.action === "downgrade" && (
        <div>
          <label className="block text-sm text-muted mb-2">
            Downgrade to model
          </label>
          <p className="text-xs text-muted mb-3">
            Sorted cheapest to most expensive.
          </p>
          {rateCardLoading ? (
            <p className="text-sm text-muted">Loading available models...</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {currentModels.map((entry) => (
                  <ModelOption key={entry.model} entry={entry} />
                ))}
              </div>
              {olderModels.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOlder((s) => !s)}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors duration-300 ease-out py-1"
                  >
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-300 ease-out ${showOlder ? "rotate-180" : ""}`}
                    />
                    {showOlder
                      ? "Hide older models"
                      : `Show older models (${olderModels.length})`}
                  </button>
                  {showOlder && (
                    <div className="space-y-2 mt-2">
                      {olderModels.map((entry) => (
                        <ModelOption key={entry.model} entry={entry} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy || (scopeMode === "key" && !form.keyId)}
          className="bg-accent text-bg text-sm font-medium px-5 py-2.5 rounded-md transition-all duration-300 ease-out hover:shadow-lg hover:shadow-accent/25 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save rule"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted hover:text-text transition-colors duration-300 ease-out"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function RuleRow({
  rule,
  isEditing,
  confirmingDelete,
  busy,
  onEdit,
  onCancelEdit,
  onUpdate,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  rule: import("@/lib/api").BudgetRule;
  isEditing: boolean;
  confirmingDelete: boolean;
  busy: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (input: RuleInput) => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const meta = ACTION_META[rule.action];

  if (isEditing) {
    return (
      <div className="py-5 border-b border-border">
        <RuleForm
          initial={{
            period: rule.period,
            limitUsd: parseFloat(rule.limit_usd),
            action: rule.action,
            downgradeModel: rule.downgrade_model ?? "",
          }}
          busy={busy}
          onSubmit={onUpdate}
          onCancel={onCancelEdit}
          isEditing
        />
      </div>
    );
  }

  return (
    <div className="py-5 border-b border-border">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div
            className={`w-9 h-9 rounded-md border border-border flex items-center justify-center ${meta.color}`}
          >
            <meta.Icon size={16} />
          </div>
          <div>
            <div className="text-base">
              <span className={`font-medium ${meta.color}`}>{meta.label}</span>
              <span className="text-muted"> at </span>
              <span className="font-mono">
                ${parseFloat(rule.limit_usd).toFixed(2)}
              </span>
              <span className="text-muted"> / {rule.period}</span>
              {rule.scope_type === "api_key" && rule.key_display_prefix && (
                <span className="text-muted">
                  {" "}
                  ·{" "}
                  <span className="font-mono">
                    {rule.key_display_prefix}···
                  </span>
                </span>
              )}
            </div>
            {rule.action === "downgrade" && rule.downgrade_model && (
              <div className="text-sm text-muted mt-0.5 font-mono">
                → {rule.downgrade_model}
              </div>
            )}
          </div>
        </div>

        {confirmingDelete ? (
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <span className="text-sm text-muted">Delete this rule?</span>
            <button
              onClick={onConfirmDelete}
              disabled={busy}
              className="text-sm text-block font-medium hover:underline disabled:opacity-50"
            >
              {busy ? "Deleting..." : "Confirm"}
            </button>
            <button
              onClick={onCancelDelete}
              className="text-sm text-muted hover:text-text transition-colors duration-300 ease-out"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-5 shrink-0">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors duration-300 ease-out"
            >
              Edit
            </button>
            <button
              onClick={onRequestDelete}
              className="flex items-center gap-2 text-sm text-muted hover:text-block transition-colors duration-300 ease-out"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="sm:hidden mt-4">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted flex-1">Delete this rule?</span>
            <button
              onClick={onConfirmDelete}
              disabled={busy}
              className="text-sm text-block font-medium px-3 py-2 rounded-md border border-block/40 disabled:opacity-50"
            >
              {busy ? "Deleting..." : "Confirm"}
            </button>
            <button
              onClick={onCancelDelete}
              className="text-sm text-muted px-3 py-2 rounded-md border border-border"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 text-sm text-text py-2.5 rounded-md border border-border"
            >
              Edit
            </button>
            <button
              onClick={onRequestDelete}
              className="flex-1 flex items-center justify-center gap-2 text-sm text-block py-2.5 rounded-md border border-block/40"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
