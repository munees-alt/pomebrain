"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronRight, Crown, GitBranch, Layers3, Search, ShieldCheck, Sparkles } from "lucide-react";
import { PomegranateMark } from "@/components/pomegranate-mark";
import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-client";
import { edgeKinds, seedKinds, type Edge, type Seed, type SeedKind } from "@/lib/domain";

type BrainViewProps = {
  onOpenCrown: () => void;
};

const foundationGraphPositions: Record<string, { x: number; y: number; tone: string }> = {
  "seed-agents": { x: 20, y: 22, tone: "rose" },
  "seed-skills": { x: 51, y: 12, tone: "gold" },
  "seed-knowledge": { x: 79, y: 27, tone: "cream" },
  "seed-tools": { x: 85, y: 66, tone: "blue" },
  "seed-decisions": { x: 55, y: 82, tone: "violet" },
  "seed-evidence": { x: 19, y: 72, tone: "green" },
  "seed-apps": { x: 9, y: 47, tone: "red" },
};

const graphTones = ["rose", "gold", "cream", "blue", "violet", "green", "red"];
const edgeKindSet = new Set<string>(edgeKinds);
const seedKindSet = new Set<string>(seedKinds);

type SeedRow = {
  id: string;
  slug: string;
  type: string;
  created_at: string;
};

type FibreRow = {
  id?: string;
  source_seed_id: string;
  target_seed_id: string;
  relationship_type: string;
  created_at?: string;
};

