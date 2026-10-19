"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error || "שגיאה בכניסה");
    setBusy(false);
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1>ברוכים הבאים</h1>
        <p>הזן סיסמה כדי להיכנס למערכת המשימות</p>
        <input className="input" type="password" autoFocus placeholder="סיסמה" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="login-error">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy || !password}>{busy ? "נכנס..." : "כניסה"}</button>
      </form>
    </div>
  );
}
