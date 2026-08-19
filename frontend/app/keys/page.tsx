"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Copy,
  Check,
  RotateCw,
  Ban,
  Plus,
  AlertTriangle,
} from "lucide-react";
import {
  api,
  ApiError,
  type ApiKeySummary,
  type GeneratedKey,
} from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { AppShell } from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeleton";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium transition-all duration-300 ease-out hover:shadow-lg hover:shadow-accent/25 shrink-0"
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Inner component — rendered as a CHILD of <AppShell>, so it's inside
// AppShell's <ProjectProvider> tree and useProject() resolves correctly.
function KeysPageContent() {
  const { selectedProject: project } = useProject();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<GeneratedKey | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadKeys = useCallback(async (projectId: string) => {
    const list = await api.listKeys(projectId);
    setKeys(list);
  }, []);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    api
      .listKeys(project.id)
      .then(setKeys)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Could not load keys.",
        ),
      )
      .finally(() => setLoading(false));
  }, [project]);

  async function handleGenerate() {
    if (!project) return;
    setBusy("generate");
    setError(null);
    try {
      const generated = await api.createKey(project.id);
      setRevealedKey(generated);
      await loadKeys(project.id);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not generate key.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleRotate(keyId: string) {
    if (!project) return;
    setBusy(keyId);
    setError(null);
    try {
      const generated = await api.rotateKey(keyId);
      setRevealedKey(generated);
      await loadKeys(project.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rotate key.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!project) return;
    setBusy(keyId);
    setError(null);
    try {
      await api.revokeKey(keyId);
      setConfirmingRevoke(null);
      await loadKeys(project.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke key.");
    } finally {
      setBusy(null);
    }
  }

  if (!project) {
    return <ListSkeleton />;
  }

  const activeKeys = keys.filter((k) => k.active);
  const revokedKeys = keys.filter((k) => !k.active);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
        <div>
          <h2
            className="font-display text-3xl mb-2"
            style={{ fontWeight: 500 }}
          >
            API keys
          </h2>
          <p className="text-muted text-base">
            Use these to authenticate requests through the Silvox proxy.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={busy === "generate" || loading}
          className="flex items-center justify-center gap-2 bg-accent text-bg text-sm font-medium px-5 py-3 rounded-md transition-all duration-300 ease-out hover:shadow-lg hover:shadow-accent/25 disabled:opacity-50 shrink-0"
        >
          <Plus size={16} />
          {busy === "generate" ? "Generating..." : "New key"}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-10 pb-8 border-b border-border">
        <span className="text-sm text-muted shrink-0">
          Pass your key as a Bearer token:
        </span>
        <code className="font-mono text-sm text-accent bg-surface px-3 py-1.5 rounded-md">
          Authorization: Bearer sv_live_...
        </code>
      </div>

      <AnimatePresence>
        {revealedKey && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 32 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border border-warn/40 rounded-md p-6 bg-warn/5">
              <div className="flex items-start gap-3 mb-5">
                <AlertTriangle
                  size={18}
                  className="text-warn shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-[15px] font-medium mb-1">Copy this now</p>
                  <p className="text-sm text-muted">
                    This is the only time your full key is shown. Store it
                    somewhere safe — you won't be able to view it again.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg border border-border rounded-md px-5 py-4 w-full">
                <code className="font-mono text-base text-accent break-all whitespace-normal min-w-0 flex-1">
                  {revealedKey.key}
                </code>
                <CopyButton value={revealedKey.key} />
              </div>
              <button
                onClick={() => setRevealedKey(null)}
                className="text-sm text-muted hover:text-text transition-colors duration-300 ease-out mt-5"
              >
                I've saved it — dismiss
              </button>
            </div>
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
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 border-t border-border">
          <KeyRound size={26} className="text-muted mb-4" />
          <p className="text-base text-muted mb-4">
            No keys yet for this project.
          </p>
          <button
            onClick={handleGenerate}
            className="text-base text-accent hover:underline"
          >
            Generate your first key
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {activeKeys.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                <h3 className="text-sm uppercase tracking-widest text-muted">
                  Active
                </h3>
                <span className="text-sm text-muted font-mono">
                  ({activeKeys.length})
                </span>
              </div>
              <div className="border-t border-border">
                {activeKeys.map((k) => (
                  <div key={k.id} className="py-5 border-b border-border">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-base">
                          {k.display_prefix}···
                        </div>
                        <div className="text-sm text-muted mt-1">
                          Created {formatDate(k.created_at)}
                        </div>
                      </div>

                      {confirmingRevoke === k.id ? (
                        <div className="hidden sm:flex items-center gap-3 shrink-0">
                          <span className="text-sm text-muted">
                            Revoke this key?
                          </span>
                          <button
                            onClick={() => handleRevoke(k.id)}
                            disabled={busy === k.id}
                            className="text-sm text-block font-medium hover:underline disabled:opacity-50"
                          >
                            {busy === k.id ? "Revoking..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmingRevoke(null)}
                            className="text-sm text-muted hover:text-text transition-colors duration-300 ease-out"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="hidden sm:flex items-center gap-6 shrink-0">
                          <button
                            onClick={() => handleRotate(k.id)}
                            disabled={busy === k.id}
                            className="flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors duration-300 ease-out disabled:opacity-50"
                          >
                            <RotateCw size={15} />
                            {busy === k.id ? "Rotating..." : "Rotate"}
                          </button>
                          <button
                            onClick={() => setConfirmingRevoke(k.id)}
                            className="flex items-center gap-2 text-sm text-muted hover:text-block transition-colors duration-300 ease-out"
                          >
                            <Ban size={15} />
                            Revoke
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="sm:hidden mt-4">
                      {confirmingRevoke === k.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted flex-1">
                            Revoke this key?
                          </span>
                          <button
                            onClick={() => handleRevoke(k.id)}
                            disabled={busy === k.id}
                            className="text-sm text-block font-medium px-3 py-2 rounded-md border border-block/40 disabled:opacity-50"
                          >
                            {busy === k.id ? "Revoking..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmingRevoke(null)}
                            className="text-sm text-muted px-3 py-2 rounded-md border border-border"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRotate(k.id)}
                            disabled={busy === k.id}
                            className="flex-1 flex items-center justify-center gap-2 text-sm text-text py-2.5 rounded-md border border-border disabled:opacity-50"
                          >
                            <RotateCw size={15} className="text-muted" />
                            {busy === k.id ? "Rotating..." : "Rotate"}
                          </button>
                          <button
                            onClick={() => setConfirmingRevoke(k.id)}
                            className="flex-1 flex items-center justify-center gap-2 text-sm text-block py-2.5 rounded-md border border-block/40"
                          >
                            <Ban size={15} />
                            Revoke
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {revokedKeys.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-block" />
                <h3 className="text-sm uppercase tracking-widest text-muted">
                  Revoked
                </h3>
                <span className="text-sm text-muted font-mono">
                  ({revokedKeys.length})
                </span>
              </div>
              <div className="border-t border-border">
                {revokedKeys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between py-5 border-b border-border opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-base">
                        {k.display_prefix}···
                      </div>
                      <div className="text-sm text-muted mt-1">
                        Revoked {k.revoked_at ? formatDate(k.revoked_at) : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function KeysPage() {
  return (
    <AppShell>
      <KeysPageContent />
    </AppShell>
  );
}
