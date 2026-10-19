"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, useAgentScope, useSpaceTasks, usePatchTask, useStore } from "./store";
import { Empty, Icon, ViewIcon } from "./ui";
import { KanbanView } from "./views/KanbanView";
import { TodoView } from "./views/TodoView";
import { CalendarView } from "./views/CalendarView";
import { VIEWS, VIEW_META, type ViewType } from "@/lib/types";
import { isOverdue } from "@/lib/dates";

export function SpacePage({ spaceId }: { spaceId: number }) {
  const { spaces, spacesLoaded, refreshSpaces, openTask, setSpaceModal } = useStore();
  const router = useRouter();
  const space = spaces.find((s) => s.id === spaceId);
  const { tasks, setTasks } = useSpaceTasks(spaceId);
  const patch = usePatchTask(setTasks);
  const setScope = useAgentScope();

  useEffect(() => { setScope({ type: "space", spaceId }); }, [spaceId, setScope]);
  useEffect(() => { if (spacesLoaded && !space) router.replace("/"); }, [spacesLoaded, space, router]);

  if (!space) return <div className="page"><div className="skeleton-title" /></div>;

  async function setView(view: ViewType) {
    await api(`/api/spaces/${spaceId}`, { method: "PATCH", json: { view } });
    await refreshSpaces();
  }

  const open = tasks?.filter((t) => t.status !== "done").length ?? 0;
  const late = tasks?.filter((t) => isOverdue(t.due_date, t.status)).length ?? 0;

  return (
    <div className={`page page-${space.view}`} style={{ ["--space" as string]: space.color }}>
      <header className="page-head">
        <div className="page-title-wrap">
          <span className="space-badge" style={{ background: space.color }}>{space.name.slice(0, 1)}</span>
          <div>
            <h1 className="page-title">{space.name}</h1>
            <p className="page-sub">
              {open} פתוחות{late ? <> · <span className="txt-late">{late} באיחור</span></> : null}
            </p>
          </div>
          <button className="icon-btn" onClick={() => setSpaceModal({ mode: "edit", space })} aria-label="הגדרות מרחב" title="הגדרות מרחב">
            <Icon.settings size={18} />
          </button>
        </div>
        <div className="page-actions">
          <div className="view-switch" role="tablist" aria-label="תצוגה">
            {VIEWS.map((v) => (
              <button key={v} role="tab" aria-selected={space.view === v} className={space.view === v ? "on" : ""} onClick={() => setView(v)}>
                <ViewIcon view={v} size={16} /> <span>{VIEW_META[v].label}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" style={{ background: space.color }} onClick={() => openTask({ space_id: space.id })}>
            <Icon.plus size={18} /> משימה חדשה
          </button>
        </div>
      </header>

      {tasks === null ? (
        <div className="loading-rows"><div /><div /><div /></div>
      ) : space.view === "kanban" ? (
        <KanbanView space={space} tasks={tasks} patch={patch} />
      ) : space.view === "todo" ? (
        <TodoView space={space} tasks={tasks} patch={patch} />
      ) : (
        <CalendarView space={space} tasks={tasks} patch={patch} />
      )}
      {tasks !== null && tasks.length === 0 && space.view === "kanban" && (
        <Empty>המרחב ריק. לחץ על &quot;משימה חדשה&quot; או בקש מהסוכן להוסיף משימות.</Empty>
      )}
    </div>
  );
}
