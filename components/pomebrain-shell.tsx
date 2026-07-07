"use client";

import { useState } from "react";
import { AppSidebar, type AppView } from "@/components/app-sidebar";
import { BrainView } from "@/components/brain-view";
import { CrownConsole } from "@/components/crown-console";
import { PomegranateView } from "@/components/pomegranate-view";
import { Menu, X } from "lucide-react";

type PomebrainShellProps = {
  userEmail?: string;
  workspaceId?: string;
};

export function PomebrainShell({ userEmail = "Unknown user", workspaceId = "missing workspace_id" }: PomebrainShellProps) {
  const [activeView, setActiveView] = useState<AppView>("brain");
  const [mobileOpen, setMobileOpen] = useState(false);

  const changeView = (view: AppView) => {
    setActiveView(view);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-wrap${mobileOpen ? " sidebar-open" : ""}`}>
        <AppSidebar activeView={activeView} onViewChange={changeView} />
      </div>
      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <main className="main-stage">
        <header className="topbar">
          <button
            className="mobile-menu"
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="topbar-context">
            <span>{activeView === "crown" ? "BUILD SYSTEM" : "THE BRAIN"}</span>
            <strong>
              {activeView === "brain" ? "Pomegranate Graph" : activeView === "seeds" ? "Seed Library" : "Crown Console"}
            </strong>
          </div>
          <div className="system-status">
            <span className="status-dot" />
            <span>Brain online</span>
            <i />
            <span className="phase-pill">PHASE 0</span>
          </div>
        </header>

        {activeView === "brain" ? (
          <BrainView onOpenCrown={() => changeView("crown")} />
        ) : activeView === "seeds" ? (
          <PomegranateView />
        ) : (
          <CrownConsole onOpenBrain={() => changeView("brain")} userEmail={userEmail} workspaceId={workspaceId} />
        )}
      </main>
    </div>
  );
}
