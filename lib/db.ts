import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __schemaReady: Promise<void> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    ssl: local ? false : "require",
    max: local ? 1 : 5,
    idle_timeout: 20,
    prepare: false, // safe with pooled (pgbouncer) connections
    onnotice: () => {},
    types: {
      // keep DATE columns as plain YYYY-MM-DD strings
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  });
}

export function getSql() {
  if (!globalThis.__sql) globalThis.__sql = createClient();
  return globalThis.__sql;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS spaces (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  view TEXT NOT NULL DEFAULT 'kanban' CHECK (view IN ('kanban','todo','calendar')),
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  space_id INT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','on_hold','done')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_space_idx ON tasks(space_id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_actions (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function db() {
  const sql = getSql();
  if (!globalThis.__schemaReady) {
    globalThis.__schemaReady = sql.unsafe(SCHEMA).simple().then(() => undefined).catch((e) => {
      globalThis.__schemaReady = undefined;
      throw e;
    });
  }
  await globalThis.__schemaReady;
  return sql;
}
