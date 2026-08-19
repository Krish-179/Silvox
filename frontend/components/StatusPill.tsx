"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function StatusPill({
  loading,
  error,
  success,
  loadingLabel = "Working...",
}: {
  loading: boolean;
  error: string | null;
  success: string | null;
  loadingLabel?: string;
}) {
  const hasContent = loading || error || success;
  return (
    <AnimatePresence mode="wait">
      {hasContent && (
        <motion.div
          key={loading ? "loading" : error ? "error" : "success"}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden flex justify-center"
        >
          <div className="pt-1 pb-1">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted bg-surface border border-border rounded-full px-4 py-2">
                <Loader2 size={14} className="animate-spin" />
                {loadingLabel}
              </div>
            )}
            {!loading && error && (
              <div className="flex items-center gap-2 text-sm text-block bg-block/10 border border-block/30 rounded-full px-4 py-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
            {!loading && !error && success && (
              <div className="flex items-center gap-2 text-sm text-ok bg-ok/10 border border-ok/30 rounded-full px-4 py-2">
                <CheckCircle2 size={14} />
                {success}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
