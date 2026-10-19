"use client";

import type { ReactNode, SVGProps } from "react";
import { PRIORITY_META, STATUS_META, type Priority, type Status, type Task } from "@/lib/types";
import { formatDateHe, isOverdue } from "@/lib/dates";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
function Svg({ size = 18, children, ...p }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>{children}</svg>
  );
}
export const Icon = {
  plus: (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  home: (p: IconProps) => <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>,
  kanban: (p: IconProps) => <Svg {...p}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="13" rx="1.5" /></Svg>,
  list: (p: IconProps) => <Svg {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" /></Svg>,
  calendar: (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Svg>,
  close: (p: IconProps) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>,
  chevronRight: (p: IconProps) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>,
  chevronLeft: (p: IconProps) => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>,
  chevronDown: (p: IconProps) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>,
  trash: (p: IconProps) => <Svg {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg>,
  settings: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Svg>,
  send: (p: IconProps) => <Svg {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></Svg>,
  sparkles: (p: IconProps) => <Svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /></Svg>,
  check: (p: IconProps) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>,
  alert: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></Svg>,
  flame: (p: IconProps) => <Svg {...p}><path d="M12 22c4 0 7-3 7-7 0-5-4-7-5-11-2 2-3 4-3 6-1-1-2-2-2-4-2 2-4 5-4 9 0 4 3 7 7 7z" /></Svg>,
  sun: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>,
  clock: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>,
  menu: (p: IconProps) => <Svg {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Svg>,
  logout: (p: IconProps) => <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Svg>,
  refresh: (p: IconProps) => <Svg {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></Svg>,
};

export function ViewIcon({ view, size }: { view: string; size?: number }) {
  if (view === "todo") return <Icon.list size={size} />;
  if (view === "calendar") return <Icon.calendar size={size} />;
  return <Icon.kanban size={size} />;
}

export function PriorityBadge({ p, small }: { p: Priority; small?: boolean }) {
  const m = PRIORITY_META[p];
  return (
    <span className={`badge ${small ? "badge-sm" : ""}`} style={{ color: m.color, background: m.bg }}>
      <span className="dot" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function StatusBadge({ s, small }: { s: Status; small?: boolean }) {
  const m = STATUS_META[s];
  return (
    <span className={`badge badge-outline ${small ? "badge-sm" : ""}`} style={{ color: m.color, borderColor: m.color + "55" }}>
      {m.label}
    </span>
  );
}

export function DueLabel({ task }: { task: Pick<Task, "due_date" | "status"> }) {
  if (!task.due_date) return null;
  const late = isOverdue(task.due_date, task.status);
  return (
    <span className={`due ${late ? "due-late" : ""}`}>
      <Icon.calendar size={13} />
      {formatDateHe(task.due_date)}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
