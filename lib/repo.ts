import { db } from "./db";
import { todayISO, startOfWeekISO } from "./dates";
import type { Priority, Space, SpaceStats, Status, Task, ViewType } from "./types";
import { PRIORITIES, STATUSES, VIEWS } from "./types";

const TASK_COLS = `id, space_id, title, description, priority, status, due_date,
  completed_at, created_at, updated_at`;

export function isPriority(v: unknown): v is Priority {
  return typeof v === "string" && (PRIORITIES as string[]).includes(v);
}
export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}
export function isView(v: unknown): v is ViewType {
  return typeof v === "string" && (VIEWS as string[]).includes(v);
}
export function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
}

// ---------- spaces ----------
export async function listSpaces(): Promise<Space[]> {
  const sql = await db();
  return sql<Space[]>`SELECT id, name, color, view, position FROM spaces ORDER BY position, id`;
}

export async function getSpace(id: number): Promise<Space | null> {
  const sql = await db();
  const rows = await sql<Space[]>`SELECT id, name, color, view, position FROM spaces WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function createSpace(input: { name: string; color: string; view: ViewType }): Promise<Space> {
  const sql = await db();
  const [row] = await sql<Space[]>`
    INSERT INTO spaces (name, color, view, position)
    VALUES (${input.name}, ${input.color}, ${input.view}, COALESCE((SELECT MAX(position) + 1 FROM spaces), 0))
    RETURNING id, name, color, view, position`;
  return row;
}

export async function updateSpace(id: number, patch: Partial<Pick<Space, "name" | "color" | "view">>): Promise<Space | null> {
  const sql = await db();
  const current = await getSpace(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  const [row] = await sql<Space[]>`
    UPDATE spaces SET name = ${next.name}, color = ${next.color}, view = ${next.view}
    WHERE id = ${id} RETURNING id, name, color, view, position`;
  return row;
}

export async function deleteSpace(id: number): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM spaces WHERE id = ${id}`;
}

// ---------- tasks ----------
export interface TaskFilter {
  spaceIds?: number[];
  ids?: number[];
  statuses?: Status[];
  priorities?: Priority[];
  overdue?: boolean;
  dueFrom?: string;
  dueTo?: string;
  noDueDate?: boolean;
  query?: string;
  includeDone?: boolean;
}

export async function listTasks(f: TaskFilter = {}): Promise<Task[]> {
  const sql = await db();
  const today = todayISO();
  const conds = [sql`TRUE`];
  if (f.spaceIds) conds.push(sql`space_id = ANY(${f.spaceIds}::int[])`);
  if (f.ids) conds.push(sql`id = ANY(${f.ids}::int[])`);
  if (f.statuses?.length) conds.push(sql`status = ANY(${f.statuses}::text[])`);
  else if (f.includeDone === false) conds.push(sql`status <> 'done'`);
  if (f.priorities?.length) conds.push(sql`priority = ANY(${f.priorities}::text[])`);
  if (f.overdue) conds.push(sql`due_date < ${today}::date AND status <> 'done'`);
  if (f.dueFrom) conds.push(sql`due_date >= ${f.dueFrom}::date`);
  if (f.dueTo) conds.push(sql`due_date <= ${f.dueTo}::date`);
  if (f.noDueDate) conds.push(sql`due_date IS NULL`);
  if (f.query) conds.push(sql`(title ILIKE ${"%" + f.query + "%"} OR description ILIKE ${"%" + f.query + "%"})`);
  const where = conds.reduce((acc, c) => sql`${acc} AND ${c}`);
  return sql<Task[]>`
    SELECT ${sql.unsafe(TASK_COLS)} FROM tasks WHERE ${where}
    ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      due_date NULLS LAST, id`;
}

export interface TaskInput {
  space_id: number;
  title: string;
  description?: string;
  priority?: Priority;
  status?: Status;
  due_date?: string | null;
}

export async function createTask(t: TaskInput): Promise<Task> {
  const sql = await db();
  const status = t.status ?? "new";
  const [row] = await sql<Task[]>`
    INSERT INTO tasks (space_id, title, description, priority, status, due_date, completed_at)
    VALUES (${t.space_id}, ${t.title}, ${t.description ?? ""}, ${t.priority ?? "medium"}, ${status},
      ${t.due_date ?? null}, ${status === "done" ? sql`now()` : null})
    RETURNING ${sql.unsafe(TASK_COLS)}`;
  return row;
}

export type TaskPatch = Partial<Pick<Task, "title" | "description" | "priority" | "status" | "due_date" | "space_id">>;

export async function updateTask(id: number, patch: TaskPatch): Promise<Task | null> {
  const sql = await db();
  const [cur] = await sql<Task[]>`SELECT ${sql.unsafe(TASK_COLS)} FROM tasks WHERE id = ${id}`;
  if (!cur) return null;
  const n = { ...cur, ...patch };
  const completedAt =
    n.status === "done" ? (cur.status === "done" ? cur.completed_at : new Date().toISOString()) : null;
  const [row] = await sql<Task[]>`
    UPDATE tasks SET title = ${n.title}, description = ${n.description}, priority = ${n.priority},
      status = ${n.status}, due_date = ${n.due_date}, space_id = ${n.space_id},
      completed_at = ${completedAt}, updated_at = now()
    WHERE id = ${id} RETURNING ${sql.unsafe(TASK_COLS)}`;
  return row;
}

export async function deleteTasks(ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const sql = await db();
  const res = await sql`DELETE FROM tasks WHERE id = ANY(${ids}::int[])`;
  return res.count;
}

// ---------- stats ----------
export async function spaceStats(spaceIds?: number[]): Promise<SpaceStats[]> {
  const sql = await db();
  const today = todayISO();
  const weekStart = startOfWeekISO(today);
  const rows = await sql<SpaceStats[]>`
    SELECT s.id AS space_id,
      COUNT(t.id) FILTER (WHERE t.status <> 'done')::int AS open,
      COUNT(t.id) FILTER (WHERE t.status <> 'done' AND t.due_date < ${today}::date)::int AS overdue,
      COUNT(t.id) FILTER (WHERE t.status = 'done'
        AND (t.completed_at AT TIME ZONE 'Asia/Jerusalem')::date >= ${weekStart}::date)::int AS closed_week
    FROM spaces s LEFT JOIN tasks t ON t.space_id = s.id
    ${spaceIds ? sql`WHERE s.id = ANY(${spaceIds}::int[])` : sql``}
    GROUP BY s.id ORDER BY s.position, s.id`;
  return rows;
}

// ---------- settings ----------
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const sql = await db();
  const rows = await sql<{ value: T }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return rows.length ? rows[0].value : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const sql = await db();
  await sql`INSERT INTO settings (key, value) VALUES (${key}, ${sql.json(value as never)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
