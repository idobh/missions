"use client";

import { useEffect, useRef, useState } from "react";
import { api, useStore } from "./store";
import { Icon } from "./ui";
import type { AgentScope, PendingAction } from "@/lib/types";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  scopeLabel?: string;
  error?: boolean;
  pending?: PendingAction & { state: "open" | "approved" | "rejected" | "busy" };
}

interface AgentResponse {
  reply: string;
  changed: boolean;
  pending?: PendingAction;
  error?: boolean;
}

const STORAGE_KEY = "missions_chat_v1";
const YES = /^(כן|כן\.|כן!|מאשר|אשר|יאללה|בטח|yes|y|ok|אוקיי)$/i;
const NO = /^(לא|לא\.|לא מאשר|בטל|ביטול|no|n)$/i;

const SUGGESTIONS = [
  "מה המשימות הכי חשובות שצריך לתת להן עדיפות?",
  "תסכם לי את המצב",
  "מה באיחור?",
  "תדחה את כל מה שבאיחור למחר",
];

const uid = () => Math.random().toString(36).slice(2, 10);

/** `showFab` is off when the page draws its own agent button (the A/B dashboard designs). */
export function ChatWidget({ showFab = true }: { showFab?: boolean }) {
  const { spaces, scope, setScope, bump, chatOpen: open, setChatOpen: setOpen } = useStore();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scopeMenu, setScopeMenu] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60))); } catch { /* ignore */ }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setScopeMenu(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const scopeSpace = scope.type === "space" ? spaces.find((s) => s.id === scope.spaceId) : undefined;
  const scopeLabel = scopeSpace ? scopeSpace.name : "כל המרחבים";
  const openPending = [...messages].reverse().find((m) => m.pending?.state === "open");

  function autoGrow() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
    el.style.overflowY = el.scrollHeight > 140 ? "auto" : "hidden";
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    requestAnimationFrame(autoGrow);

    // A typed "yes"/"no" answers an open confirmation, just like the buttons.
    if (openPending && (YES.test(content) || NO.test(content))) {
      setMessages((ms) => [...ms, { id: uid(), role: "user", content }]);
      return resolve(openPending.id, YES.test(content));
    }

    const userMsg: UIMessage = { id: uid(), role: "user", content, scopeLabel };
    const next = [...messages.map((m) => (m.pending?.state === "open" ? { ...m, pending: { ...m.pending, state: "rejected" as const } } : m)), userMsg];
    setMessages(next);
    setBusy(true);
    try {
      const res = await api<AgentResponse>("/api/agent", {
        method: "POST",
        json: {
          scope: scope as AgentScope,
          messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setMessages((ms) => [...ms, {
        id: uid(), role: "assistant", content: res.reply, error: res.error,
        pending: res.pending ? { ...res.pending, state: "open" } : undefined,
      }]);
      if (res.changed) bump();
    } catch (e) {
      setMessages((ms) => [...ms, { id: uid(), role: "assistant", content: e instanceof Error ? e.message : "שגיאה", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function resolve(msgId: string, approve: boolean) {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg?.pending || msg.pending.state !== "open") return;
    const setState = (state: NonNullable<UIMessage["pending"]>["state"]) =>
      setMessages((ms) => ms.map((m) => (m.id === msgId && m.pending ? { ...m, pending: { ...m.pending, state } } : m)));
    setState("busy");
    setBusy(true);
    try {
      const res = await api<AgentResponse>("/api/agent/confirm", { method: "POST", json: { id: msg.pending.id, approve } });
      setState(approve ? "approved" : "rejected");
      setMessages((ms) => [...ms, { id: uid(), role: "assistant", content: res.reply }]);
      if (res.changed) bump();
    } catch (e) {
      setState("open");
      setMessages((ms) => [...ms, { id: uid(), role: "assistant", content: e instanceof Error ? e.message : "שגיאה", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function pickScope(s: AgentScope) {
    setScope(s);
    setScopeMenu(false);
  }

  return (
    <>
      {showFab && (
        <button className={`fab ${open ? "fab-hidden" : ""}`} onClick={() => setOpen(true)} aria-label="פתיחת צ'אט עם סוכן ה-AI">
          <span className="fab-icon"><Icon.sparkles size={22} /></span>
          <span className="fab-text">שאל את הסוכן</span>
          <span className="fab-ping" />
        </button>
      )}

      <aside className={`chat ${open ? "chat-open" : ""}`} aria-hidden={!open} aria-label="צ'אט עם סוכן AI">
        <header className="chat-head">
          <div className="chat-avatar"><Icon.sparkles size={20} /></div>
          <div className="chat-head-text">
            <strong>סוכן המשימות</strong>
            <span><i className="online" /> מחובר · GPT-6 Luna</span>
          </div>
          <button className="icon-btn on-dark" title="שיחה חדשה" aria-label="שיחה חדשה" onClick={() => setMessages([])}>
            <Icon.refresh size={17} />
          </button>
          <button className="icon-btn on-dark" aria-label="סגירה" onClick={() => setOpen(false)}><Icon.close size={18} /></button>
        </header>

        <div className="chat-scope">
          <span className="chat-scope-label">עובד על:</span>
          <div className="scope-picker">
            <button className="scope-btn" onClick={() => setScopeMenu((v) => !v)} aria-expanded={scopeMenu}>
              <span className="dot" style={{ background: scopeSpace?.color ?? "conic-gradient(#6366f1,#22c55e,#f97316,#ec4899,#6366f1)" }} />
              {scopeLabel}
              <Icon.chevronDown size={15} />
            </button>
            {scopeMenu && (
              <div className="scope-menu" role="menu">
                <button role="menuitem" className={scope.type === "all" ? "on" : ""} onClick={() => pickScope({ type: "all" })}>
                  <span className="dot dot-all" /> כל המרחבים
                  {scope.type === "all" && <Icon.check size={15} />}
                </button>
                {spaces.map((s) => {
                  const on = scope.type === "space" && scope.spaceId === s.id;
                  return (
                    <button key={s.id} role="menuitem" className={on ? "on" : ""} onClick={() => pickScope({ type: "space", spaceId: s.id })}>
                      <span className="dot" style={{ background: s.color }} /> {s.name}
                      {on && <Icon.check size={15} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="chat-list" ref={listRef} onClick={() => setScopeMenu(false)}>
          {!messages.length && (
            <div className="chat-welcome">
              <div className="chat-welcome-icon"><Icon.sparkles size={28} /></div>
              <h3>היי, איך אפשר לעזור?</h3>
              <p>אני יכול לקרוא, להוסיף, לעדכן, למחוק ולסכם משימות ב<b>{scopeLabel}</b>.</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg msg-${m.role} ${m.error ? "msg-error" : ""}`}>
              {m.role === "assistant" && <div className="msg-avatar"><Icon.sparkles size={14} /></div>}
              <div className="msg-col">
                <div className="bubble">{m.content}</div>
                {m.pending && (
                  <div className={`confirm confirm-${m.pending.kind}`}>
                    <div className="confirm-head">
                      <Icon.alert size={16} />
                      {m.pending.kind === "delete" ? "מחיקה" : "שינוי"} של {m.pending.count} {m.pending.count === 1 ? "משימה" : "משימות"}
                    </div>
                    <ul className="confirm-list">
                      {m.pending.preview.slice(0, 6).map((t, i) => <li key={i}>{t}</li>)}
                      {m.pending.preview.length > 6 && <li className="more">ועוד {m.pending.preview.length - 6}…</li>}
                    </ul>
                    {m.pending.state === "open" || m.pending.state === "busy" ? (
                      <div className="confirm-actions">
                        <button className="btn btn-confirm" disabled={m.pending.state === "busy"} onClick={() => resolve(m.id, true)}>
                          <Icon.check size={16} /> מאשר
                        </button>
                        <button className="btn btn-secondary" disabled={m.pending.state === "busy"} onClick={() => resolve(m.id, false)}>
                          לא מאשר
                        </button>
                      </div>
                    ) : (
                      <div className={`confirm-state ${m.pending.state}`}>
                        {m.pending.state === "approved" ? "✓ אושר" : "✕ לא אושר"}
                      </div>
                    )}
                  </div>
                )}
                {m.role === "user" && m.scopeLabel && <span className="msg-scope">{m.scopeLabel}</span>}
              </div>
            </div>
          ))}
          {busy && (
            <div className="msg msg-assistant">
              <div className="msg-avatar"><Icon.sparkles size={14} /></div>
              <div className="bubble typing"><i /><i /><i /></div>
            </div>
          )}
        </div>

        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder={openPending ? "כתוב כן או לא, או לחץ על הכפתור" : `כתוב לסוכן (${scopeLabel})...`}
            onChange={(e) => { setInput(e.target.value); autoGrow(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); }
            }}
          />
          <button type="submit" className="send" disabled={!input.trim() || busy} aria-label="שליחה">
            <Icon.send size={18} />
          </button>
        </form>
      </aside>
    </>
  );
}
