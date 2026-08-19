"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, Plus } from "lucide-react";
import { api, ApiError, type BudgetRule, type RuleInput } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { AppShell } from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeleton";
import {
  RuleForm,
  RuleRow,
  ACTION_META,
  emptyForm,
} from "@/components/RuleForm";

function RulesPageContent() {
  const { selectedProject: project } = useProject();
  const [rules, setRules] = useState<BudgetRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRules = useCallback(async (projectId: string) => {
    const list = await api.listRules(projectId);
    setRules(list);
  }, []);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    loadRules(project.id)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Could not load rules.",
        ),
      )
      .finally(() => setLoading(false));
  }, [project, loadRules]);

  async function handleCreate(input: RuleInput) {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      await api.createRule(project.id, input);
      setCreating(false);
      await loadRules(project.id);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create rule.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(ruleId: string, input: RuleInput) {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateRule(ruleId, input);
      setEditingId(null);
      await loadRules(project.id);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update rule.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(ruleId: string) {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteRule(ruleId);
      setConfirmingDelete(null);
      await loadRules(project.id);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not delete rule.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!project) {
    return <ListSkeleton />;
  }

  const activeRules = rules.filter((r) => r.active);
  const inactiveRules = rules.filter((r) => !r.active);
  const activeProjectRules = activeRules.filter(
    (r) => r.scope_type === "project",
  );
  const activeKeyRules = activeRules.filter((r) => r.scope_type === "api_key");

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
        <div>
          <h2
            className="font-display text-3xl mb-2"
            style={{ fontWeight: 500 }}
          >
            Budget rules
          </h2>
          <p className="text-muted text-base">
            Set spending limits and choose what happens when they're hit.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-2 bg-accent text-bg text-sm font-medium px-5 py-3 rounded-md transition-all duration-300 ease-out hover:shadow-lg hover:shadow-accent/25 shrink-0"
          >
            <Plus size={16} />
            New rule
          </button>
        )}
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 32 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <RuleForm
              initial={emptyForm()}
              busy={busy}
              onSubmit={handleCreate}
              onCancel={() => setCreating(false)}
              projectId={project.id}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-block bg-block/10 border border-block/30 rounded-md px-4 py-3 overflow-hidden"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <ListSkeleton />
      ) : rules.length === 0 && !creating ? (
        <div className="flex flex-col items-center text-center py-16 border-t border-border">
          <SlidersHorizontal size={26} className="text-muted mb-4" />
          <p className="text-base text-muted mb-4">
            No rules yet — spend is tracked but nothing's enforced.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="text-base text-accent hover:underline"
          >
            Create your first rule
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {activeRules.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                <h3 className="text-sm uppercase tracking-widest text-muted">
                  Active
                </h3>
                <span className="text-sm text-muted font-mono">
                  ({activeRules.length})
                </span>
              </div>

              {activeProjectRules.length > 0 && (
                <div className="mb-6">
                  <div className="text-xs text-muted uppercase tracking-widest mb-2">
                    Project-wide
                  </div>
                  <div className="border-t border-border">
                    {activeProjectRules.map((rule) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        isEditing={editingId === rule.id}
                        confirmingDelete={confirmingDelete === rule.id}
                        busy={busy}
                        onEdit={() => setEditingId(rule.id)}
                        onCancelEdit={() => setEditingId(null)}
                        onUpdate={(input) => handleUpdate(rule.id, input)}
                        onRequestDelete={() => setConfirmingDelete(rule.id)}
                        onCancelDelete={() => setConfirmingDelete(null)}
                        onConfirmDelete={() => handleDelete(rule.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeKeyRules.length > 0 && (
                <div>
                  <div className="text-xs text-muted uppercase tracking-widest mb-2">
                    Per-key
                  </div>
                  <div className="border-t border-border">
                    {activeKeyRules.map((rule) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        isEditing={editingId === rule.id}
                        confirmingDelete={confirmingDelete === rule.id}
                        busy={busy}
                        onEdit={() => setEditingId(rule.id)}
                        onCancelEdit={() => setEditingId(null)}
                        onUpdate={(input) => handleUpdate(rule.id, input)}
                        onRequestDelete={() => setConfirmingDelete(rule.id)}
                        onCancelDelete={() => setConfirmingDelete(null)}
                        onConfirmDelete={() => handleDelete(rule.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeRules.length === 0 && inactiveRules.length > 0 && (
            <div className="flex flex-col items-center text-center py-10 border-t border-border">
              <SlidersHorizontal size={22} className="text-muted mb-3" />
              <p className="text-sm text-muted mb-3">
                No active rules — spend is tracked but nothing's enforced right
                now.
              </p>
              <button
                onClick={() => setCreating(true)}
                className="text-sm text-accent hover:underline"
              >
                Create a new rule
              </button>
            </div>
          )}

          {inactiveRules.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-block" />
                <h3 className="text-sm uppercase tracking-widest text-muted">
                  Deleted
                </h3>
                <span className="text-sm text-muted font-mono">
                  ({inactiveRules.length})
                </span>
              </div>
              <div className="border-t border-border">
                {inactiveRules.map((rule) => {
                  const meta = ACTION_META[rule.action];
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between py-5 border-b border-border opacity-50"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-9 h-9 rounded-md border border-border flex items-center justify-center ${meta.color}`}
                        >
                          <meta.Icon size={16} />
                        </div>
                        <div className="text-base">
                          <span className={`font-medium ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-muted"> at </span>
                          <span className="font-mono">
                            ${parseFloat(rule.limit_usd).toFixed(2)}
                          </span>
                          <span className="text-muted"> / {rule.period}</span>
                          {rule.scope_type === "api_key" &&
                            rule.key_display_prefix && (
                              <span className="text-muted">
                                {" "}
                                ·{" "}
                                <span className="font-mono">
                                  {rule.key_display_prefix}···
                                </span>
                              </span>
                            )}
                        </div>
                      </div>
                      <span className="text-sm text-muted">
                        Deleted{" "}
                        {new Date(rule.updated_at).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function RulesPage() {
  return (
    <AppShell>
      <RulesPageContent />
    </AppShell>
  );
}
