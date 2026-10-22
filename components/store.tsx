"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AgentScope, Space, Task } from "@/lib/types";
import { isDesignId, LS_VERSION, LS_VOTES, type DesignId } from "./ab/versions";

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "שגיאה");
  return data as T;
}

export type TaskDraft = Partial<Task> & { space_id?: number };

interface Store {
  spaces: Space[];
  spacesLoaded: boolean;
  refreshSpaces: () => Promise<void>;
  version: number; // bump to make every view re-fetch tasks
  bump: () => void;
  editing: TaskDraft | null;
  openTask: (t: TaskDraft) => void;
  closeTask: () => void;
  spaceModal: { mode: "create" } | { mode: "edit"; space: Space } | null;
  setSpaceModal: (v: Store["spaceModal"]) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
  scope: AgentScope;
  setScope: (s: AgentScope) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  design: DesignId; // dashboard A/B version, saved in this browser
  setDesign: (d: DesignId) => void;
  votes: Partial<Record<DesignId, boolean>>;
  toggleVote: (d: DesignId) => void;
}

const Ctx = createContext<Store | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<TaskDraft | null>(null);
  const [spaceModal, setSpaceModal] = useState<Store["spaceModal"]>(null);
  const [toastMsg, setToast] = useState<string | null>(null);
  const [scope, setScope] = useState<AgentScope>({ type: "all" });
  const [chatOpen, setChatOpen] = useState(false);
  const [design, setDesignState] = useState<DesignId>("orig");
  const [votes, setVotes] = useState<Store["votes"]>({});

  // Read the saved A/B choice after mount so server and client render the same first frame.
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_VERSION);
      if (isDesignId(v)) setDesignState(v);
      setVotes(JSON.parse(localStorage.getItem(LS_VOTES) || "{}"));
    } catch { /* ignore */ }
  }, []);

  const setDesign = useCallback((d: DesignId) => {
    setDesignState(d);
    try { localStorage.setItem(LS_VERSION, d); } catch { /* ignore */ }
    window.scrollTo(0, 0);
  }, []);

  const toggleVote = useCallback((d: DesignId) => {
    setVotes((cur) => {
      const next = { ...cur, [d]: !cur[d] };
      try { localStorage.setItem(LS_VOTES, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const refreshSpaces = useCallback(async () => {
    const s = await api<Space[]>("/api/spaces");
    setSpaces(s);
    setLoaded(true);
  }, []);

  useEffect(() => { refreshSpaces().catch(() => setLoaded(true)); }, [refreshSpaces]);

  const toast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? null : m)), 2600);
  }, []);

  const value: Store = {
    spaces, spacesLoaded, refreshSpaces,
    version, bump: () => setVersion((v) => v + 1),
    editing, openTask: setEditing, closeTask: () => setEditing(null),
    spaceModal, setSpaceModal,
    toast, toastMsg,
    scope, setScope,
    chatOpen, setChatOpen,
    design, setDesign, votes, toggleVote,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

/** Pages call this to point the agent at what the user is looking at. */
export function useAgentScope() {
  return useStore().setScope;
}

/** Tasks of one space, re-fetched whenever the global version bumps. */
export function useSpaceTasks(spaceId: number) {
  const { version } = useStore();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const reload = useCallback(async () => {
    setTasks(await api<Task[]>(`/api/tasks?spaceId=${spaceId}`));
  }, [spaceId]);
  useEffect(() => { reload().catch(() => setTasks([])); }, [reload, version]);
  return { tasks, setTasks, reload };
}

/** Optimistic task patch shared by all views. */
export function usePatchTask(setTasks: (fn: (t: Task[] | null) => Task[] | null) => void) {
  const { bump, toast } = useStore();
  return useCallback(async (id: number, patch: Partial<Task>) => {
    setTasks((ts) => ts && ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      await api(`/api/tasks/${id}`, { method: "PATCH", json: patch });
    } catch (e) {
      toast(e instanceof Error ? e.message : "שגיאה בעדכון");
    }
    bump();
  }, [setTasks, bump, toast]);
}
