"use client";

import Link from "next/link";
import { useEffect, type CSSProperties } from "react";
import { Icon } from "../ui";
import { PRIORITY_META, VIEW_META, type Space, type SpaceStats, type Task } from "@/lib/types";
import { formatDateHe, isOverdue } from "@/lib/dates";
import { fontVars } from "./fonts";
import type { DesignId } from "./versions";
import "./designs.css";

type PanelKey = "urgent" | "today" | "late";

export interface DashModel {
  dateLine: string;
  spaces: Space[];
  selected: number[];
  toggle: (id: number) => void;
  shownSpaces: Space[];
  totalOpen: number;
  panels: { key: PanelKey; title: string; tasks?: Task[]; empty: string }[];
  spaceOf: (id: number) => Space | undefined;
  statsOf: (id: number) => SpaceStats | undefined;
  openTask: (t: Task) => void;
  newSpace: () => void;
  openAgent: () => void;
}

// Per-design accent of each dashboard panel.
const TONE: Record<PanelKey, { paper: string; night: string; brutal: string; softBg: string; softInk: string; swiss: string }> = {
  urgent: { paper: "#a4161a", night: "#ff6b6b", brutal: "#ff5c8a", softBg: "#f6dcd5", softInk: "#a8483a", swiss: "#e30613" },
  today: { paper: "#1a1714", night: "#c6f432", brutal: "#5cc8ff", softBg: "#dbe6ee", softInk: "#3d6580", swiss: "#000" },
  late: { paper: "#1a1714", night: "#ffb547", brutal: "#ffb000", softBg: "#f4e2c9", softInk: "#966226", swiss: "#000" },
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function row(t: Task, m: DashModel) {
  const s = m.spaceOf(t.space_id);
  return {
    space: s?.name ?? "", color: s?.color ?? "#999",
    pr: PRIORITY_META[t.priority].label,
    due: formatDateHe(t.due_date),
    late: isOverdue(t.due_date, t.status),
  };
}

function spaceNums(s: Space, m: DashModel) {
  const st = m.statsOf(s.id);
  const open = st?.open ?? 0, closed = st?.closed_week ?? 0;
  return {
    open: st ? open : "–", overdue: st ? st.overdue : "–", closed: st ? closed : "–",
    late: !!st?.overdue,
    pct: `${open + closed ? Math.round((closed / (open + closed)) * 100) : 0}%`,
  };
}

export function DesignDashboard({ design, model }: { design: Exclude<DesignId, "orig">; model: DashModel }) {
  const D = { paper: Paper, night: Night, brutal: Brutal, soft: Soft, swiss: Swiss }[design];
  return <div className={fontVars}><D m={model} /></div>;
}

/* ---------- A · paper ---------- */
function Paper({ m }: { m: DashModel }) {
  return (
    <div className="dp">
      <div className="dp-wrap">
        <div className="dp-top">
          <span>{m.dateLine}</span>
          <span>גיליון אישי · {m.totalOpen} משימות פתוחות</span>
        </div>
        <h1 className="dp-mast">משימות</h1>
        <nav className="dp-nav">
          <Link href="/" className="on">דשבורד</Link>
          {m.spaces.map((s) => (
            <Link key={s.id} href={`/space/${s.id}`}><span className="dp-sq" style={{ background: s.color }} />{s.name}</Link>
          ))}
          <button className="dp-muted" onClick={m.newSpace}>+ מרחב חדש</button>
        </nav>

        <div className="dp-hello">
          <h2>שלום!</h2>
          <div className="dp-filter">
            <span className="dp-muted">במהדורה:</span>
            {m.spaces.map((s) => {
              const on = m.selected.includes(s.id);
              return (
                <button key={s.id} className={`dp-toggle ${on ? "on" : ""}`} onClick={() => m.toggle(s.id)}>
                  <span className="dp-check">✓</span>{s.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="dp-panels">
          {m.panels.map((p) => (
            <section key={p.key}>
              <header>
                <h3 style={{ color: TONE[p.key].paper }}>{p.title}</h3>
                <span>{pad2(p.tasks?.length ?? 0)}</span>
              </header>
              <div className="dp-rule" />
              {p.tasks && !p.tasks.length && <p className="dp-empty">{p.empty}</p>}
              {p.tasks?.map((t, i) => {
                const r = row(t, m);
                return (
                  <button key={t.id} className="dp-task" onClick={() => m.openTask(t)}>
                    <span className="dp-n">{pad2(i + 1)}</span>
                    <span>
                      <span className="dp-task-title">{t.title}</span>
                      <span className="dp-meta">
                        <b style={{ color: r.color }}>{r.space}</b> · {r.pr}
                        {r.due && <> · <span className={r.late ? "late" : ""}>{r.due}</span></>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>

        <div className="dp-spaces">
          <h2>המרחבים שלי</h2>
          <div className="dp-row dp-row-head"><span>מרחב</span><span>פתוחות</span><span>באיחור</span><span>נסגרו השבוע</span></div>
          {m.shownSpaces.map((s) => {
            const n = spaceNums(s, m);
            return (
              <Link key={s.id} href={`/space/${s.id}`} className="dp-row">
                <span className="dp-space-name"><span className="dp-sq lg" style={{ background: s.color }} />{s.name}<small>{VIEW_META[s.view].label}</small></span>
                <span>{n.open}</span>
                <span className={n.late ? "late" : ""}>{n.overdue}</span>
                <span>{n.closed}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <button className="dp-agent" onClick={m.openAgent}><Icon.sparkles size={18} strokeWidth={1.5} />שאל את הסוכן</button>
    </div>
  );
}

/* ---------- B · night ---------- */
function Night({ m }: { m: DashModel }) {
  const { openAgent } = m;
  // The command bar replaces the agent button, so ⌘K / Ctrl+K opens the agent.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openAgent(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAgent]);

  return (
    <div className="dn">
      <nav className="dn-rail">
        <span className="dn-logo"><Icon.check size={18} strokeWidth={2.5} /></span>
        <Link href="/" title="דשבורד" className="dn-rail-btn on"><Icon.home size={18} /></Link>
        <div className="dn-sep" />
        {m.spaces.map((s) => (
          <Link key={s.id} href={`/space/${s.id}`} title={s.name} className="dn-rail-btn dn-space" style={{ color: s.color }}>{s.name.slice(0, 1)}</Link>
        ))}
        <button title="מרחב חדש" aria-label="מרחב חדש" className="dn-rail-btn dn-new" onClick={m.newSpace}><Icon.plus size={16} /></button>
      </nav>
      <main className="dn-main">
        <div className="dn-top">
          <button className="dn-cmd" onClick={openAgent}>
            <Icon.sparkles size={16} style={{ color: "#c6f432" }} />
            <span className="dn-cmd-text">שאל את הסוכן… למשל ״מה דחוף לי השבוע?״</span>
            <span className="dn-kbd">⌘K</span>
          </button>
          <span className="dn-mono dn-date">{m.dateLine}</span>
        </div>

        <div className="dn-hello">
          <h1>שלום!</h1>
          <div className="dn-filter">
            {m.spaces.map((s) => {
              const on = m.selected.includes(s.id);
              const st: CSSProperties = on
                ? { background: s.color + "22", borderColor: s.color + "88", color: "#e6e8ee" }
                : { background: "transparent", borderColor: "#1d212b", color: "#6b7385" };
              return (
                <button key={s.id} className="dn-toggle" style={st} onClick={() => m.toggle(s.id)}>
                  <span className="dn-sq" style={{ background: on ? s.color : "#2a2f3b" }} />{s.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="dn-panels">
          {m.panels.map((p) => (
            <section key={p.key}>
              <header>
                <div className="dn-panel-title"><span className="dn-sq lg" style={{ background: TONE[p.key].night }} />{p.title}</div>
                <div className="dn-big" style={{ color: TONE[p.key].night }}>{pad2(p.tasks?.length ?? 0)}</div>
              </header>
              <div className="dn-list">
                {p.tasks && !p.tasks.length && <div className="dn-empty">{p.empty}</div>}
                {p.tasks?.map((t) => {
                  const r = row(t, m);
                  return (
                    <button key={t.id} className="dn-task" onClick={() => m.openTask(t)}>
                      <span className="dn-bar" style={{ background: r.color }} />
                      <span className="dn-task-main">
                        <span className="dn-task-title">{t.title}</span>
                        <span className="dn-task-meta">{r.space} · {r.pr}</span>
                      </span>
                      <span className={`dn-mono dn-due ${r.late ? "late" : ""}`}>{r.due}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <h2 className="dn-h2">המרחבים שלי</h2>
        <div className="dn-spaces">
          {m.shownSpaces.map((s) => {
            const n = spaceNums(s, m);
            return (
              <Link key={s.id} href={`/space/${s.id}`} className="dn-space-row">
                <span className="dn-space-name"><span className="dn-sq lg" style={{ background: s.color }} />{s.name}</span>
                <span className="dn-progress"><span style={{ width: n.pct, background: s.color }} /></span>
                <span className="dn-num"><b>{n.open}</b> <small>פתוחות</small></span>
                <span className={`dn-num ${n.late ? "late" : ""}`}><b>{n.overdue}</b> <small>באיחור</small></span>
                <span className="dn-num done"><b>{n.closed}</b> <small>נסגרו</small></span>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

/* ---------- C · brutal ---------- */
function Brutal({ m }: { m: DashModel }) {
  return (
    <div className="db">
      <nav className="db-side">
        <div className="db-logo">משימות!</div>
        <Link href="/" className="db-nav on">דשבורד</Link>
        <div className="db-label">מרחבים</div>
        {m.spaces.map((s) => (
          <Link key={s.id} href={`/space/${s.id}`} className="db-nav" style={{ background: s.color }}>
            {s.name}<span className="db-secular">{m.statsOf(s.id)?.open ?? ""}</span>
          </Link>
        ))}
        <button className="db-nav-new" onClick={m.newSpace}>+ מרחב חדש</button>
      </nav>
      <main className="db-main">
        <header className="db-head">
          <div>
            <h1>שלום!</h1>
            <p className="db-date">{m.dateLine}</p>
          </div>
          <div className="db-filter">
            {m.spaces.map((s) => {
              const on = m.selected.includes(s.id);
              return (
                <button key={s.id} className={`db-toggle ${on ? "on" : ""}`} style={on ? { background: s.color } : undefined}
                  onClick={() => m.toggle(s.id)}>{s.name}</button>
              );
            })}
          </div>
        </header>

        <div className="db-panels">
          {m.panels.map((p) => (
            <section key={p.key}>
              <header style={{ background: TONE[p.key].brutal }}>
                <h3>{p.title}</h3>
                <span className="db-count">{p.tasks?.length ?? 0}</span>
              </header>
              <div className="db-list">
                {p.tasks && !p.tasks.length && <div className="db-empty">{p.empty}</div>}
                {p.tasks?.map((t) => {
                  const r = row(t, m);
                  return (
                    <button key={t.id} className="db-task" onClick={() => m.openTask(t)}>
                      <span className="db-task-title">{t.title}</span>
                      <span className="db-tags">
                        <span style={{ background: r.color }}>{r.space}</span>
                        <span>{r.pr}</span>
                        {r.due && <span className={r.late ? "late" : ""}>{r.due}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <h2 className="db-h2">המרחבים שלי</h2>
        <div className="db-cards">
          {m.shownSpaces.map((s) => {
            const n = spaceNums(s, m);
            return (
              <Link key={s.id} href={`/space/${s.id}`} className="db-card" style={{ background: s.color }}>
                <div className="db-card-head"><strong>{s.name}</strong><span>{VIEW_META[s.view].label}</span></div>
                <div className="db-stats">
                  <div><b>{n.open}</b><span>פתוחות</span></div>
                  <div><b className={n.late ? "late" : ""}>{n.overdue}</b><span>באיחור</span></div>
                  <div><b>{n.closed}</b><span>נסגרו השבוע</span></div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <button className="db-agent" onClick={m.openAgent}>שאל את הסוכן ✦</button>
    </div>
  );
}

/* ---------- D · soft ---------- */
function Soft({ m }: { m: DashModel }) {
  return (
    <div className="ds">
      <div className="ds-wrap">
        <header className="ds-head">
          <div>
            <p className="ds-date">{m.dateLine}</p>
            <h1>שלום! 👋</h1>
          </div>
          <div className="ds-filter">
            {m.spaces.map((s) => (
              <button key={s.id} className={`ds-toggle ${m.selected.includes(s.id) ? "on" : ""}`} onClick={() => m.toggle(s.id)}>{s.name}</button>
            ))}
          </div>
        </header>

        <div className="ds-panels">
          {m.panels.map((p) => (
            <section key={p.key} style={{ background: TONE[p.key].softBg }}>
              <header style={{ color: TONE[p.key].softInk }}>
                <span className="ds-big">{p.tasks?.length ?? 0}</span>
                <h3>{p.title}</h3>
              </header>
              <div className="ds-list">
                {p.tasks && !p.tasks.length && <div className="ds-empty">{p.empty}</div>}
                {p.tasks?.map((t) => {
                  const r = row(t, m);
                  return (
                    <button key={t.id} className="ds-task" onClick={() => m.openTask(t)}>
                      <span className="ds-ring" style={{ borderColor: r.color }} />
                      <span className="ds-task-main">
                        <span className="ds-task-title">{t.title}</span>
                        <span className="ds-task-meta">{r.space}{r.due && ` · ${r.due}`}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <h2 className="ds-h2">המרחבים שלי</h2>
        <div className="ds-cards">
          {m.shownSpaces.map((s) => {
            const n = spaceNums(s, m);
            return (
              <Link key={s.id} href={`/space/${s.id}`} className="ds-card">
                <div className="ds-card-head">
                  <span className="ds-avatar" style={{ background: s.color + "26", color: s.color }}>{s.name.slice(0, 1)}</span>
                  <span><strong>{s.name}</strong><small>{VIEW_META[s.view].label}</small></span>
                </div>
                <div className="ds-progress"><span style={{ width: n.pct, background: s.color }} /></div>
                <div className="ds-stats">
                  <span><b>{n.open}</b> פתוחות</span>
                  <span><b className={n.late ? "late" : ""}>{n.overdue}</b> באיחור</span>
                  <span><b>{n.closed}</b> נסגרו השבוע</span>
                </div>
              </Link>
            );
          })}
          <button className="ds-card-new" onClick={m.newSpace}>+ מרחב חדש</button>
        </div>
      </div>

      <nav className="ds-dock">
        <Link href="/" className="ds-dock-item on">דשבורד</Link>
        {m.spaces.map((s) => (
          <Link key={s.id} href={`/space/${s.id}`} title={s.name} className="ds-dock-item">
            <span className="ds-dot" style={{ background: s.color }} /><span className="ds-dock-label">{s.name}</span>
          </Link>
        ))}
        <button className="ds-dock-item ds-dock-agent" onClick={m.openAgent}>✦ שאל את הסוכן</button>
      </nav>
    </div>
  );
}

/* ---------- E · swiss ---------- */
function Swiss({ m }: { m: DashModel }) {
  return (
    <div className="dw">
      <header className="dw-head">
        <span className="dw-brand">משימות<span className="red">.</span></span>
        <nav className="dw-nav">
          <Link href="/" className="on">דשבורד</Link>
          {m.spaces.map((s) => <Link key={s.id} href={`/space/${s.id}`}>{s.name}</Link>)}
          <button className="dw-muted" onClick={m.newSpace}>+ מרחב</button>
        </nav>
        <span className="dw-date">{m.dateLine}</span>
      </header>

      <main className="dw-main">
        <div className="dw-grid dw-hello">
          <h1>שלום!</h1>
          <div className="dw-filter">
            {m.spaces.map((s) => (
              <button key={s.id} className={`dw-toggle ${m.selected.includes(s.id) ? "on" : ""}`} onClick={() => m.toggle(s.id)}>
                <span className="dw-box" />{s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="dw-panels">
          {m.panels.map((p) => (
            <section key={p.key} style={{ borderTopColor: TONE[p.key].swiss }}>
              <div className="dw-panel-head">
                <h3>{p.title}</h3>
                <span className="dw-big" style={{ color: TONE[p.key].swiss }}>{pad2(p.tasks?.length ?? 0)}</span>
              </div>
              <div className="dw-list">
                {p.tasks && !p.tasks.length && <p className="dw-empty">{p.empty}</p>}
                {p.tasks?.map((t) => {
                  const r = row(t, m);
                  return (
                    <button key={t.id} className="dw-task" onClick={() => m.openTask(t)}>
                      <span><span className="dw-task-title">{t.title}</span><span className="dw-task-meta">{r.space} / {r.pr}</span></span>
                      <span className={`dw-due ${r.late ? "late" : ""}`}>{r.due}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="dw-grid dw-spaces">
          <h2>המרחבים שלי</h2>
          {m.shownSpaces.map((s) => {
            const n = spaceNums(s, m);
            return (
              <Link key={s.id} href={`/space/${s.id}`} className="dw-space">
                <div className="dw-space-name"><span style={{ background: s.color }} />{s.name}</div>
                <div className="dw-stats">
                  <div><b>{n.open}</b><span>פתוחות</span></div>
                  <div><b className={n.late ? "late" : ""}>{n.overdue}</b><span>באיחור</span></div>
                  <div><b>{n.closed}</b><span>נסגרו השבוע</span></div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <button className="dw-agent" onClick={m.openAgent}>שאל את הסוכן ←</button>
    </div>
  );
}
