"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Crown, GitBranch, Layers3, Search, ShieldCheck, Sparkles } from "lucide-react";
import { PomegranateMark } from "@/components/pomegranate-mark";
import { SeedInspector } from "@/components/seed-inspector";
import { useBrainSeeds, type LiveFibre, type LiveSeed } from "@/lib/hooks/use-brain-seeds";
import { seedDomain, seedName, seedSummary } from "@/lib/seed-display";

type BrainViewProps = {
  onOpenCrown: () => void;
};

const graphTones = ["rose", "gold", "cream", "blue", "violet", "green", "red"];
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const typeLobes: Record<string, { x: number; y: number; tone: string }> = {
  agent: { x: 29, y: 32, tone: "rose" },
  skill: { x: 58, y: 28, tone: "gold" },
  connector: { x: 75, y: 54, tone: "blue" },
  tool: { x: 74, y: 68, tone: "blue" },
  project: { x: 48, y: 73, tone: "red" },
  evidence: { x: 28, y: 66, tone: "green" },
  decision: { x: 42, y: 45, tone: "violet" },
  policy: { x: 56, y: 52, tone: "cream" },
  evaluation: { x: 39, y: 58, tone: "green" },
  knowledge: { x: 60, y: 44, tone: "cream" },
};

function buildGraphPositions(seeds: LiveSeed[]) {
  const typeCounts = new Map<string, number>();

  return seeds.reduce<Record<string, { x: number; y: number; tone: string }>>((positions, seed, index) => {
    const lobe = typeLobes[seed.type] ?? { x: 50, y: 50, tone: graphTones[index % graphTones.length] };
    const lobeIndex = typeCounts.get(seed.type) ?? 0;
    typeCounts.set(seed.type, lobeIndex + 1);

    const angle = lobeIndex * GOLDEN_ANGLE;
    const radius = 4 + Math.sqrt(lobeIndex + 0.5) * 5.4;
    positions[seed.id] = {
      x: Math.max(8, Math.min(92, lobe.x + Math.cos(angle) * radius)),
      y: Math.max(10, Math.min(88, lobe.y + Math.sin(angle) * radius)),
      tone: lobe.tone,
    };
    return positions;
  }, {});
}

function fibrePath(fibre: LiveFibre, positions: Record<string, { x: number; y: number }>) {
  const source = positions[fibre.sourceId];
  const target = positions[fibre.targetId];
  if (!source || !target) return null;

  const controlX = (source.x + target.x) / 2;
  const controlY = (source.y + target.y) / 2 - 8;

  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
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
  const visibleFibres = useMemo(() => {
    const seedIds = new Set(seeds.map((seed) => seed.id));
    return fibres.filter((fibre) => seedIds.has(fibre.sourceId) && seedIds.has(fibre.targetId));
  }, [fibres, seeds]);

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
              <h2>Live topology</h2>
            </div>
            <div className="graph-legend"><span className="live-pulse" /> {visibleFibres.length} real fibres</div>
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

          <div className="seed-graph topology-graph" role="group" aria-label="Live pomegranate topology graph">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <radialGradient id="topologySkin" cx="48%" cy="42%" r="70%">
                  <stop offset="0%" stopColor="rgba(117,22,43,.24)" />
                  <stop offset="72%" stopColor="rgba(75,11,25,.12)" />
                  <stop offset="100%" stopColor="rgba(229,173,56,.08)" />
                </radialGradient>
              </defs>
              <ellipse cx="50" cy="50" rx="45" ry="39" className="topology-rind" />
              <ellipse cx="50" cy="50" rx="39" ry="33" fill="url(#topologySkin)" className="topology-flesh" />
              {[22, 42, 63, 82].map((rotation) => (
                <path
                  key={rotation}
                  d="M 50 50 C 38 34, 35 23, 44 13 M 50 50 C 62 66, 63 78, 54 88"
                  className="topology-membrane"
                  transform={`rotate(${rotation} 50 50)`}
                />
              ))}
              {visibleFibres.map((fibre) => {
                const path = fibrePath(fibre, graphPositions);
                if (!path) return null;
                const active = selectedId && (fibre.sourceId === selectedId || fibre.targetId === selectedId);
                return <path key={fibre.id} d={path} className={active ? "topology-fibre edge-active" : "topology-fibre"} />;
              })}
              {visibleFibres.length === 0
                ? seeds.map((seed) => {
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
                  })
                : null}
              <circle cx="50" cy="48" r="17" className="core-halo" />
              <circle cx="50" cy="48" r="9" className="core-halo inner" />
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
                  className={`graph-node topology-node node-${position.tone}${selectedId === seed.id ? " selected" : ""}${matched ? "" : " dimmed"}`}
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
