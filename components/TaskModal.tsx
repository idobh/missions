"use client";

import { useEffect, useRef, useState } from "react";
import { api, useStore } from "./store";
import { Icon } from "./ui";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, type Priority, type Status } from "@/lib/types";
import { addDays, todayISO } from "@/lib/dates";

export function TaskModal() {
  const { editing, closeTask, spaces, bump, toast } = useStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<Status>("new");
  const [due, setDue] = useState("");
  const [spaceId, setSpaceId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    setTitle(editing.title ?? "");
    setDescription(editing.description ?? "");
    setPriority(editing.priority ?? "medium");
    setStatus(editing.status ?? "new");
    setDue(editing.due_date ?? "");
    setSpaceId(editing.space_id ?? spaces[0]?.id ?? "");
    setConfirmDelete(false);
    setTimeout(() => titleRef.current?.focus(), 30);
  }, [editing, spaces]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeTask();
    if (editing) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, closeTask]);

  if (!editing) return null;
  const isNew = !editing.id;
  const space = spaces.find((s) => s.id === spaceId);

  async function save() {
    if (!title.trim()) { titleRef.current?.focus(); return; }
    if (!spaceId) return toast("בחר מרחב");
    setBusy(true);
    const body = { title: title.trim(), description, priority, status, due_date: due || null, space_id: spaceId };
    try {
      if (isNew) await api("/api/tasks", { method: "POST", json: body });
      else await api(`/api/tasks/${editing!.id}`, { method: "PATCH", json: body });
      toast(isNew ? "המשימה נוספה" : "המשימה עודכנה");
      bump();
      closeTask();
    } catch (e) {
      toast(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await api(`/api/tasks/${editing!.id}`, { method: "DELETE" });
      toast("המשימה נמחקה");
      bump();
      closeTask();
    } finally {
      setBusy(false);
    }
  }

  const today = todayISO();
  const quickDates = [
    { label: "היום", v: today },
    { label: "מחר", v: addDays(today, 1) },
    { label: "בעוד שבוע", v: addDays(today, 7) },
  ];

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closeTask()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={isNew ? "משימה חדשה" : "עריכת משימה"}>
        <div className="modal-head" style={{ borderTopColor: space?.color }}>
          <span className="modal-kicker">
            <span className="dot" style={{ background: space?.color }} />
            {isNew ? "משימה חדשה" : "כרטיס משימה"}
          </span>
          <button className="icon-btn" onClick={closeTask} aria-label="סגירה"><Icon.close /></button>
        </div>

        <div className="modal-body">
          <input
            ref={titleRef}
            className="title-input"
            placeholder="מה צריך לעשות?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />

          <label className="field-label">עדיפות</label>
          <div className="seg">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className={`seg-btn ${priority === p ? "on" : ""}`}
                style={priority === p ? { background: PRIORITY_META[p].bg, color: PRIORITY_META[p].color, borderColor: PRIORITY_META[p].color } : undefined}
                onClick={() => setPriority(p)}
              >
                <span className="dot" style={{ background: PRIORITY_META[p].color }} />
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>

          <label className="field-label">סטטוס</label>
          <div className="seg">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`seg-btn ${status === s ? "on" : ""}`}
                style={status === s ? { color: STATUS_META[s].color, borderColor: STATUS_META[s].color, background: STATUS_META[s].color + "14" } : undefined}
                onClick={() => setStatus(s)}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>

          <div className="grid-2">
            <div>
              <label className="field-label">תאריך יעד</label>
              <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
              <div className="chips">
                {quickDates.map((q) => (
                  <button key={q.v} type="button" className={`chip ${due === q.v ? "on" : ""}`} onClick={() => setDue(q.v)}>{q.label}</button>
                ))}
                {due && <button type="button" className="chip" onClick={() => setDue("")}>ללא תאריך</button>}
              </div>
            </div>
            <div>
              <label className="field-label">מרחב</label>
              <select className="input" value={spaceId} onChange={(e) => setSpaceId(Number(e.target.value))}>
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <label className="field-label">פרטים</label>
          <textarea className="input textarea" rows={3} placeholder="הערות, קישורים, פרטים נוספים..." value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="modal-foot">
          {!isNew && (
            <button className={`btn btn-ghost-danger ${confirmDelete ? "armed" : ""}`} onClick={remove} disabled={busy}>
              <Icon.trash size={16} /> {confirmDelete ? "ללחוץ שוב למחיקה" : "מחיקה"}
            </button>
          )}
          <div className="spacer" />
          <button className="btn btn-secondary" onClick={closeTask}>ביטול</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{isNew ? "הוספה" : "שמירה"}</button>
        </div>
      </div>
    </div>
  );
}
