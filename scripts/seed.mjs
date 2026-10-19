// Seeds three demo spaces with ~15 tasks each. Dates are relative to today (Israel time).
// Usage: node scripts/seed.mjs          -> seeds only if there are no spaces yet
//        node scripts/seed.mjs --force  -> wipes all spaces/tasks and reseeds
import postgres from "postgres";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const local = /localhost|127\.0\.0\.1/.test(url);
const sql = postgres(url, { ssl: local ? false : "require", prepare: false, max: 1, onnotice: () => {} });

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const d = (n) => {
  const [y, m, dd] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};

// [title, priority, status, dueOffset|null, description?]
const SPACES = [
  {
    name: "בית", color: "#f97316", view: "todo",
    tasks: [
      ["לשלם ארנונה", "urgent", "new", -2, "דרך האתר של העירייה"],
      ["להזמין טכנאי למזגן", "high", "new", -1],
      ["לקנות מתנה ליום הולדת של אמא", "high", "in_progress", 3],
      ["קניות לשבת", "medium", "new", 0, "חלב, ביצים, לחם, ירקות, יין"],
      ["להתקשר לסבתא", "medium", "new", 0],
      ["לתקן את הברז במטבח", "medium", "on_hold", 5, "מחכה לחלק מהחנות"],
      ["לחדש ביטוח רכב", "urgent", "new", 2],
      ["לסדר את המחסן", "low", "new", 12],
      ["להחליף נורה במרפסת", "low", "new", null],
      ["לקבוע תור לרופא שיניים", "medium", "new", 7],
      ["להשקות את העציצים", "low", "done", -1],
      ["לשלם חשבון חשמל", "high", "done", -3],
      ["לאסוף כביסה מהמכבסה", "medium", "done", 0],
      ["לתכנן חופשה משפחתית", "low", "new", 25],
      ["לבדוק לחץ אוויר בצמיגים", "medium", "new", -4],
    ],
  },
  {
    name: "עבודה", color: "#6366f1", view: "kanban",
    tasks: [
      ["להכין מצגת לישיבת הנהלה", "urgent", "in_progress", 1, "כולל נתוני רבעון אחרון"],
      ["לשלוח הצעת מחיר ללקוח החדש", "urgent", "new", 0],
      ["לעדכן את דוח המכירות החודשי", "high", "new", -3],
      ["פגישת סטטוס עם הצוות", "medium", "new", 2],
      ["לבדוק חוזה ספק", "high", "on_hold", 4, "מחכה להערות מהיועץ המשפטי"],
      ["לגייס מפתח/ת פרונטאנד", "high", "in_progress", 14],
      ["לסגור תקציב לרבעון הבא", "urgent", "new", 6],
      ["לענות למיילים מהלקוחות", "medium", "in_progress", 0],
      ["להכין סיכום פגישה עם השותפים", "medium", "done", -2],
      ["לעדכן את אתר החברה", "low", "new", 20],
      ["הדרכה לעובד חדש", "medium", "done", -1],
      ["לתאם כנס לקוחות", "high", "new", 10],
      ["להגיש דוח הוצאות", "medium", "new", -5],
      ["סקירת קוד לפרויקט החדש", "low", "on_hold", null],
      ["לשלוח חשבונית ללקוח", "high", "done", 0],
    ],
  },
  {
    name: "לימודים", color: "#14b8a6", view: "calendar",
    tasks: [
      ["להגיש עבודה בסטטיסטיקה", "urgent", "in_progress", 2],
      ["לקרוא פרק 5 בכלכלה", "medium", "new", 1],
      ["מבחן אמצע בחשבונאות", "urgent", "new", 9, "חומר: פרקים 1-6"],
      ["להכין סיכום להרצאה", "medium", "new", 0],
      ["פגישה עם המנחה", "high", "new", 4],
      ["לפתור דף תרגילים 3", "high", "new", -1],
      ["להירשם לקורסי הסמסטר הבא", "urgent", "new", 13],
      ["לצפות בהרצאה המוקלטת", "low", "done", -2],
      ["להכין מצגת לסמינר", "high", "in_progress", 16],
      ["לעבוד על הפרויקט הקבוצתי", "medium", "on_hold", 7, "מחכים לחלק של דנה"],
      ["לחזור על חומר לבוחן", "medium", "new", 5],
      ["לשלם שכר לימוד", "high", "new", -2],
      ["להחזיר ספרים לספרייה", "low", "new", 3],
      ["לכתוב מבוא לעבודה הסמינריונית", "medium", "new", 21],
      ["להגיש תרגיל 2", "medium", "done", -4],
    ],
  },
];

async function main() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS spaces (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#6366f1',
      view TEXT NOT NULL DEFAULT 'kanban' CHECK (view IN ('kanban','todo','calendar')),
      position INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY, space_id INT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','on_hold','done')),
      due_date DATE, completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS tasks_space_idx ON tasks(space_id);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS pending_actions (id TEXT PRIMARY KEY, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
  `).simple();

  const force = process.argv.includes("--force");
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM spaces`;
  if (n > 0 && !force) {
    console.log(`Already has ${n} spaces, skipping (use --force to reset).`);
    return;
  }
  await sql`TRUNCATE tasks, spaces, settings, pending_actions RESTART IDENTITY CASCADE`;

  let total = 0;
  for (const [i, s] of SPACES.entries()) {
    const [{ id }] = await sql`INSERT INTO spaces (name, color, view, position) VALUES (${s.name}, ${s.color}, ${s.view}, ${i}) RETURNING id`;
    for (const [title, priority, status, off, description = ""] of s.tasks) {
      const due = off === null ? null : d(off);
      // completed tasks: mark them closed today or a day ago so "נסגרו השבוע" has numbers
      const completed = status === "done" ? new Date(Date.now() - Math.max(0, -Math.min(off ?? 0, 0)) * 3600_000) : null;
      await sql`INSERT INTO tasks (space_id, title, description, priority, status, due_date, completed_at)
        VALUES (${id}, ${title}, ${description}, ${priority}, ${status}, ${due}, ${completed})`;
      total++;
    }
  }
  console.log(`Seeded ${SPACES.length} spaces and ${total} tasks.`);
}

main().then(() => sql.end()).catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
