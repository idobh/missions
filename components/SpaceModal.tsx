"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useStore } from "./store";
import { Icon, ViewIcon } from "./ui";
import { SPACE_COLORS, VIEWS, VIEW_META, type Space, type ViewType } from "@/lib/types";

export function SpaceModal() {
  const { spaceModal, setSpaceModal, refreshSpaces, toast, bump } = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(SPACE_COLORS[0]);
  const [view, setView] = useState<ViewType>("kanban");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!spaceModal) return;
    if (spaceModal.mode === "edit") {
      setName(spaceModal.space.name);
      setColor(spaceModal.space.color);
      setView(spaceModal.space.view);
    } else {
      setName("");
      setColor(SPACE_COLORS[Math.floor(Math.random() * SPACE_COLORS.length)]);
      setView("kanban");
    }
    setConfirmDelete(false);
  }, [spaceModal]);

  if (!spaceModal) return null;
  const isEdit = spaceModal.mode === "edit";
  const close = () => setSpaceModal(null);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (isEdit) {
        await api(`/api/spaces/${(spaceModal as { space: Space }).space.id}`, { method: "PATCH", json: { name, color, view } });
        toast("המרחב עודכן");
      } else {
        const s = await api<Space>("/api/spaces", { method: "POST", json: { name, color, view } });
        toast("המרחב נוצר");
        router.push(`/space/${s.id}`);
      }
      await refreshSpaces();
      bump();
      close();
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
      await api(`/api/spaces/${(spaceModal as { space: Space }).space.id}`, { method: "DELETE" });
      toast("המרחב נמחק");
      await refreshSpaces();
      close();
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal modal-sm" role="dialog" aria-modal="true">
        <div className="modal-head" style={{ borderTopColor: color }}>
          <span className="modal-kicker">{isEdit ? "הגדרות מרחב" : "מרחב חדש"}</span>
          <button className="icon-btn" onClick={close} aria-label="סגירה"><Icon.close /></button>
        </div>
        <div className="modal-body">
          <label className="field-label">שם המרחב</label>
          <input className="input" autoFocus placeholder="לדוגמה: פרויקט חדש, כושר, משפחה" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />

          <label className="field-label">צבע</label>
          <div className="colors">
            {SPACE_COLORS.map((c) => (
              <button key={c} type="button" className={`swatch ${c === color ? "on" : ""}`} style={{ background: c }}
                onClick={() => setColor(c)} aria-label={c}>
                {c === color && <Icon.check size={14} />}
              </button>
            ))}
          </div>

          <label className="field-label">תצוגה</label>
          <div className="view-pick">
            {VIEWS.map((v) => (
              <button key={v} type="button" className={`view-card ${view === v ? "on" : ""}`} onClick={() => setView(v)}
                style={view === v ? { borderColor: color, boxShadow: `0 0 0 3px ${color}22` } : undefined}>
                <span className="view-card-icon" style={view === v ? { color } : undefined}><ViewIcon view={v} size={22} /></span>
                <strong>{VIEW_META[v].label}</strong>
                <small>{VIEW_META[v].description}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          {isEdit && (
            <button className={`btn btn-ghost-danger ${confirmDelete ? "armed" : ""}`} onClick={remove} disabled={busy}>
              <Icon.trash size={16} /> {confirmDelete ? "כל המשימות יימחקו. ללחוץ שוב" : "מחיקת מרחב"}
            </button>
          )}
          <div className="spacer" />
          <button className="btn btn-secondary" onClick={close}>ביטול</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !name.trim()} style={{ background: color }}>
            {isEdit ? "שמירה" : "יצירת מרחב"}
          </button>
        </div>
      </div>
    </div>
  );
}
