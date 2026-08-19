"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Settings2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ProjectProvider, useProject } from "@/lib/ProjectContext";
import { PageSkeleton } from "@/components/Skeleton";

function ProjectSwitcher() {
  const router = useRouter();
  const { projects, selectedProject, setSelectedProjectId } = useProject();
  const [open, setOpen] = useState(false);

  if (!selectedProject) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 group"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-ok" />
        <span className="text-xs uppercase tracking-widest text-muted group-hover:text-text transition-colors duration-300 ease-out">
          {selectedProject.name}
        </span>
        <ChevronDown
          size={12}
          className="text-muted group-hover:text-text transition-colors duration-300 ease-out"
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-6 z-50 bg-surface border border-border rounded-md py-1.5 min-w-[200px] shadow-xl"
            >
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left hover:bg-bg transition-colors duration-200"
                >
                  <span
                    className={
                      p.id === selectedProject.id ? "text-text" : "text-muted"
                    }
                  >
                    {p.name}
                  </span>
                  {p.id === selectedProject.id && (
                    <Check size={14} className="text-accent" />
                  )}
                </button>
              ))}
              <div className="border-t border-border-soft mt-1.5 pt-1.5">
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push("/projects");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-muted hover:text-accent transition-colors duration-200"
                >
                  <Settings2 size={14} />
                  Manage projects
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { loading, error } = useProject();

  return (
    <div className="h-screen flex bg-bg text-text overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 px-6 sm:px-10 lg:px-16 py-6 sm:py-8 pb-24 md:pb-8"
        >
          {loading ? (
            <PageSkeleton />
          ) : error ? (
            <div className="text-sm text-block bg-block/10 border border-block/30 rounded-md px-4 py-3">
              {error}
            </div>
          ) : (
            <>
              <div className="mb-6">
                <ProjectSwitcher />
              </div>
              {children}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <AppShellInner>{children}</AppShellInner>
    </ProjectProvider>
  );
}
