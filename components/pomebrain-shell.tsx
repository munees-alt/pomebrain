"use client";

import { useState } from "react";
import { AgentFoundryView } from "@/components/agent-foundry-view";
import { AppSidebar, type AppView } from "@/components/app-sidebar";
import { BrainView } from "@/components/brain-view";
import { ConnectorsView } from "@/components/connectors-view";
import { CrownConsole } from "@/components/crown-console";
import { PomegranateView } from "@/components/pomegranate-view";
import { LogOut, Menu, X } from "lucide-react";

type PomebrainShellProps = {
  userEmail?: string;
  isAdmin?: boolean;
};

const adminViews: AppView[] = ["brain", "seeds", "agents"];

function initialView(isAdmin: boolean): AppView {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connector") || params.get("connector_status") || params.get("connector_error")) {
      return "connectors";
    }
  }

  return isAdmin ? "brain" : "crown";
}

function isAdminView(view: AppView) {
  return adminViews.includes(view);
}

export function PomebrainShell({ userEmail = "Unknown user", isAdmin = false }: PomebrainShellProps) {
  const [activeView, setActiveView] = useState<AppView>(() => {
    return initialView(isAdmin);
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const safeActiveView = !isAdmin && isAdminView(activeView) ? "crown" : activeView;

  const changeView = (view: AppView) => {
    setActiveView(!isAdmin && isAdminView(view) ? "crown" : view);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-wrap${mobileOpen ? " sidebar-open" : ""}`}>
        <AppSidebar activeView={safeActiveView} isAdmin={isAdmin} onViewChange={changeView} />
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
            <span>{safeActiveView === "crown" ? "BUILD SYSTEM" : safeActiveView === "connectors" ? "MCP LAYER" : "THE BRAIN"}</span>
            <strong>
              {safeActiveView === "brain"
                ? "Pomegranate Graph"
                : safeActiveView === "seeds"
                  ? "Seed Library"
                  : safeActiveView === "agents"
                    ? "Agent Foundry"
                    : safeActiveView === "connectors"
                      ? "Connectors"
                      : "Crown Console"}
            </strong>
          </div>
          <div className="system-status">
            <span className="status-dot" />
            <span>Pomebrain online</span>
            <i />
            <span className="phase-pill">LIVE</span>
            <form action="/auth/signout" method="post">
              <button className="topbar-signout" type="submit" aria-label={`Sign out ${userEmail}`}>
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </form>
          </div>
        </header>

        {safeActiveView === "brain" && isAdmin ? (
          <BrainView onOpenCrown={() => changeView("crown")} />
        ) : safeActiveView === "seeds" && isAdmin ? (
          <PomegranateView />
        ) : safeActiveView === "agents" && isAdmin ? (
          <AgentFoundryView />
        ) : safeActiveView === "connectors" ? (
          <ConnectorsView />
        ) : (
          <CrownConsole
            canOpenBrain={isAdmin}
            onOpenBrain={() => changeView("brain")}
          />
        )}
      </main>
    </div>
  );
}
