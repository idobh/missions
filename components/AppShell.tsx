"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DataProvider, useStore } from "./store";
import { Icon, ViewIcon } from "./ui";
import { TaskModal } from "./TaskModal";
import { SpaceModal } from "./SpaceModal";
import { ChatWidget } from "./ChatWidget";
import { AbBar } from "./ab/AbBar";

export function AppShell({ children, authEnabled }: { children: ReactNode; authEnabled: boolean }) {
  return (
    <DataProvider>
      <Shell authEnabled={authEnabled}>{children}</Shell>
    </DataProvider>
  );
}

function Shell({ children, authEnabled }: { children: ReactNode; authEnabled: boolean }) {
  const { spaces, setSpaceModal, toastMsg, design } = useStore();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  // The dashboard carries the A/B bar. Every design except the original brings its own navigation.
  const onDashboard = pathname === "/";
  if (onDashboard && design !== "orig") {
    return (
      <>
        <AbBar />
        {children}
        <TaskModal />
        <SpaceModal />
        <ChatWidget showFab={false} />
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </>
    );
  }

  return (
    <>
      {onDashboard && <AbBar />}
      <div className={`shell ${onDashboard ? "with-ab" : ""}`}>
        <header className="mobile-bar">
          <button className="icon-btn" onClick={() => setNavOpen(true)} aria-label="תפריט"><Icon.menu /></button>
          <span className="brand-name">משימות</span>
        </header>
  
        <nav className={`sidebar ${navOpen ? "open" : ""}`}>
          <div className="brand">
            <span className="brand-logo"><Icon.check size={18} /></span>
            <span className="brand-name">משימות</span>
          </div>
  
          <Link href="/" className={`nav-item ${pathname === "/" ? "active" : ""}`}>
            <Icon.home size={18} /> דשבורד
          </Link>
  
          <div className="nav-section">
            <span>מרחבים</span>
            <button className="icon-btn sm" onClick={() => setSpaceModal({ mode: "create" })} aria-label="מרחב חדש" title="מרחב חדש">
              <Icon.plus size={16} />
            </button>
          </div>
          <div className="nav-spaces">
            {spaces.map((s) => {
              const active = pathname === `/space/${s.id}`;
              return (
                <Link key={s.id} href={`/space/${s.id}`} className={`nav-item ${active ? "active" : ""}`}
                  style={active ? { background: s.color + "16", color: s.color } : undefined}>
                  <span className="nav-color" style={{ background: s.color }} />
                  <span className="nav-label">{s.name}</span>
                  <span className="nav-view"><ViewIcon view={s.view} size={14} /></span>
                </Link>
              );
            })}
            <button className="nav-item nav-new" onClick={() => setSpaceModal({ mode: "create" })}>
              <Icon.plus size={16} /> מרחב חדש
            </button>
          </div>
  
          <div className="sidebar-foot">
            {authEnabled && <button className="nav-item" onClick={logout}><Icon.logout size={16} /> יציאה</button>}
          </div>
        </nav>
        {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
  
        <main className="main">{children}</main>
  
        <TaskModal />
        <SpaceModal />
        <ChatWidget />
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </>
  );
}
