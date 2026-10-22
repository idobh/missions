"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, useAgentScope, useStore } from "./store";
import { DueLabel, Icon, PriorityBadge, ViewIcon } from "./ui";
import type { SpaceStats, Task } from "@/lib/types";
import { HEB_DAYS, HEB_MONTHS, todayISO, dayOfWeek } from "@/lib/dates";
import { DesignDashboard } from "./ab/designs";

interface DashData {
  today: string;
  urgent: Task[];
  dueToday: Task[];
  overdue: Task[];
  stats: SpaceStats[];
}

export function Dashboard() {
  const { spaces, spacesLoaded, version, openTask, setSpaceModal, design, setChatOpen } = useStore();
  const setScope = useAgentScope();
  const [selected, setSelected] = useState<number[] | null>(null); // null = not loaded yet
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => { setScope({ type: "all" }); }, [setScope]);

  // Load the saved selection once spaces are known. Saved null means "all spaces".
  useEffect(() => {
    if (!spacesLoaded) return;
    api<{ dashboardSpaces: number[] | null }>("/api/settings").then((s) => {
      const ids = spaces.map((x) => x.id);
      setSelected(s.dashboardSpaces === null ? ids : s.dashboardSpaces.filter((id) => ids.includes(id)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spacesLoaded]);

  const load = useCallback(async () => {
    if (selected === null) return;
    setData(await api<DashData>(`/api/dashboard?spaces=${selected.join(",")}`));
  }, [selected]);
  useEffect(() => { load(); }, [load, version]);

  function toggle(id: number) {
    if (!selected) return;
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    api("/api/settings", { method: "PUT", json: { dashboardSpaces: next } });
  }
  function selectAll() {
    const all = spaces.map((s) => s.id);
    setSelected(all);
    api("/api/settings", { method: "PUT", json: { dashboardSpaces: all } });
  }

  const today = todayISO();
  const [, m, d] = today.split("-").map(Number);
  const spaceOf = (id: number) => spaces.find((s) => s.id === id);
  const dateLine = `יום ${HEB_DAYS[dayOfWeek(today)]}, ${d} ב${HEB_MONTHS[m - 1]}`;

  if (design !== "orig") {
    const sel = selected ?? [];
    const statsOf = (id: number) => data?.stats.find((x) => x.space_id === id);
    return (
      <DesignDashboard design={design} model={{
        dateLine, spaces, selected: sel, toggle, spaceOf, statsOf, openTask,
        shownSpaces: spaces.filter((s) => sel.includes(s.id)),
        totalOpen: spaces.filter((s) => sel.includes(s.id)).reduce((n, s) => n + (statsOf(s.id)?.open ?? 0), 0),
        panels: [
          { key: "urgent", title: "דחוף", tasks: data?.urgent, empty: "אין משימות דחופות" },
          { key: "today", title: "להיום", tasks: data?.dueToday, empty: "אין משימות להיום" },
          { key: "late", title: "באיחור", tasks: data?.overdue, empty: "אין משימות באיחור 🎉" },
        ],
        newSpace: () => setSpaceModal({ mode: "create" }),
        openAgent: () => setChatOpen(true),
      }} />
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title-wrap">
          <div>
            <h1 className="page-title">שלום! 👋</h1>
            <p className="page-sub">{dateLine}</p>
          </div>
        </div>
      </header>

      <div className="filter-bar">
        <span className="filter-label">מרחבים בדשבורד:</span>
        {spaces.map((s) => {
          const on = selected?.includes(s.id);
          return (
            <button key={s.id} className={`space-toggle ${on ? "on" : ""}`} onClick={() => toggle(s.id)}
              style={on ? { background: s.color + "18", borderColor: s.color, color: s.color } : undefined}>
              <span className="dot" style={{ background: on ? s.color : "var(--border-strong)" }} />
              {s.name}
              {on && <Icon.check size={14} />}
            </button>
          );
        })}
        {selected && selected.length < spaces.length && <button className="link-btn" onClick={selectAll}>הצג הכול</button>}
      </div>

      {selected && selected.length === 0 ? (
        <div className="empty">בחר לפחות מרחב אחד כדי לראות משימות.</div>
      ) : (
        <>
          <div className="dash-grid">
            <TaskPanel title="דחוף" tone="urgent" icon={<Icon.flame size={18} />} tasks={data?.urgent} spaceOf={spaceOf} onOpen={openTask} empty="אין משימות דחופות" />
            <TaskPanel title="להיום" tone="today" icon={<Icon.sun size={18} />} tasks={data?.dueToday} spaceOf={spaceOf} onOpen={openTask} empty="אין משימות להיום" />
            <TaskPanel title="באיחור" tone="late" icon={<Icon.clock size={18} />} tasks={data?.overdue} spaceOf={spaceOf} onOpen={openTask} empty="אין משימות באיחור 🎉" />
          </div>

          <h2 className="section-title">המרחבים שלי</h2>
          <div className="space-cards">
            {spaces.filter((s) => selected?.includes(s.id)).map((s) => {
              const st = data?.stats.find((x) => x.space_id === s.id);
              return (
                <Link key={s.id} href={`/space/${s.id}`} className="space-card" style={{ ["--c" as string]: s.color }}>
                  <div className="space-card-head">
                    <span className="space-badge sm" style={{ background: s.color }}>{s.name.slice(0, 1)}</span>
                    <strong>{s.name}</strong>
                    <span className="space-card-view"><ViewIcon view={s.view} size={15} /></span>
                  </div>
                  <div className="stats">
                    <div className="stat"><b>{st?.open ?? "–"}</b><span>פתוחות</span></div>
                    <div className={`stat ${st?.overdue ? "stat-late" : ""}`}><b>{st?.overdue ?? "–"}</b><span>באיחור</span></div>
                    <div className="stat stat-done"><b>{st?.closed_week ?? "–"}</b><span>נסגרו השבוע</span></div>
                  </div>
                </Link>
              );
            })}
            <button className="space-card space-card-new" onClick={() => setSpaceModal({ mode: "create" })}>
              <Icon.plus size={22} />
              מרחב חדש
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TaskPanel(props: {
  title: string; tone: string; icon: React.ReactNode; tasks?: Task[]; empty: string;
  spaceOf: (id: number) => { name: string; color: string } | undefined; onOpen: (t: Task) => void;
}) {
  const { title, tone, icon, tasks, empty, spaceOf, onOpen } = props;
  return (
    <section className={`panel panel-${tone}`}>
      <header className="panel-head">
        <span className="panel-icon">{icon}</span>
        <h3>{title}</h3>
        <span className="count">{tasks?.length ?? 0}</span>
      </header>
      <div className="panel-body">
        {!tasks && <div className="loading-rows"><div /><div /></div>}
        {tasks && !tasks.length && <div className="panel-empty">{empty}</div>}
        {tasks?.map((t) => {
          const s = spaceOf(t.space_id);
          return (
            <button key={t.id} className="dash-task" onClick={() => onOpen(t)}>
              <span className="dash-task-bar" style={{ background: s?.color }} />
              <span className="dash-task-main">
                <span className="dash-task-title">{t.title}</span>
                <span className="dash-task-meta">
                  <span className="space-tag" style={{ color: s?.color }}>{s?.name}</span>
                  <PriorityBadge p={t.priority} small />
                  <DueLabel task={t} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
