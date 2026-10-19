"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { PRIORITY_META, type Space, type Task } from "@/lib/types";
import { addDays, dayOfWeek, HEB_DAYS, HEB_MONTHS, todayISO } from "@/lib/dates";
import { useStore } from "../store";
import { Icon } from "../ui";
import { sortTasks } from "./sort";

interface Props {
  space: Space;
  tasks: Task[];
  patch: (id: number, p: Partial<Task>) => void;
}

const MAX_CHIPS = 3;

export function CalendarView({ space, tasks, patch }: Props) {
  const { openTask } = useStore();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => today.slice(0, 7)); // YYYY-MM
  const [active, setActive] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const [y, m] = cursor.split("-").map(Number);
  const days = useMemo(() => {
    const first = `${cursor}-01`;
    const start = addDays(first, -dayOfWeek(first));
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const end = addDays(`${cursor}-${String(lastDay).padStart(2, "0")}`, 6 - dayOfWeek(`${cursor}-${String(lastDay).padStart(2, "0")}`));
    const out: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor, y, m]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of sortTasks(tasks)) {
      if (!t.due_date) continue;
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date)!.push(t);
    }
    // open tasks first, done at the bottom
    for (const list of map.values()) list.sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
    return map;
  }, [tasks]);

  const undated = sortTasks(tasks.filter((t) => !t.due_date && t.status !== "done"));

  function shift(delta: number) {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setCursor(d.toISOString().slice(0, 7));
    setExpanded(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "ArrowLeft") shift(1);
      if (e.key === "ArrowRight") shift(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onEnd(e: DragEndEvent) {
    setActive(null);
    const t = tasks.find((x) => x.id === e.active.id);
    const to = e.over?.id as string | undefined;
    if (!t || !to) return;
    const due = to === "undated" ? null : to;
    if (t.due_date !== due) patch(t.id, { due_date: due });
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActive(tasks.find((t) => t.id === e.active.id) ?? null)}
      onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className="cal-wrap">
        <div className="cal">
          <div className="cal-toolbar">
            <button className="btn btn-secondary btn-sm" onClick={() => { setCursor(today.slice(0, 7)); setExpanded(null); }}>היום</button>
            <div className="cal-nav">
              <button className="icon-btn" onClick={() => shift(-1)} aria-label="החודש הקודם"><Icon.chevronRight /></button>
              <button className="icon-btn" onClick={() => shift(1)} aria-label="החודש הבא"><Icon.chevronLeft /></button>
            </div>
            <h2 className="cal-title">{HEB_MONTHS[m - 1]} {y}</h2>
          </div>

          <div className="cal-grid cal-head">
            {HEB_DAYS.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          </div>
          <div className="cal-grid cal-body" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(112px, 1fr))` }}>
            {days.map((d) => (
              <DayCell
                key={d}
                date={d}
                inMonth={d.slice(0, 7) === cursor}
                isToday={d === today}
                tasks={byDay.get(d) ?? []}
                expanded={expanded === d}
                onExpand={(v) => setExpanded(v ? d : null)}
                onNew={() => openTask({ space_id: space.id, due_date: d })}
                onOpen={(t) => openTask(t)}
              />
            ))}
          </div>
        </div>

        <aside className="cal-side">
          <UndatedDrop>
            <h3 className="side-title">ללא תאריך <span className="count">{undated.length}</span></h3>
            <p className="side-hint">גרור משימה ליום בלוח כדי לקבוע לה תאריך</p>
            <div className="side-list">
              {undated.map((t) => <Chip key={t.id} task={t} onOpen={() => openTask(t)} />)}
              {!undated.length && <div className="col-empty">אין משימות ללא תאריך</div>}
            </div>
            <button className="btn btn-secondary btn-block" onClick={() => openTask({ space_id: space.id })}>
              <Icon.plus size={16} /> משימה ללא תאריך
            </button>
          </UndatedDrop>
        </aside>
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
        {active ? <ChipBody task={active} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function UndatedDrop({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "undated" });
  return <div ref={setNodeRef} className={`side-card ${isOver ? "over" : ""}`}>{children}</div>;
}

function DayCell(props: {
  date: string; inMonth: boolean; isToday: boolean; tasks: Task[]; expanded: boolean;
  onExpand: (v: boolean) => void; onNew: () => void; onOpen: (t: Task) => void;
}) {
  const { date, inMonth, isToday, tasks, expanded, onExpand, onNew, onOpen } = props;
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const day = Number(date.slice(8));
  const visible = tasks.slice(0, MAX_CHIPS);
  const hidden = tasks.length - visible.length;
  const label = day === 1 ? `${day} ב${HEB_MONTHS[Number(date.slice(5, 7)) - 1]}` : String(day);

  return (
    <div
      ref={setNodeRef}
      className={`cal-cell ${inMonth ? "" : "muted"} ${isToday ? "today" : ""} ${isOver ? "over" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("cal-cell-fill")) onNew(); }}
      title="לחיצה על היום יוצרת משימה חדשה בתאריך הזה"
    >
      <div className="cal-cell-top">
        <span className="cal-daynum">{label}</span>
        <button className="cal-add" onClick={onNew} aria-label="משימה חדשה ביום זה"><Icon.plus size={14} /></button>
      </div>
      <div className="cal-chips">
        {visible.map((t) => <Chip key={t.id} task={t} onOpen={() => onOpen(t)} />)}
        {hidden > 0 && (
          <button className="cal-more" onClick={(e) => { e.stopPropagation(); onExpand(true); }}>
            עוד {hidden}
          </button>
        )}
      </div>
      <div className="cal-cell-fill" />
      {expanded && (
        <div className="cal-pop" onClick={(e) => e.stopPropagation()}>
          <div className="cal-pop-head">
            <strong>{HEB_DAYS[dayOfWeek(date)]}, {day} ב{HEB_MONTHS[Number(date.slice(5, 7)) - 1]}</strong>
            <button className="icon-btn sm" onClick={() => onExpand(false)} aria-label="סגירה"><Icon.close size={16} /></button>
          </div>
          {tasks.map((t) => <ChipBody key={t.id} task={t} onClick={() => { onExpand(false); onOpen(t); }} />)}
        </div>
      )}
    </div>
  );
}

function Chip({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0.3 : 1 }}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}>
      <ChipBody task={task} />
    </div>
  );
}

function ChipBody({ task, dragging, onClick }: { task: Task; dragging?: boolean; onClick?: () => void }) {
  const m = PRIORITY_META[task.priority];
  const done = task.status === "done";
  return (
    <div className={`chip-task ${done ? "is-done" : ""} ${dragging ? "dragging" : ""}`} onClick={onClick}
      style={{ background: done ? "var(--surface-2)" : m.bg, color: done ? "var(--muted)" : m.color, borderInlineStartColor: m.color }}
      title={`${task.title} · ${m.label}`}>
      {done && <Icon.check size={12} />}
      <span className="chip-task-text">{task.title}</span>
    </div>
  );
}
