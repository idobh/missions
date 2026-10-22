"use client";

import { useEffect } from "react";
import { useStore } from "../store";
import { VERSIONS } from "./versions";

/** Top bar for comparing the dashboard designs: tabs, a "liked it" vote, and keys 0/A–E and arrows. */
export function AbBar() {
  const { design, setDesign, votes, toggleVote, editing, spaceModal, chatOpen } = useStore();
  const busy = !!editing || !!spaceModal || chatOpen;

  function step(d: number) {
    const i = VERSIONS.findIndex((x) => x.id === design);
    setDesign(VERSIONS[(i + d + VERSIONS.length) % VERSIONS.length].id);
  }

  useEffect(() => {
    if (busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable)) return;
      const i = "0abcde".indexOf(e.key.toLowerCase());
      if (i >= 0) setDesign(VERSIONS[i].id);
      // RTL: left goes forward
      if (e.key === "ArrowLeft") step(1);
      if (e.key === "ArrowRight") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const voted = !!votes[design];
  return (
    <div className="ab-bar">
      <span className="ab-title">A/B · גרסאות עיצוב</span>
      {VERSIONS.map((v) => (
        <button key={v.id} className={`ab-tab ${v.id === design ? "on" : ""}`} onClick={() => setDesign(v.id)}>
          <span className="ab-key">{v.key}</span>
          <span>{v.label}</span>
          {votes[v.id] && <span className="ab-heart">♥</span>}
        </button>
      ))}
      <span className="spacer" />
      <button className={`ab-vote ${voted ? "on" : ""}`} onClick={() => toggleVote(design)}>
        {voted ? "♥ אהבתי" : "♡ אהבתי את הגרסה הזו"}
      </button>
      <button className="ab-next" onClick={() => step(1)}>הבאה ←</button>
    </div>
  );
}
