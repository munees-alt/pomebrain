"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Crown, GitBranch, Layers3, Search, ShieldCheck, Sparkles } from "lucide-react";
import { PomegranateMark } from "@/components/pomegranate-mark";
import { SeedInspector } from "@/components/seed-inspector";
import { useBrainSeeds, type LiveSeed } from "@/lib/hooks/use-brain-seeds";
import { seedDomain, seedName, seedSummary } from "@/lib/seed-display";

type BrainViewProps = {
  onOpenCrown: () => void;
};

const graphTones = ["rose", "gold", "cream", "blue", "violet", "green", "red"];

function buildGraphPositions(seeds: LiveSeed[]) {
  return seeds.reduce<Record<string, { x: number; y: number; tone: string }>>((positions, seed, index) => {
    const angle = (index / Math.max(seeds.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = index % 2 === 0 ? 42 : 35;
    positions[seed.id] = {
      x: 50 + Math.cos(angle) * radius,
      y: 48 + Math.sin(angle) * radius,
      tone: graphTones[index % graphTones.length],
    };
    return positions;
  }, {});
}

export function BrainView({ onOpenCrown }: BrainViewProps) {
  const { seeds, fibres, loading, error } = useBrainSeeds();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selected = seeds.find((seed) => seed.id === selectedId) ?? (selectedId === null ? undefined : seeds[0]);
  const graphPositions = useMemo(() => buildGraphPositions(seeds), [seeds]);
  const approvedSeeds = seeds.filter((seed) => seed.status === "approved").length;
  const approvalRate = seeds.length ? Math.round((approvedSeeds / seeds.length) * 100) : 0;
  const selectedConnections = selected
    ? fibres.filter((fibre) => fibre.sourceId === selected.id || fibre.targetId === selected.id).length
    : 0;
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const needle = query.toLowerCase();
    return seeds.filter((seed) => `${seedName(seed)} ${seedSummary(seed)} ${seedDomain(seed)}`.toLowerCase().includes(needle));
  }, [query, seeds]);

  return (
    <div className="view-scroll brain-page">
      <section className="page-intro brain-intro">
        <div>
          <span className="eyebrow"><span /> LIVING KNOWLEDGE GRAPH</span>
          <h1>Every seed in its place.<br /><em>Every lesson alive.</em></h1>
          <p>Explore the agents, skills, evidence, and decisions Pomebrain will use to build what comes next.</p>
        </div>
        <button className="gold-action" type="button" onClick={onOpenCrown}>
          <Crown size={18} /> Open Crown Console <ArrowRight size={18} />
        </button>
      </section>

      <section className="metric-strip" aria-label="Brain metrics">
        <article><span>ACTIVE SEEDS</span><strong>{String(seeds.length).padStart(2, "0")}</strong><small>Loaded from Supabase</small></article>
        <article><span>RELATIONSHIPS</span><strong>{String(fibres.length).padStart(2, "0")}</strong><small>Live fibres</small></article>
        <article><span>APPROVED</span><strong>{approvalRate}%</strong><small>{approvedSeeds} of {seeds.length} reviewed</small></article>
        <article><span>CONFLICTS</span><strong>00</strong><small><Check size={12} /> Brain is coherent</small></article>
      </section>

      {!loading && !error && seeds.length === 0 ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div>
              <span className="section-label">BRAIN TOPOLOGY</span>
              <h2>No seeds yet</h2>
            </div>
            <div className="graph-legend"><span className="live-pulse" /> Supabase connected</div>
          </div>
          <p>Insert your first row into <code>public.seeds</code> and reload this page.</p>
        </section>
      ) : null}

      {error ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div>
              <span className="section-label">BRAIN TOPOLOGY</span>
              <h2>Unable to load Supabase seeds</h2>
            </div>
          </div>
          <p>{error}</p>
        </section>
      ) : null}

      {loading ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div>
              <span className="section-label">BRAIN TOPOLOGY</span>
              <h2>Loading Brain seeds…</h2>
            </div>
            <div className="graph-legend"><span className="live-pulse" /> Querying Supabase</div>
          </div>
        </section>
      ) : null}

      {!loading && !error && seeds.length > 0 ? (
      <div className="brain-grid">
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div>
              <span className="section-label">BRAIN TOPOLOGY</span>
              <h2>Foundation pod</h2>
            </div>
            <div className="graph-legend"><span className="live-pulse" /> Live structure</div>
          </div>

          <div className="graph-search-wrap">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a seed in this brain…"
              aria-label="Find a seed"
            />
            {query && <kbd>{searchResults.length} found</kbd>}
          </div>

          <div className="seed-graph" role="group" aria-label="Foundation seed graph">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {seeds.map((seed) => {
                const position = graphPositions[seed.id];
                return (
                  <line
                    key={seed.id}
                    x1="50"
                    y1="48"
                    x2={position.x}
                    y2={position.y}
                    className={selectedId === seed.id ? "edge-active" : ""}
                  />
                );
              })}
              <circle cx="50" cy="48" r="24" className="core-halo" />
              <circle cx="50" cy="48" r="15" className="core-halo inner" />
            </svg>

            <button
              type="button"
              className={`core-node${selectedId === null ? " selected" : ""}`}
              onClick={() => setSelectedId(null)}
            >
              <PomegranateMark compact />
              <strong>POMEBRAIN</strong>
              <span>GOVERNED CORE</span>
            </button>

            {seeds.map((seed) => {
              const position = graphPositions[seed.id];
              const matched = !query || searchResults.some((result) => result.id === seed.id);
              return (
                <button
                  key={seed.id}
                  type="button"
                  className={`graph-node node-${position.tone}${selectedId === seed.id ? " selected" : ""}${matched ? "" : " dimmed"}`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  onClick={() => setSelectedId(seed.id)}
                >
                  <i />
                  <strong>{seedName(seed)}</strong>
                  <span>{seed.type}</span>
                </button>
              );
            })}
          </div>
        </section>

        <SeedInspector seed={selected} connections={selectedConnections} emptyLabel="Select POMEBRAIN or a seed to inspect it." />
      </div>
      ) : null}

      <section className="foundation-row">
        <article className="foundation-card">
          <span className="icon-box"><ShieldCheck size={20} /></span>
          <div><span>THE SKIN</span><strong>Governance is active</strong><p>Every seed carries status, provenance, version, and confidence.</p></div>
        </article>
        <article className="foundation-card">
          <span className="icon-box"><GitBranch size={20} /></span>
          <div><span>THE FIBRES</span><strong>Relationships stay typed</strong><p>Links explain why knowledge belongs together and how it is used.</p></div>
        </article>
        <article className="foundation-card">
          <span className="icon-box"><Layers3 size={20} /></span>
          <div><span>THE PODS</span><strong>Context stays contained</strong><p>Projects and teams get useful boundaries without creating silos.</p></div>
        </article>
        <article className="foundation-card special">
          <span className="icon-box"><Sparkles size={20} /></span>
          <div><span>NEXT MOVE</span><strong>Give the Crown a goal</strong><p>The Brain will route the right seeds into a build plan.</p></div>
          <button onClick={onOpenCrown} type="button" aria-label="Open Crown Console"><ArrowRight size={18} /></button>
        </article>
      </section>
    </div>
  );
}
