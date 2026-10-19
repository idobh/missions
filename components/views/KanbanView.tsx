"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { STATUSES, STATUS_META, PRIORITY_META, type Space, type Status, type Task } from "@/lib/types";
import { useStore } from "../store";
import { DueLabel, Icon, PriorityBadge } from "../ui";
import { sortTasks } from "./sort";

interface Props {
  space: Space;
  tasks: Task[];
  patch: (id: number, p: Partial<Task>) => void;
}

export function KanbanView({ space, tasks, patch }: Props) {
  const { openTask } = useStore();
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  function onStart(e: DragStartEvent) {
    setActive(tasks.find((t) => t.id === e.active.id) ?? null);
  }
  function onEnd(e: DragEndEvent) {
    setActive(null);
    const to = e.over?.id as Status | undefined;
    const t = tasks.find((x) => x.id === e.active.id);
    if (t && to && t.status !== to) patch(t.id, { status: to });
  }

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className="kanban">
        {STATUSES.map((s) => {
          const col = sortTasks(tasks.filter((t) => t.status === s));
          return (
            <Column key={s} status={s} count={col.length} onAdd={() => openTask({ space_id: space.id, status: s })}>
              {col.map((t) => <DraggableCard key={t.id} task={t} onOpen={() => openTask(t)} />)}
              {!col.length && <div className="col-empty">גרור לכאן משימות</div>}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: "ease-out" }}>
        {active ? <Card task={active} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, count, onAdd, children }: { status: Status; count: number; onAdd: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const m = STATUS_META[status];
  return (
    <section ref={setNodeRef} className={`kcol ${isOver ? "over" : ""}`}>
      <header className="kcol-head">
        <span className="kcol-dot" style={{ background: m.color }} />
        <span className="kcol-title">{m.label}</span>
        <span className="count">{count}</span>
        <button className="icon-btn sm" onClick={onAdd} aria-label={`משימה חדשה ב${m.label}`}><Icon.plus size={16} /></button>
      </header>
      <div className="kcol-body">{children}</div>
    </section>
  );
}

function DraggableCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onOpen} style={{ opacity: isDragging ? 0.35 : 1 }}>
      <Card task={task} />
    </div>
  );
}

function Card({ task, dragging }: { task: Task; dragging?: boolean }) {
  return (
    <article className={`kcard ${dragging ? "dragging" : ""} ${task.status === "done" ? "is-done" : ""}`}
      style={{ borderInlineStartColor: PRIORITY_META[task.priority].color }}>
      <div className="kcard-title">{task.title}</div>
      {task.description && <div className="kcard-desc">{task.description}</div>}
      <div className="kcard-meta">
        <PriorityBadge p={task.priority} small />
        <DueLabel task={task} />
      </div>
    </article>
  );
}
