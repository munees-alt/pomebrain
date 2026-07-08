"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useBrainSeeds } from "@/lib/hooks/use-brain-seeds";
import { seedDomain, seedName } from "@/lib/seed-display";
import { SeedInspector } from "@/components/seed-inspector";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const CENTER = 200;
const MAX_RADIUS = 152;

type ArilPosition = { x: number; y: number };

function arilLayout(index: number, total: number): ArilPosition {
  const radius = MAX_RADIUS * Math.sqrt((index + 0.5) / Math.max(total, 1));
  const angle = index * GOLDEN_ANGLE;
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

export function PomegranateView() {
  const { seeds, fibres, loading, error } = useBrainSeeds();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const ordered = useMemo(
    () => [...seeds].sort((a, b) => (a.type === b.type ? a.slug.localeCompare(b.slug) : a.type.localeCompare(b.type))),
    [seeds],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return ordered;
    const needle = query.toLowerCase();
    return ordered.filter((seed) => `${seedName(seed)} ${seedDomain(seed)} ${seed.type}`.toLowerCase().includes(needle));
  }, [ordered, query]);

  const matchedIds = useMemo(() => new Set(filtered.map((seed) => seed.id)), [filtered]);
  const selected = ordered.find((seed) => seed.id === selectedId) ?? ordered[0];
  const domains = useMemo(() => new Set(ordered.map(seedDomain)).size, [ordered]);
  const agentCount = ordered.filter((seed) => seed.type === "agent").length;
  const skillCount = ordered.filter((seed) => seed.type === "skill").length;
  const selectedFibreCount = selected
    ? fibres.filter((fibre) => fibre.sourceId === selected.id || fibre.targetId === selected.id).length
    : 0;

  return (
    <div className="view-scroll brain-page">
      <section className="page-intro brain-intro">
        <div>
          <span className="eyebrow"><span /> SEED LIBRARY</span>
          <h1>Every seed, one fruit.<br /><em>Cut it open to see the Brain.</em></h1>
          <p>Each aril below is one approved agent or skill, arranged the way seeds actually pack inside a pomegranate. Click one to inspect it.</p>
        </div>
      </section>

      <section className="metric-strip" aria-label="Seed library metrics">
        <article><span>TOTAL SEEDS</span><strong>{String(ordered.length).padStart(2, "0")}</strong><small>Live in Supabase</small></article>
        <article><span>AGENTS</span><strong>{String(agentCount).padStart(2, "0")}</strong><small>Portable manifests</small></article>
        <article><span>SKILLS</span><strong>{String(skillCount).padStart(2, "0")}</strong><small>Reusable packages</small></article>
        <article><span>DOMAINS</span><strong>{String(domains).padStart(2, "0")}</strong><small>Coverage areas</small></article>
      </section>

      {loading && ordered.length === 0 ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div><span className="section-label">POMEGRANATE</span><h2>Loading Seed Library…</h2></div>
            <div className="graph-legend"><span className="live-pulse" /> Querying Supabase</div>
          </div>
          <p>Fetching workspace-scoped agents, skills, and fibres.</p>
        </section>
      ) : null}

      {error ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div><span className="section-label">POMEGRANATE</span><h2>Unable to load seeds</h2></div>
          </div>
          <p>{error}</p>
        </section>
      ) : null}

      {!error && !loading && ordered.length === 0 ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div><span className="section-label">POMEGRANATE</span><h2>No seeds yet</h2></div>
          </div>
          <p>Run the seed script once agents and skills exist as manifests, then reload this page.</p>
        </section>
      ) : null}

      {!error && ordered.length > 0 ? (
        <div className="brain-grid">
          <section className="graph-card panel-card">
            <div className="panel-heading">
              <div><span className="section-label">POMEGRANATE</span><h2>{loading ? "Loading seeds…" : "Cross-section"}</h2></div>
              <div className="graph-legend"><span className="live-pulse" /> {ordered.length} seeds packed</div>
            </div>

            <div className="graph-search-wrap">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find an agent or skill…"
                aria-label="Find a seed"
              />
              {query && <kbd>{filtered.length} found</kbd>}
            </div>

            <div className="pomegranate-visual" role="group" aria-label="Pomegranate seed cross-section">
              <svg viewBox="0 0 400 400" aria-hidden="true">
                <defs>
                  <radialGradient id="rindGradient" cx="50%" cy="42%" r="65%">
                    <stop offset="0%" stopColor="#5c1120" />
                    <stop offset="75%" stopColor="#3c0a15" />
                    <stop offset="100%" stopColor="#26060d" />
                  </radialGradient>
                  <radialGradient id="fleshGradient" cx="50%" cy="46%" r="70%">
                    <stop offset="0%" stopColor="rgba(240, 201, 111, 0.1)" />
                    <stop offset="100%" stopColor="rgba(246, 239, 227, 0.03)" />
                  </radialGradient>
                </defs>

                <circle cx={CENTER} cy={CENTER} r="188" fill="url(#rindGradient)" stroke="rgba(229,173,56,.35)" strokeWidth="2" />
                <circle cx={CENTER} cy={CENTER} r="170" fill="url(#fleshGradient)" />

                <polygon
                  points={`${CENTER - 14},34 ${CENTER},14 ${CENTER + 14},34 ${CENTER + 6},46 ${CENTER - 6},46`}
                  fill="var(--gold)"
                  opacity="0.85"
                />

                {[0, 1, 2, 3].map((membrane) => {
                  const angle = (membrane / 4) * Math.PI * 2 + Math.PI / 8;
                  const x2 = CENTER + 168 * Math.cos(angle);
                  const y2 = CENTER + 168 * Math.sin(angle);
                  return (
                    <path
                      key={membrane}
                      d={`M ${CENTER} ${CENTER} Q ${CENTER + (x2 - CENTER) * 0.5 + 14} ${CENTER + (y2 - CENTER) * 0.5} ${x2} ${y2}`}
                      fill="none"
                      stroke="rgba(246,239,227,.1)"
                      strokeWidth="1.4"
                    />
                  );
                })}

                {ordered.map((seed, index) => {
                  const position = arilLayout(index, ordered.length);
                  const isAgent = seed.type === "agent";
                  const isSelected = selected?.id === seed.id;
                  const dimmed = query && !matchedIds.has(seed.id);
                  return (
                    <g
                      key={seed.id}
                      className={`aril${isSelected ? " aril-selected" : ""}${dimmed ? " aril-dimmed" : ""}`}
                      transform={`translate(${position.x}, ${position.y})`}
                    >
                      <circle
                        r={isAgent ? 7.4 : 6.2}
                        fill={isAgent ? "var(--rose)" : "var(--gold)"}
                        stroke={isSelected ? "var(--cream)" : "rgba(9,7,8,.4)"}
                        strokeWidth={isSelected ? 1.6 : 0.6}
                      />
                      <circle cx="-2" cy="-2.4" r={isAgent ? 2.1 : 1.7} fill="rgba(255,255,255,.35)" />
                    </g>
                  );
                })}
              </svg>

              <button type="button" className="aril-hit-layer" aria-hidden />
              {ordered.map((seed, index) => {
                const position = arilLayout(index, ordered.length);
                return (
                  <button
                    key={seed.id}
                    type="button"
                    className="aril-hitbox"
                    style={{ left: `${(position.x / 400) * 100}%`, top: `${(position.y / 400) * 100}%` }}
                    onClick={() => setSelectedId(seed.id)}
                    aria-label={`Inspect ${seedName(seed)}`}
                  />
                );
              })}
            </div>

            <div className="pomegranate-legend">
              <span><i className="legend-dot legend-agent" /> Agent</span>
              <span><i className="legend-dot legend-skill" /> Skill</span>
            </div>
          </section>

          <SeedInspector seed={selected} connections={selectedFibreCount} emptyLabel="Select an aril to inspect a seed." />
        </div>
      ) : null}
    </div>
  );
}
