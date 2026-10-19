"use client";

import { useState } from "react";
import { PRIORITIES, PRIORITY_META, type Space, type Task } from "@/lib/types";
import { useStore } from "../store";
import { DueLabel, Empty, Icon, StatusBadge } from "../ui";
import { sortTasks } from "./sort";

interface Props {
  space: Space;
  tasks: Task[];
  patch: (id: number, p: Partial<Task>) => void;
}

export function TodoView({ space, tasks, patch }: Props) {
  const { openTask } = useStore();
  const [showDone, setShowDone] = useState(false);
  const open = sortTasks(tasks.filter((t) => t.status !== "done"));
  const done = tasks.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  return (
    <div className="todo">
      <QuickAdd space={space} />
      {!open.length && <Empty>אין משימות פתוחות. כל הכבוד! 🎉</Empty>}
      {PRIORITIES.map((p) => {
        const group = open.filter((t) => t.priority === p);
        if (!group.length) return null;
        const m = PRIORITY_META[p];
        return (
          <section key={p} className="todo-group">
            <h3 className="todo-group-title" style={{ color: m.color }}>
              <span className="dot" style={{ background: m.color }} /> {m.label}
              <span className="count">{group.length}</span>
            </h3>
            <ul className="todo-list">
              {group.map((t) => <Row key={t.id} task={t} onToggle={() => patch(t.id, { status: "done" })} onOpen={() => openTask(t)} />)}
            </ul>
          </section>
        );
      })}
      {done.length > 0 && (
        <section className="todo-group">
          <button className="todo-done-toggle" onClick={() => setShowDone((v) => !v)}>
            <Icon.chevronDown size={16} style={{ transform: showDone ? "none" : "rotate(90deg)", transition: "transform .15s" }} />
            הושלמו <span className="count">{done.length}</span>
          </button>
          {showDone && (
            <ul className="todo-list">
              {done.map((t) => <Row key={t.id} task={t} onToggle={() => patch(t.id, { status: "new" })} onOpen={() => openTask(t)} />)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Row({ task, onToggle, onOpen }: { task: Task; onToggle: () => void; onOpen: () => void }) {
  const done = task.status === "done";
  const color = PRIORITY_META[task.priority].color;
  return (
    <li className={`todo-row ${done ? "is-done" : ""}`}>
      <button className="check" onClick={onToggle} aria-label={done ? "סמן כלא הושלמה" : "סמן כהושלמה"}
        style={{ borderColor: color, background: done ? color : undefined }}>
        {done && <Icon.check size={14} />}
      </button>
      <button className="todo-main" onClick={onOpen}>
        <span className="todo-title">{task.title}</span>
        <span className="todo-meta">
          {task.status !== "new" && !done && <StatusBadge s={task.status} small />}
          <DueLabel task={task} />
        </span>
      </button>
    </li>
  );
}

function QuickAdd({ space }: { space: Space }) {
  const { bump, toast, openTask } = useStore();
  const [title, setTitle] = useState("");
  async function add() {
    if (!title.trim()) return openTask({ space_id: space.id });
    await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ space_id: space.id, title }),
    });
    setTitle("");
    toast("המשימה נוספה");
    bump();
  }
  return (
    <div className="quick-add">
      <Icon.plus size={18} />
      <input placeholder="הוספה מהירה: הקלד משימה ולחץ Enter" value={title}
        onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
    </div>
  );
}
