import { randomUUID } from "crypto";
import { db } from "./db";
import { addDays, HEB_DAYS, todayISO } from "./dates";
import {
  createTask, deleteTasks, isISODate, isPriority, isStatus, listSpaces, listTasks, spaceStats, updateTask,
  type TaskFilter, type TaskPatch,
} from "./repo";
import { PRIORITY_META, STATUS_META, type AgentScope, type ChatMessage, type PendingAction, type Space, type Task } from "./types";

export const CONFIRM_THRESHOLD = 3;
const MAX_STEPS = 8;

// ---------------------------------------------------------------- tool schemas
const PRIORITY_ENUM = ["low", "medium", "high", "urgent"];
const STATUS_ENUM = ["new", "in_progress", "on_hold", "done"];

const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_tasks",
      description: "קריאת משימות מתוך המרחבים שבטווח. מחזיר רשימה עם מזהים. השתמש לפני עדכון או מחיקה כדי לקבל מזהים.",
      parameters: {
        type: "object",
        properties: {
          space_id: { type: "integer", description: "סינון למרחב מסוים (רק כשהטווח הוא כל המרחבים)" },
          statuses: { type: "array", items: { type: "string", enum: STATUS_ENUM } },
          priorities: { type: "array", items: { type: "string", enum: PRIORITY_ENUM } },
          overdue: { type: "boolean", description: "רק משימות שתאריך היעד שלהן עבר ולא הושלמו" },
          due_from: { type: "string", description: "YYYY-MM-DD" },
          due_to: { type: "string", description: "YYYY-MM-DD" },
          no_due_date: { type: "boolean" },
          query: { type: "string", description: "חיפוש טקסט בכותרת/תיאור" },
          include_done: { type: "boolean", description: "ברירת מחדל true" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_tasks",
      description: "הוספת משימה אחת או יותר.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                space_id: { type: "integer", description: "חובה כשהטווח הוא כל המרחבים" },
                priority: { type: "string", enum: PRIORITY_ENUM },
                status: { type: "string", enum: STATUS_ENUM },
                due_date: { type: "string", description: "YYYY-MM-DD" },
                description: { type: "string" },
              },
              required: ["title"],
              additionalProperties: false,
            },
          },
        },
        required: ["tasks"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tasks",
      description: "עדכון משימות קיימות לפי מזהה. כל פריט מכיל מזהה ואת השדות לשינוי. due_date ריק (\"\") מסיר תאריך.",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "integer" },
                title: { type: "string" },
                priority: { type: "string", enum: PRIORITY_ENUM },
                status: { type: "string", enum: STATUS_ENUM },
                due_date: { type: "string", description: "YYYY-MM-DD או \"\"" },
                description: { type: "string" },
                space_id: { type: "integer" },
              },
              required: ["id"],
              additionalProperties: false,
            },
          },
        },
        required: ["updates"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_tasks",
      description: "מחיקת משימות לפי מזהים. תמיד דורש אישור של המשתמש (המערכת מבקשת אותו אוטומטית).",
      parameters: {
        type: "object",
        properties: { ids: { type: "array", items: { type: "integer" } } },
        required: ["ids"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_tasks",
      description: "סיכום מספרי של המשימות בטווח: לפי סטטוס, עדיפות, באיחור, להיום, לשבוע הקרוב, ולפי מרחב, כולל המשימות הדחופות והבאיחור.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

// ---------------------------------------------------------------- context
interface Ctx {
  scope: AgentScope;
  spaces: Space[]; // spaces inside scope
  allowed: Set<number>;
  changed: boolean;
}

async function buildCtx(scope: AgentScope): Promise<Ctx> {
  const all = await listSpaces();
  const spaces = scope.type === "space" ? all.filter((s) => s.id === scope.spaceId) : all;
  return { scope, spaces, allowed: new Set(spaces.map((s) => s.id)), changed: false };
}

function spaceName(ctx: Ctx, id: number) {
  return ctx.spaces.find((s) => s.id === id)?.name ?? `#${id}`;
}

function compactTask(ctx: Ctx, t: Task) {
  return {
    id: t.id,
    title: t.title,
    space: spaceName(ctx, t.space_id),
    space_id: t.space_id,
    priority: t.priority,
    status: t.status,
    due_date: t.due_date,
    ...(t.description ? { description: t.description.slice(0, 200) } : {}),
  };
}

// ---------------------------------------------------------------- tool execution
type ToolOutcome = { result: unknown } | { pending: PendingAction };

interface PlannedWrite {
  kind: "add" | "update" | "delete";
  scope: AgentScope;
  adds?: { space_id: number; title: string; priority?: string; status?: string; due_date?: string | null; description?: string }[];
  updates?: { id: number; patch: TaskPatch }[];
  ids?: number[];
}

function describePatch(p: TaskPatch): string {
  const parts: string[] = [];
  if (p.status) parts.push(`סטטוס ← ${STATUS_META[p.status].label}`);
  if (p.priority) parts.push(`עדיפות ← ${PRIORITY_META[p.priority].label}`);
  if (p.due_date !== undefined) parts.push(p.due_date ? `תאריך ← ${p.due_date}` : "הסרת תאריך");
  if (p.title) parts.push("כותרת");
  if (p.space_id) parts.push("העברת מרחב");
  if (p.description !== undefined) parts.push("תיאור");
  return parts.join(", ");
}

async function runWrite(plan: PlannedWrite, ctx: Ctx): Promise<{ count: number; summary: string; titles: string[] }> {
  if (plan.kind === "add") {
    const created: Task[] = [];
    for (const a of plan.adds!) {
      created.push(await createTask({
        space_id: a.space_id, title: a.title,
        priority: isPriority(a.priority) ? a.priority : "medium",
        status: isStatus(a.status) ? a.status : "new",
        due_date: a.due_date ?? null, description: a.description ?? "",
      }));
    }
    ctx.changed = created.length > 0;
    return { count: created.length, summary: `נוספו ${created.length} משימות`, titles: created.map((t) => t.title) };
  }
  if (plan.kind === "update") {
    const titles: string[] = [];
    for (const u of plan.updates!) {
      const t = await updateTask(u.id, u.patch);
      if (t) titles.push(t.title);
    }
    ctx.changed = titles.length > 0;
    return { count: titles.length, summary: `עודכנו ${titles.length} משימות`, titles };
  }
  const existing = await listTasks({ ids: plan.ids!, spaceIds: [...ctx.allowed] });
  const n = await deleteTasks(existing.map((t) => t.id));
  ctx.changed = n > 0;
  return { count: n, summary: `נמחקו ${n} משימות`, titles: existing.map((t) => t.title) };
}

async function savePending(plan: PlannedWrite, ctx: Ctx, preview: string[], summary: string, count: number): Promise<PendingAction> {
  const sql = await db();
  const id = randomUUID();
  await sql`DELETE FROM pending_actions WHERE created_at < now() - interval '1 day'`;
  await sql`INSERT INTO pending_actions (id, payload) VALUES (${id}, ${sql.json(plan as never)})`;
  void ctx;
  return { id, summary, count, preview, kind: plan.kind };
}

async function execTool(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<ToolOutcome> {
  const allowedIds = [...ctx.allowed];

  if (name === "read_tasks") {
    const f: TaskFilter = { spaceIds: allowedIds };
    if (typeof args.space_id === "number") {
      if (!ctx.allowed.has(args.space_id)) return { result: { error: "המרחב מחוץ לטווח העבודה הנוכחי" } };
      f.spaceIds = [args.space_id];
    }
    if (Array.isArray(args.statuses)) f.statuses = args.statuses.filter(isStatus);
    if (Array.isArray(args.priorities)) f.priorities = args.priorities.filter(isPriority);
    if (args.overdue) f.overdue = true;
    if (isISODate(args.due_from)) f.dueFrom = args.due_from;
    if (isISODate(args.due_to)) f.dueTo = args.due_to;
    if (args.no_due_date) f.noDueDate = true;
    if (typeof args.query === "string" && args.query.trim()) f.query = args.query.trim();
    if (args.include_done === false) f.includeDone = false;
    const tasks = await listTasks(f);
    return { result: { count: tasks.length, tasks: tasks.slice(0, 150).map((t) => compactTask(ctx, t)) } };
  }

  if (name === "summarize_tasks") {
    const today = todayISO();
    const week = addDays(today, 7);
    const [tasks, stats] = await Promise.all([listTasks({ spaceIds: allowedIds }), spaceStats(allowedIds)]);
    const open = tasks.filter((t) => t.status !== "done");
    const by = <K extends string>(arr: Task[], key: (t: Task) => K) =>
      arr.reduce((acc, t) => ((acc[key(t)] = (acc[key(t)] || 0) + 1), acc), {} as Record<string, number>);
    return {
      result: {
        today,
        total: tasks.length,
        open: open.length,
        by_status: by(tasks, (t) => t.status),
        open_by_priority: by(open, (t) => t.priority),
        overdue: open.filter((t) => t.due_date && t.due_date < today).map((t) => compactTask(ctx, t)),
        due_today: open.filter((t) => t.due_date === today).map((t) => compactTask(ctx, t)),
        due_next_7_days: open.filter((t) => t.due_date && t.due_date > today && t.due_date <= week).length,
        urgent_open: open.filter((t) => t.priority === "urgent").map((t) => compactTask(ctx, t)),
        per_space: stats.map((s) => ({ space: spaceName(ctx, s.space_id), open: s.open, overdue: s.overdue, closed_this_week: s.closed_week })),
      },
    };
  }

  if (name === "add_tasks") {
    const items = Array.isArray(args.tasks) ? (args.tasks as Record<string, unknown>[]) : [];
    const adds: NonNullable<PlannedWrite["adds"]> = [];
    for (const it of items) {
      const title = typeof it.title === "string" ? it.title.trim() : "";
      if (!title) continue;
      let sid = typeof it.space_id === "number" ? it.space_id : undefined;
      if (ctx.scope.type === "space") sid = ctx.scope.spaceId;
      if (!sid && ctx.spaces.length === 1) sid = ctx.spaces[0].id;
      if (!sid || !ctx.allowed.has(sid)) {
        return { result: { error: `לא צוין מרחב תקין למשימה "${title}". שאל את המשתמש לאיזה מרחב להוסיף.` } };
      }
      adds.push({
        space_id: sid, title,
        priority: isPriority(it.priority) ? it.priority : "medium",
        status: isStatus(it.status) ? it.status : "new",
        due_date: isISODate(it.due_date) ? it.due_date : null,
        description: typeof it.description === "string" ? it.description : "",
      });
    }
    if (!adds.length) return { result: { error: "לא התקבלו משימות תקינות" } };
    const plan: PlannedWrite = { kind: "add", scope: ctx.scope, adds };
    if (adds.length > CONFIRM_THRESHOLD) {
      return { pending: await savePending(plan, ctx, adds.map((a) => a.title), `להוסיף ${adds.length} משימות חדשות?`, adds.length) };
    }
    const r = await runWrite(plan, ctx);
    return { result: { ok: true, added: r.count, titles: r.titles } };
  }

  if (name === "update_tasks") {
    const items = Array.isArray(args.updates) ? (args.updates as Record<string, unknown>[]) : [];
    const ids = items.map((u) => Number(u.id)).filter((n) => Number.isInteger(n));
    const existing = await listTasks({ ids, spaceIds: allowedIds });
    const byId = new Map(existing.map((t) => [t.id, t]));
    const updates: NonNullable<PlannedWrite["updates"]> = [];
    const missing: number[] = [];
    for (const u of items) {
      const id = Number(u.id);
      if (!byId.has(id)) { missing.push(id); continue; }
      const patch: TaskPatch = {};
      if (typeof u.title === "string" && u.title.trim()) patch.title = u.title.trim();
      if (typeof u.description === "string") patch.description = u.description;
      if (isPriority(u.priority)) patch.priority = u.priority;
      if (isStatus(u.status)) patch.status = u.status;
      if (u.due_date === "" || u.due_date === null) patch.due_date = null;
      else if (isISODate(u.due_date)) patch.due_date = u.due_date;
      if (typeof u.space_id === "number") {
        if (!ctx.allowed.has(u.space_id)) return { result: { error: "מרחב היעד מחוץ לטווח העבודה" } };
        patch.space_id = u.space_id;
      }
      if (Object.keys(patch).length) updates.push({ id, patch });
    }
    if (!updates.length) return { result: { error: "אין עדכונים תקינים", missing_ids: missing } };
    const plan: PlannedWrite = { kind: "update", scope: ctx.scope, updates };
    if (updates.length > CONFIRM_THRESHOLD) {
      const patches = [...new Set(updates.map((u) => describePatch(u.patch)))];
      const what = patches.length === 1 ? ` (${patches[0]})` : "";
      return {
        pending: await savePending(plan, ctx, updates.map((u) => byId.get(u.id)!.title), `לעדכן ${updates.length} משימות${what}?`, updates.length),
      };
    }
    const r = await runWrite(plan, ctx);
    return { result: { ok: true, updated: r.count, titles: r.titles, ...(missing.length ? { not_found_ids: missing } : {}) } };
  }

  if (name === "delete_tasks") {
    const ids = Array.isArray(args.ids) ? args.ids.map(Number).filter((n) => Number.isInteger(n)) : [];
    const existing = await listTasks({ ids, spaceIds: allowedIds });
    if (!existing.length) return { result: { error: "לא נמצאו משימות למחיקה בטווח הנוכחי" } };
    const plan: PlannedWrite = { kind: "delete", scope: ctx.scope, ids: existing.map((t) => t.id) };
    return {
      pending: await savePending(plan, ctx, existing.map((t) => t.title),
        existing.length === 1 ? "למחוק משימה אחת?" : `למחוק ${existing.length} משימות?`, existing.length),
    };
  }

  return { result: { error: `כלי לא מוכר: ${name}` } };
}

// ---------------------------------------------------------------- OpenAI
function systemPrompt(ctx: Ctx): string {
  const today = todayISO();
  const dow = HEB_DAYS[new Date(today + "T12:00:00Z").getUTCDay()];
  const scopeText =
    ctx.scope.type === "space"
      ? `המרחב "${ctx.spaces[0]?.name}" (id ${ctx.spaces[0]?.id}) בלבד`
      : "כל המרחבים";
  const spacesText = ctx.spaces.map((s) => `- ${s.name} (id ${s.id})`).join("\n");
  return `אתה סוכן AI בתוך מערכת לניהול משימות בעברית.
היום: יום ${dow}, ${today} (שעון ישראל). מחר: ${addDays(today, 1)}.
טווח העבודה הנוכחי: ${scopeText}. אסור לך לקרוא או לשנות משימות מחוץ לטווח הזה.
המרחבים בטווח:
${spacesText || "(אין מרחבים)"}

שדות משימה: כותרת, עדיפות (low=נמוכה, medium=בינונית, high=גבוהה, urgent=דחוף), סטטוס (new=חדשה, in_progress=בעבודה, on_hold=בהשהייה, done=הושלמה), תאריך יעד (YYYY-MM-DD).

כללים:
- השתמש בכלים. לפני עדכון או מחיקה, קרא את המשימות עם read_tasks כדי לקבל מזהים.
- המר תאריכים יחסיים ("מחר", "ביום חמישי", "עד ה-10") לתאריך מדויק. "עד ה-10" = היום ה-10 הקרוב (החודש אם עוד לא עבר, אחרת החודש הבא).
- כשמבקשים להוסיף כמה משימות, הוסף את כולן בקריאה אחת ל-add_tasks. אם לא נאמרה עדיפות, השתמש ב-medium.
- כשמבקשים "כל המשימות" בפעולה, הכוונה למשימות בטווח הנוכחי.
- המערכת מבקשת אישור מהמשתמש לבד לפני פעולה על יותר מ-${CONFIRM_THRESHOLD} משימות או לפני מחיקה. אל תשאל "האם לבצע?" בעצמך, פשוט קרא לכלי.
- ענה תמיד בעברית, קצר וענייני (משפט או שניים, או רשימה קצרה). אחרי פעולה, אמור בקצרה מה עשית.
- אל תציג מזהים מספריים למשתמש.`;
}

interface OAMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

async function callOpenAI(messages: OAMessage[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY לא מוגדר");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: modelName(), messages, tools: TOOLS, tool_choice: "auto" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  return data.choices[0].message as OAMessage;
}

export function modelName() {
  // The user asked for "openai/gpt-6-luna"; the OpenAI API itself takes the bare model id.
  return (process.env.OPENAI_MODEL || "gpt-6-luna").replace(/^openai\//, "");
}

export interface AgentResult {
  reply: string;
  changed: boolean;
  pending?: PendingAction;
}

export async function runAgent(history: ChatMessage[], scope: AgentScope): Promise<AgentResult> {
  const ctx = await buildCtx(scope);
  if (scope.type === "space" && !ctx.spaces.length) return { reply: "המרחב שנבחר לא קיים.", changed: false };

  const messages: OAMessage[] = [
    { role: "system", content: systemPrompt(ctx) },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content }) as OAMessage),
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const msg = await callOpenAI(messages);
    messages.push({ role: "assistant", content: msg.content ?? null, ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) });
    if (!msg.tool_calls?.length) {
      return { reply: (msg.content || "").trim() || "בוצע.", changed: ctx.changed };
    }
    for (let i = 0; i < msg.tool_calls.length; i++) {
      const call = msg.tool_calls[i];
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* keep empty */ }
      const out = await execTool(call.function.name, args, ctx);
      if ("pending" in out) {
        // Stop here: the user decides in the chat with approve / reject buttons.
        return { reply: out.pending.summary, changed: ctx.changed, pending: out.pending };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out.result) });
    }
  }
  return { reply: "לא הצלחתי להשלים את הבקשה. נסה לנסח אותה אחרת.", changed: ctx.changed };
}

export async function resolvePending(id: string, approve: boolean): Promise<AgentResult> {
  const sql = await db();
  const rows = await sql<{ payload: PlannedWrite }[]>`DELETE FROM pending_actions WHERE id = ${id} RETURNING payload`;
  if (!rows.length) return { reply: "הבקשה הזו כבר טופלה או פגה.", changed: false };
  if (!approve) return { reply: "בוטל. לא שיניתי כלום.", changed: false };
  const plan = rows[0].payload;
  const ctx = await buildCtx(plan.scope);
  const r = await runWrite(plan, ctx);
  const list = r.titles.slice(0, 5).map((t) => `• ${t}`).join("\n");
  const more = r.titles.length > 5 ? `\nועוד ${r.titles.length - 5}` : "";
  return { reply: `בוצע: ${r.summary}.${list ? "\n" + list + more : ""}`, changed: ctx.changed };
}
