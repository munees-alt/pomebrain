import { Brain, Crown, Database, PlugZap, Settings2, Sprout } from "lucide-react";
import { PomegranateMark } from "@/components/pomegranate-mark";

export type AppView = "brain" | "crown" | "seeds";

type AppSidebarProps = {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
};

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
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
        <button
          className={activeView === "brain" ? "active" : ""}
          onClick={() => onViewChange("brain")}
          type="button"
        >
          <Brain size={18} />
          <span>
            Brain View
            <small>See the living graph</small>
          </span>
        </button>
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

        <span className="nav-kicker nav-kicker-space">THE BRAIN</span>
        <button
          className={activeView === "seeds" ? "active" : ""}
          onClick={() => onViewChange("seeds")}
          type="button"
        >
          <Sprout size={18} />
          <span>
            Seed Library
            <small>Every agent and skill, visually</small>
          </span>
        </button>
        <button className="nav-disabled" type="button" disabled>
          <Database size={18} />
          <span>
            Agent Foundry
            <small>Arrives in Phase 2</small>
          </span>
        </button>
        <button className="nav-disabled" type="button" disabled>
          <PlugZap size={18} />
          <span>
            Connectors
            <small>Arrives in Phase 5</small>
          </span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="workspace-card">
          <span className="workspace-avatar">P</span>
          <div>
            <strong>Pomebrain Lab</strong>
            <span>Founder workspace</span>
          </div>
          <Settings2 size={16} />
        </div>
      </div>
    </aside>
  );
}