function buildGraphPositions(seeds: Seed[]) {
  const dynamicSeeds = seeds.filter((seed) => !foundationGraphPositions[seed.id]);
  const dynamicPositions = dynamicSeeds.reduce<Record<string, { x: number; y: number; tone: string }>>((positions, seed, index) => {
    const angle = (index / Math.max(dynamicSeeds.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = index % 2 === 0 ? 42 : 35;
    positions[seed.id] = {
      x: 50 + Math.cos(angle) * radius,
      y: 48 + Math.sin(angle) * radius,
      tone: graphTones[index % graphTones.length],
    };
    return positions;
  }, {});

  return { ...foundationGraphPositions, ...dynamicPositions };
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapSeedRow(row: SeedRow): Seed {
  const kind = seedKindSet.has(row.type) ? (row.type as SeedKind) : "knowledge";

  return {
    id: row.id,
    versionId: `${row.id}-live`,
    kind,
    name: titleFromSlug(row.slug) || row.slug,
    summary: `Live ${kind} seed from Supabase: ${row.slug}.`,
    status: "draft",
    podId: "supabase",
    confidence: 1,
    tags: ["live", row.type],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.created_at).toISOString(),
  };
}

function mapFibreRow(row: FibreRow): Edge {
  const normalizedKind = row.relationship_type.toLowerCase();
  const kind = edgeKindSet.has(normalizedKind) ? (normalizedKind as Edge["kind"]) : "similar_to";

  return {
    id: row.id ?? `edge-${row.source_seed_id}-${row.target_seed_id}-${normalizedKind}`,
    sourceId: row.source_seed_id,
    targetId: row.target_seed_id,
    kind,
    strength: 0.9,
    createdAt: new Date(row.created_at ?? new Date().toISOString()).toISOString(),
  };
}

export function BrainView({ onOpenCrown }: BrainViewProps) {
  const [selectedId, setSelectedId] = useState("brain-core");
  const [query, setQuery] = useState("");
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBrain() {
      setLoading(true);
      setLoadError(null);

      try {
        if (!hasSupabaseBrowserEnv()) {
          throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        }

        const supabase = createSupabaseBrowserClient();
        const [seedResult, fibreResult] = await Promise.all([
          supabase.from("seeds").select("id, slug, type, created_at").order("created_at", { ascending: true }),
          supabase.from("fibres").select("id, source_seed_id, target_seed_id, relationship_type, created_at"),
        ]);

        if (seedResult.error) throw seedResult.error;
        if (fibreResult.error) throw fibreResult.error;

        if (!isMounted) return;

        const nextSeeds = ((seedResult.data ?? []) as SeedRow[]).map(mapSeedRow);
        setSeeds(nextSeeds);
        setEdges(((fibreResult.data ?? []) as FibreRow[]).map(mapFibreRow));
        setSelectedId((current) => (nextSeeds.some((seed) => seed.id === current) ? current : (nextSeeds[0]?.id ?? "brain-core")));
      } catch (error) {
        if (!isMounted) return;
        setSeeds([]);
        setEdges([]);
        setLoadError(error instanceof Error ? error.message : "Unable to load Brain seeds from Supabase.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadBrain();

    return () => {
      isMounted = false;
    };
  }, []);

  const selected = seeds.find((seed) => seed.id === selectedId) ?? seeds[0];
  const graphSeeds = useMemo(() => seeds.filter((seed) => seed.id !== "brain-core"), [seeds]);
  const graphPositions = useMemo(() => buildGraphPositions(graphSeeds), [graphSeeds]);
  const approvedSeeds = seeds.filter((seed) => seed.status === "approved").length;
  const approvalRate = seeds.length ? Math.round((approvedSeeds / seeds.length) * 100) : 0;
  const selectedConnections = selected ? edges.filter((edge) => edge.sourceId === selected.id || edge.targetId === selected.id).length : 0;
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const needle = query.toLowerCase();
    return seeds.filter((seed) => `${seed.name} ${seed.summary} ${seed.tags.join(" ")}`.toLowerCase().includes(needle));
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
        <article><span>RELATIONSHIPS</span><strong>{String(edges.length).padStart(2, "0")}</strong><small>Live fibres</small></article>
        <article><span>APPROVED</span><strong>{approvalRate}%</strong><small>{approvedSeeds} of {seeds.length} reviewed</small></article>
        <article><span>CONFLICTS</span><strong>00</strong><small><Check size={12} /> Brain is coherent</small></article>
      </section>

      {!loading && !loadError && seeds.length === 0 ? (
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

      {loadError ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div>
              <span className="section-label">BRAIN TOPOLOGY</span>
              <h2>Unable to load Supabase seeds</h2>
            </div>
          </div>
          <p>{loadError}</p>
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

      {!loading && !loadError && seeds.length > 0 ? (
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
              {graphSeeds.map((seed) => {
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
              className={`core-node${selectedId === "brain-core" ? " selected" : ""}`}
              onClick={() => setSelectedId("brain-core")}
            >
              <PomegranateMark compact />
              <strong>POMEBRAIN</strong>
              <span>GOVERNED CORE</span>
            </button>

            {graphSeeds.map((seed) => {
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
                  <strong>{seed.name}</strong>
                  <span>{seed.kind}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="seed-inspector panel-card">
          <div className="inspector-topline">
            <span className={`kind-badge kind-${selected?.kind}`}>{selected?.kind}</span>
            <span className={`seed-status status-${selected?.status}`}>{selected?.status}</span>
          </div>
          <h2>{selected?.name}</h2>
          <p>{selected?.summary}</p>

          <div className="confidence-row">
            <span>CONFIDENCE</span>
            <strong>{selected ? Math.round(selected.confidence * 100) : 0}%</strong>
            <div><i style={{ width: `${selected ? selected.confidence * 100 : 0}%` }} /></div>
          </div>

          <dl className="seed-facts">
            <div><dt>Version</dt><dd>{selected ? selected.versionId.replace(`${selected.id}-`, "") : "—"}</dd></div>
            <div><dt>Pod</dt><dd>{selected?.podId}</dd></div>
            <div><dt>Connections</dt><dd>{selectedConnections}</dd></div>
            <div><dt>Provenance</dt><dd>Phase 0</dd></div>
          </dl>

          <div className="tag-list">
            {selected?.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>

          <button type="button" className="outline-action">
            Inspect seed <ChevronRight size={16} />
          </button>
        </aside>
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
