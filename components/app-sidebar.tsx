import { Brain, Crown, Database, PlugZap, Settings2, Sprout } from "lucide-react";
import { PomegranateMark } from "@/components/pomegranate-mark";

export type AppView = "brain" | "crown" | "seeds" | "agents" | "connectors";

type AppSidebarProps = {
  activeView: AppView;
  isAdmin?: boolean;
  onViewChange: (view: AppView) => void;
};

export function AppSidebar({ activeView, isAdmin = false, onViewChange }: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="brand-lockup">
        <PomegranateMark compact />
        <div>
          <strong>POMEBRAIN</strong>
          <span>Living build system</span>
        </div>
      </div>

      <nav className="primary-nav" aria-label="Main navigation">
        <span className="nav-kicker">CORE MODES</span>
        {isAdmin ? (
          <button
            className={activeView === "brain" ? "active" : ""}
            onClick={() => onViewChange("brain")}
            type="button"
          >
            <Brain size={18} />
            <span>
              Brain View
              <small>Admin graph</small>
            </span>
          </button>
        ) : null}
        <button
          className={activeView === "crown" ? "active" : ""}
          onClick={() => onViewChange("crown")}
          type="button"
        >
          <Crown size={18} />
          <span>
            Crown Console
            <small>Give the agents a goal</small>
          </span>
        </button>

        {isAdmin ? (
          <>
            <span className="nav-kicker nav-kicker-space">ADMIN BRAIN</span>
            <button
              className={activeView === "seeds" ? "active" : ""}
              onClick={() => onViewChange("seeds")}
              type="button"
            >
              <Sprout size={18} />
              <span>
                Seed Library
                <small>Private seed graph</small>
              </span>
            </button>
            <button
              className={activeView === "agents" ? "active" : ""}
              onClick={() => onViewChange("agents")}
              type="button"
            >
              <Database size={18} />
              <span>
                Agent Foundry
                <small>Private manifests</small>
              </span>
            </button>
          </>
        ) : null}
        <button
          className={activeView === "connectors" ? "active" : ""}
          onClick={() => onViewChange("connectors")}
          type="button"
        >
          <PlugZap size={18} />
          <span>
            Connectors
            <small>MCP capability control</small>
          </span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="workspace-card">
          <span className="workspace-avatar">P</span>
          <div>
            <strong>{isAdmin ? "Pomebrain Control" : "Your workspace"}</strong>
            <span>{isAdmin ? "Master admin" : "Customer account"}</span>
          </div>
          <Settings2 size={16} />
        </div>
      </div>
    </aside>
  );
}
