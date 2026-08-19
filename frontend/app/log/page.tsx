"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  api,
  ApiError,
  type RequestLogRow,
  type ApiKeySummary,
} from "@/lib/api";
import { useProject } from "@/lib/ProjectContext";
import { AppShell } from "@/components/AppShell";
import { ListSkeleton } from "@/components/Skeleton";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StatusBadge({ statusCode }: { statusCode: number }) {
  const isSuccess = statusCode >= 200 && statusCode < 300;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase"
      style={{
        color: isSuccess ? "rgb(var(--color-ok))" : "rgb(var(--color-block))",
        backgroundColor: isSuccess
          ? "rgb(var(--color-ok) / 0.12)"
          : "rgb(var(--color-block) / 0.12)",
      }}
    >
      {statusCode}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors duration-300 ease-out w-full sm:w-auto"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
  align = "left",
}: {
  label: string;
  column: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: any) => void;
  align?: "left" | "right";
}) {
  const active = sortBy === column;
  return (
    <th
      className={`font-normal pb-3 pr-4 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-text transition-colors duration-300 ease-out"
        style={{ color: active ? "rgb(var(--color-text))" : undefined }}
      >
        {label}
        <ChevronDown
          size={12}
          className="transition-transform duration-300 ease-out"
          style={{
            opacity: active ? 1 : 0.25,
            transform:
              active && sortOrder === "asc" ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
    </th>
  );
}

function LogPageContent() {
  const { selectedProject: project } = useProject();
  const [rows, setRows] = useState<RequestLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [models, setModels] = useState<string[]>([]);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [modelFilter, setModelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "cost" | "tokensIn" | "tokensOut" | "model"
  >("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const hasActiveFilters = !!(
    modelFilter ||
    statusFilter ||
    keyFilter ||
    fromFilter ||
    toFilter
  );

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  }

  const load = useCallback(
    async (projectId: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.listRequests(projectId, {
          model: modelFilter || undefined,
          status: (statusFilter as "success" | "error") || undefined,
          keyId: keyFilter || undefined,
          from: fromFilter ? new Date(fromFilter).toISOString() : undefined,
          to: toFilter ? new Date(toFilter).toISOString() : undefined,
          page,
          pageSize: 50,
          sortBy,
          sortOrder,
        });
        setRows(data.rows);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Could not load request log.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      modelFilter,
      statusFilter,
      keyFilter,
      fromFilter,
      toFilter,
      page,
      sortBy,
      sortOrder,
    ],
  );

  // Reset to page 1 whenever a filter changes, so you don't land on an
  // out-of-range page after narrowing the result set.
  useEffect(() => {
    setPage(1);
  }, [modelFilter, statusFilter, keyFilter, fromFilter, toFilter]);

  useEffect(() => {
    if (!project) return;
    load(project.id);
  }, [project, load]);

  useEffect(() => {
    if (!project) return;
    api
      .listRequestModels(project.id)
      .then(setModels)
      .catch(() => {});
    api
      .listKeys(project.id)
      .then(setKeys)
      .catch(() => {});
  }, [project]);

  function clearFilters() {
    setModelFilter("");
    setStatusFilter("");
    setKeyFilter("");
    setFromFilter("");
    setToFilter("");
  }

  if (!project) {
    return <ListSkeleton rows={6} />;
  }

  const isEmptyDueToFilters =
    !loading && rows.length === 0 && total === 0 && hasActiveFilters;
  const isEmptyEntirely =
    !loading && rows.length === 0 && total === 0 && !hasActiveFilters;

  return (
    <>
      <div className="mb-8">
        <h2 className="font-display text-3xl mb-2" style={{ fontWeight: 500 }}>
          Request log
        </h2>
        <p className="text-muted text-base">
          Every request proxied through Silvox for this project.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4 mb-8 pb-8 border-b border-border">
        <FilterSelect
          label="Model"
          value={modelFilter}
          onChange={setModelFilter}
          options={models.map((m) => ({ value: m, label: m }))}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "success", label: "Success" },
            { value: "error", label: "Error" },
          ]}
        />
        <FilterSelect
          label="Key"
          value={keyFilter}
          onChange={setKeyFilter}
          options={keys.map((k) => ({
            value: k.id,
            label: `${k.display_prefix}···`,
          }))}
        />
        <div>
          <label className="block text-xs text-muted mb-1.5">From</label>
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors duration-300 ease-out"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">To</label>
          <input
            type="date"
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
            className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors duration-300 ease-out"
          />
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors duration-300 ease-out pb-2"
          >
            <X size={14} />
            Clear filters
          </button>
        )}
      </div>

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
        <ListSkeleton rows={6} />
      ) : isEmptyEntirely ? (
        <div className="flex flex-col items-center text-center py-16 border-t border-border">
          <ScrollText size={26} className="text-muted mb-4" />
          <p className="text-base text-muted mb-1">No requests logged yet.</p>
          <p className="text-sm text-muted font-mono mt-2">POST /v1/messages</p>
        </div>
      ) : isEmptyDueToFilters ? (
        <div className="flex flex-col items-center text-center py-16 border-t border-border">
          <ScrollText size={26} className="text-muted mb-4" />
          <p className="text-base text-muted mb-4">
            No requests match these filters.
          </p>
          <button
            onClick={clearFilters}
            className="text-base text-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Table — horizontal scroll on narrow viewports rather than collapsing to cards,
              since tabular data (time/tokens/cost) loses meaning stacked vertically */}
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border text-muted text-xs uppercase tracking-wide">
                  <SortableHeader
                    label="Time"
                    column="createdAt"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <th className="text-left font-normal pb-3 pr-4">Key</th>
                  <SortableHeader
                    label="Model"
                    column="model"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <th className="text-left font-normal pb-3 pr-4">
                    Tokens in/out
                  </th>
                  <SortableHeader
                    label="Cost"
                    column="cost"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    align="right"
                  />
                  <th className="text-right font-normal pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border-soft">
                    <td className="py-3 pr-4 text-muted whitespace-nowrap">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {r.displayPrefix}···
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{r.model}</td>
                    <td className="py-3 pr-4 text-muted whitespace-nowrap">
                      {r.tokensIn ?? "—"} / {r.tokensOut ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap">
                      {r.cost !== null ? `$${r.cost.toFixed(4)}` : "—"}
                    </td>
                    <td className="py-3 text-right">
                      <StatusBadge statusCode={r.statusCode} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
            <span className="text-sm text-muted">
              {total} request{total !== 1 ? "s" : ""} total
            </span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 text-sm text-muted hover:text-text transition-colors duration-300 ease-out disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft size={15} />
                Prev
              </button>
              <span className="text-sm font-mono text-muted">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 text-sm text-muted hover:text-text transition-colors duration-300 ease-out disabled:opacity-30 disabled:pointer-events-none"
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function LogPage() {
  return (
    <AppShell>
      <LogPageContent />
    </AppShell>
  );
}
