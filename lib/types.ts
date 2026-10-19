export type Priority = "low" | "medium" | "high" | "urgent";
export type Status = "new" | "in_progress" | "on_hold" | "done";
export type ViewType = "kanban" | "todo" | "calendar";

export interface Space {
  id: number;
  name: string;
  color: string;
  view: ViewType;
  position: number;
}

export interface Task {
  id: number;
  space_id: number;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  due_date: string | null; // YYYY-MM-DD
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpaceStats {
  space_id: number;
  open: number;
  overdue: number;
  closed_week: number;
}

export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];
export const STATUSES: Status[] = ["new", "in_progress", "on_hold", "done"];
export const VIEWS: ViewType[] = ["kanban", "todo", "calendar"];

export const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; rank: number }> = {
  urgent: { label: "דחוף", color: "#dc2626", bg: "#fee2e2", rank: 0 },
  high: { label: "גבוהה", color: "#ea580c", bg: "#ffedd5", rank: 1 },
  medium: { label: "בינונית", color: "#ca8a04", bg: "#fef9c3", rank: 2 },
  low: { label: "נמוכה", color: "#16a34a", bg: "#dcfce7", rank: 3 },
};

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  new: { label: "חדשה", color: "#6366f1" },
  in_progress: { label: "בעבודה", color: "#0ea5e9" },
  on_hold: { label: "בהשהייה", color: "#a855f7" },
  done: { label: "הושלמה", color: "#22c55e" },
};

export const VIEW_META: Record<ViewType, { label: string; description: string }> = {
  kanban: { label: "קנבן", description: "עמודות לפי סטטוס עם גרירה" },
  todo: { label: "רשימת משימות", description: "רשימה עם וי, ממוינת לפי עדיפות" },
  calendar: { label: "לוח שנה", description: "חודש שלם לפי תאריך יעד" },
};

export const SPACE_COLORS = [
  "#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#84cc16", "#eab308",
  "#f97316", "#ef4444", "#ec4899", "#a855f7", "#64748b", "#0f766e",
];

export type AgentScope = { type: "all" } | { type: "space"; spaceId: number };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PendingAction {
  id: string;
  summary: string;
  count: number;
  preview: string[];
  kind: "add" | "update" | "delete";
}
