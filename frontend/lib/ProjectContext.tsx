"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Project } from "./api";

interface ProjectContextValue {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProjectId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);
const STORAGE_KEY = "silvox:selectedProjectId";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.me();
    } catch {
      router.push("/login");
      return;
    }
    try {
      let list = await api.listProjects();
      if (list.length === 0) {
        const created = await api.createProject("default");
        list = [created];
      }
      setProjects(list);

      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      const stillExists = stored && list.some((p) => p.id === stored);
      setSelectedId(stillExists ? stored : list[0].id);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load projects.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function setSelectedProjectId(id: string) {
    setSelectedId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        setSelectedProjectId,
        loading,
        error,
        refresh: load,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
