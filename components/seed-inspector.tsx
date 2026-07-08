import { ChevronRight } from "lucide-react";
import type { LiveSeed } from "@/lib/hooks/use-brain-seeds";
import { seedDomain, seedName, seedRelatedSkills, seedSummary } from "@/lib/seed-display";

type SeedInspectorProps = {
  seed: LiveSeed | undefined;
  connections: number;
  emptyLabel?: string;
};

export function SeedInspector({ seed, connections, emptyLabel = "Select a seed to inspect it." }: SeedInspectorProps) {
  if (!seed) {
    return (
      <aside className="seed-inspector panel-card">
        <p>{emptyLabel}</p>
      </aside>
    );
  }

  const relatedSkills = seedRelatedSkills(seed);

  return (
    <aside className="seed-inspector panel-card">
      <div className="inspector-topline">
        <span className={`kind-badge kind-${seed.type}`}>{seed.type}</span>
        <span className={`seed-status status-${seed.status}`}>{seed.status}</span>
      </div>
      <h2>{seedName(seed)}</h2>
      <p>{seedSummary(seed)}</p>

      <dl className="seed-facts">
        <div><dt>Domain</dt><dd>{seedDomain(seed)}</dd></div>
        <div><dt>Slug</dt><dd>{seed.slug}</dd></div>
        <div><dt>Connections</dt><dd>{connections}</dd></div>
        <div><dt>Created</dt><dd>{new Date(seed.createdAt).toLocaleDateString()}</dd></div>
      </dl>

      {relatedSkills.length > 0 ? (
        <div className="tag-list">
          {relatedSkills.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      ) : null}

      <button type="button" className="outline-action">
        Inspect seed <ChevronRight size={16} />
      </button>
    </aside>
  );
}
