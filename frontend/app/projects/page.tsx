"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderKanban,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { AppShell } from "@/components/AppShell";

function ProjectsPageContent() {
  const { projects, selectedProject, setSelectedProjectId, refresh } =
    useProject();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProject(newName.trim());
      setNewName("");
      setCreating(false);
      await refresh();
      setSelectedProjectId(created.id);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not create project.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(projectId: string) {
    if (!editName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.renameProject(projectId, editName.trim());
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not rename project.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(projectId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.deleteProject(projectId);
      setConfirmingDelete(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not delete project.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveWebhook(projectId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.updateSlackWebhook(projectId, webhookInput.trim() || null);
      setEditingWebhookId(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save webhook URL.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveWebhook(projectId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.updateSlackWebhook(projectId, null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not remove webhook.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canDelete = projects.length > 1;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
        <div>
          <h2
            className="font-display text-3xl mb-2"
            style={{ fontWeight: 500 }}
          >
            Projects
          </h2>
          <p className="text-muted text-base">
            Manage the projects in your account.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-2 bg-accent text-bg text-sm font-medium px-5 py-3 rounded-md transition-all duration-300 ease-out hover:shadow-lg hover:shadow-accent/25 shrink-0"
          >
            <Plus size={16} />
            New project
          </button>
        )}
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border border-accent/40 bg-accent/5 rounded-md p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Project name"
                className="flex-1 bg-bg border border-border rounded-md px-3 py-2.5 text-sm text-text outline-none focus:border-accent transition-colors duration-300 ease-out"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreate}
                  disabled={busy || !newName.trim()}
                  className="flex-1 sm:flex-none bg-accent text-bg text-sm font-medium px-4 py-2.5 rounded-md transition-all duration-300 ease-out disabled:opacity-50"
                >
                  {busy ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                  className="text-sm text-muted hover:text-text transition-colors duration-300 ease-out"
                >
                  Cancel
                </button>
              </div>
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

      <div className="border-t border-border">
        {projects.map((p) => {
          const isEditing = editingId === p.id;
          const isSelected = selectedProject?.id === p.id;
          const isEditingWebhook = editingWebhookId === p.id;
          const hasWebhook = !!p.slack_webhook_url;

          return (
            <div key={p.id} className="py-5 border-b border-border">
              {isEditing ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(p.id)}
                    className="flex-1 bg-bg border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors duration-300 ease-out"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRename(p.id)}
                      disabled={busy || !editName.trim()}
                      className="flex items-center gap-1.5 text-sm text-accent hover:underline disabled:opacity-50"
                    >
                      <Check size={14} />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors duration-300 ease-out"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? "border-accent bg-accent/10" : "border-border"}`}
                      >
                        <FolderKanban
                          size={16}
                          className={isSelected ? "text-accent" : "text-muted"}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{p.name}</span>
                          {isSelected && (
                            <span className="text-[10px] uppercase tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted mt-0.5">
                          Created{" "}
                          {new Date(p.created_at).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </div>
                      </div>
                    </div>

                    {confirmingDelete === p.id ? (
                      <>
                        <div className="hidden sm:flex items-center gap-3 shrink-0">
                          <span className="text-sm text-muted">
                            Delete this project?
                          </span>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={busy}
                            className="text-sm text-block font-medium hover:underline disabled:opacity-50"
                          >
                            {busy ? "Deleting..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(null)}
                            className="text-sm text-muted hover:text-text transition-colors duration-300 ease-out"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="sm:hidden flex items-center gap-2 w-full">
                          <span className="text-sm text-muted flex-1">
                            Delete this project?
                          </span>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={busy}
                            className="text-sm text-block font-medium px-3 py-2 rounded-md border border-block/40 disabled:opacity-50"
                          >
                            {busy ? "Deleting..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(null)}
                            className="text-sm text-muted px-3 py-2 rounded-md border border-border"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="hidden sm:flex items-center gap-5 shrink-0">
                          {!isSelected && (
                            <button
                              onClick={() => setSelectedProjectId(p.id)}
                              className="text-sm text-muted hover:text-accent transition-colors duration-300 ease-out"
                            >
                              Switch to
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingId(p.id);
                              setEditName(p.name);
                            }}
                            className="flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors duration-300 ease-out"
                          >
                            <Pencil size={14} />
                            Rename
                          </button>
                          <button
                            onClick={() =>
                              canDelete && setConfirmingDelete(p.id)
                            }
                            disabled={!canDelete}
                            title={
                              !canDelete
                                ? "You need at least one project"
                                : undefined
                            }
                            className="flex items-center gap-2 text-sm text-muted hover:text-block transition-colors duration-300 ease-out disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>

                        <div className="sm:hidden flex items-center gap-2 w-full">
                          {!isSelected && (
                            <button
                              onClick={() => setSelectedProjectId(p.id)}
                              className="flex-1 flex items-center justify-center gap-2 text-sm text-accent py-2.5 rounded-md border border-accent/40"
                            >
                              Switch to
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingId(p.id);
                              setEditName(p.name);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 text-sm text-text py-2.5 rounded-md border border-border"
                          >
                            <Pencil size={15} className="text-muted" />
                            Rename
                          </button>
                          <button
                            onClick={() =>
                              canDelete && setConfirmingDelete(p.id)
                            }
                            disabled={!canDelete}
                            className="flex-1 flex items-center justify-center gap-2 text-sm text-block py-2.5 rounded-md border border-block/40 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Slack webhook — full width on mobile, indented to align on desktop */}
                  <div className="mt-4 sm:pl-12">
                    {isEditingWebhook ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <input
                          autoFocus
                          type="url"
                          value={webhookInput}
                          onChange={(e) => setWebhookInput(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleSaveWebhook(p.id)
                          }
                          placeholder="https://hooks.slack.com/services/..."
                          className="flex-1 bg-bg border border-border rounded-md px-3 py-2.5 sm:py-2 text-sm text-text font-mono outline-none focus:border-accent transition-colors duration-300 ease-out"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleSaveWebhook(p.id)}
                            disabled={busy}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-sm text-accent border border-accent/40 sm:border-0 rounded-md sm:rounded-none py-2.5 sm:py-0 hover:underline disabled:opacity-50"
                          >
                            <Check size={14} />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingWebhookId(null)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-sm text-muted border border-border sm:border-0 rounded-md sm:rounded-none py-2.5 sm:py-0 transition-colors duration-300 ease-out"
                          >
                            <X size={14} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Desktop — everything inline on one row */}
                        <div className="hidden sm:flex items-center gap-3">
                          <MessageSquare
                            size={14}
                            className={
                              hasWebhook
                                ? "text-ok shrink-0"
                                : "text-muted shrink-0"
                            }
                          />
                          <span className="text-sm text-muted">
                            {hasWebhook
                              ? "Slack alerts connected"
                              : "No Slack alerts configured"}
                          </span>
                          {hasWebhook ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditingWebhookId(p.id);
                                  setWebhookInput(p.slack_webhook_url ?? "");
                                }}
                                className="text-sm text-accent hover:underline"
                              >
                                Change
                              </button>
                              <button
                                onClick={() => handleRemoveWebhook(p.id)}
                                disabled={busy}
                                className="text-sm text-muted hover:text-block transition-colors duration-300 ease-out disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingWebhookId(p.id);
                                setWebhookInput("");
                              }}
                              className="text-sm text-accent hover:underline"
                            >
                              Connect Slack
                            </button>
                          )}
                        </div>

                        {/* Mobile — status on its own line, actions as full-width pills below */}
                        <div className="sm:hidden">
                          <div className="flex items-center gap-3">
                            <MessageSquare
                              size={14}
                              className={
                                hasWebhook
                                  ? "text-ok shrink-0"
                                  : "text-muted shrink-0"
                              }
                            />
                            <span className="text-sm text-muted">
                              {hasWebhook
                                ? "Slack alerts connected"
                                : "No Slack alerts configured"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            {hasWebhook ? (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingWebhookId(p.id);
                                    setWebhookInput(p.slack_webhook_url ?? "");
                                  }}
                                  className="flex-1 flex items-center justify-center gap-2 text-sm text-accent py-2.5 rounded-md border border-accent/40"
                                >
                                  Change
                                </button>
                                <button
                                  onClick={() => handleRemoveWebhook(p.id)}
                                  disabled={busy}
                                  className="flex-1 flex items-center justify-center gap-2 text-sm text-block py-2.5 rounded-md border border-block/40 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingWebhookId(p.id);
                                  setWebhookInput("");
                                }}
                                className="w-full flex items-center justify-center gap-2 text-sm text-accent py-2.5 rounded-md border border-accent/40"
                              >
                                Connect Slack
                              </button>
                            )}
                          </div>
                        </div>

                        {!hasWebhook && (
                          <a
                            href="https://api.slack.com/messaging/webhooks"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted hover:text-text transition-colors duration-300 ease-out mt-2 sm:mt-1.5"
                          >
                            How to get a webhook URL
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function ProjectsPage() {
  return (
    <AppShell>
      <ProjectsPageContent />
    </AppShell>
  );
}
