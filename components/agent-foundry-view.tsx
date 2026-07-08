"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Bot, CheckCircle2, Layers3, Search, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { SeedInspector } from "@/components/seed-inspector";
import { useBrainSeeds } from "@/lib/hooks/use-brain-seeds";
import { seedDomain, seedName, seedRelatedSkills, seedSummary } from "@/lib/seed-display";

export function AgentFoundryView() {
  const { seeds, fibres, loading, error } = useBrainSeeds();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");

  const agents = useMemo(
    () => seeds.filter((seed) => seed.type === "agent").sort((a, b) => seedName(a).localeCompare(seedName(b))),
    [seeds],
  );

  const domains = useMemo(() => {
    return Array.from(new Set(agents.map(seedDomain))).sort((a, b) => a.localeCompare(b));
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return agents.filter((agent) => {
      const matchesDomain = domainFilter === "all" || seedDomain(agent) === domainFilter;
      const searchable = `${seedName(agent)} ${seedSummary(agent)} ${seedDomain(agent)} ${seedRelatedSkills(agent).join(" ")}`.toLowerCase();
      return matchesDomain && (!needle || searchable.includes(needle));
    });
  }, [agents, domainFilter, query]);

  const selected = agents.find((agent) => agent.id === selectedId) ?? filteredAgents[0] ?? agents[0];
  const approvedCount = agents.filter((agent) => agent.status === "approved").length;
  const skillCoverage = new Set(agents.flatMap(seedRelatedSkills)).size;
  const selectedConnections = selected
    ? fibres.filter((fibre) => fibre.sourceId === selected.id || fibre.targetId === selected.id).length
    : 0;

  return (
    <div className="view-scroll brain-page">
      <section className="page-intro brain-intro">
        <div>
          <span className="eyebrow"><span /> AGENT FOUNDRY</span>
          <h1>Every builder, indexed.<br /><em>Every role ready.</em></h1>
          <p>Browse the agents Pomebrain can assign during Crown runs. These cards are live seeds from your workspace, not local placeholders.</p>
        </div>
      </section>

      <section className="metric-strip" aria-label="Agent Foundry metrics">
        <article><span>AGENTS</span><strong>{String(agents.length).padStart(2, "0")}</strong><small>Workspace-scoped</small></article>
        <article><span>DOMAINS</span><strong>{String(domains.length).padStart(2, "0")}</strong><small>Foundry benches</small></article>
        <article><span>APPROVED</span><strong>{String(approvedCount).padStart(2, "0")}</strong><small>Ready for routing</small></article>
        <article><span>SKILL LINKS</span><strong>{String(skillCoverage).padStart(2, "0")}</strong><small>Reusable coverage</small></article>
      </section>

      {loading ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div><span className="section-label">FOUNDRY INDEX</span><h2>Loading agents…</h2></div>
            <div className="graph-legend"><span className="live-pulse" /> Querying Supabase</div>
          </div>
          <p>Reading agent seeds and their version metadata.</p>
        </section>
      ) : null}

      {error ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div><span className="section-label">FOUNDRY INDEX</span><h2>Unable to load agents</h2></div>
          </div>
          <p>{error}</p>
        </section>
      ) : null}

      {!loading && !error && agents.length === 0 ? (
        <section className="graph-card panel-card">
          <div className="panel-heading">
            <div><span className="section-label">FOUNDRY INDEX</span><h2>No agents yet</h2></div>
          </div>
          <p>Seed your local agent manifests into Supabase, then this foundry will fill with assignable builders.</p>
        </section>
      ) : null}

      {!loading && !error && agents.length > 0 ? (
        <div className="foundry-layout">
          <section className="panel-card foundry-main">
            <div className="panel-heading">
              <div><span className="section-label">AGENT BENCHES</span><h2>{filteredAgents.length} visible builders</h2></div>
              <div className="graph-legend"><Bot size={14} /> Live seed registry</div>
            </div>

            <div className="foundry-toolbar">
              <div className="graph-search-wrap foundry-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search agent, domain, skill…"
                  aria-label="Search agents"
                />
              </div>
              <div className="domain-filter" aria-label="Filter by domain">
                <button className={domainFilter === "all" ? "active" : ""} type="button" onClick={() => setDomainFilter("all")}>
                  All
                </button>
                {domains.map((domain) => (
                  <button
                    className={domainFilter === domain ? "active" : ""}
                    key={domain}
                    type="button"
                    onClick={() => setDomainFilter(domain)}
                  >
                    {domain}
                  </button>
                ))}
              </div>
            </div>

            <div className="agent-card-grid">
              {filteredAgents.map((agent) => {
                const skills = seedRelatedSkills(agent);
                const active = selected?.id === agent.id;

                return (
                  <button
                    key={agent.id}
                    type="button"
                    className={`agent-manifest-card${active ? " active" : ""}`}
                    onClick={() => setSelectedId(agent.id)}
                  >
                    <span className="agent-card-icon"><Bot size={18} /></span>
                    <span className="agent-card-body">
                      <span className="agent-card-kicker">{seedDomain(agent)}</span>
                      <strong>{seedName(agent)}</strong>
                      <small>{seedSummary(agent)}</small>
                      <span className="agent-card-meta">
                        <span><CheckCircle2 size={12} /> {agent.status}</span>
                        <span><Wrench size={12} /> {skills.length} skills</span>
                      </span>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                );
              })}
            </div>
          </section>

          <SeedInspector seed={selected} connections={selectedConnections} emptyLabel="Select an agent to inspect its role, domain, and skills." />
        </div>
      ) : null}

      <section className="foundation-row">
        <article className="foundation-card">
          <span className="icon-box"><Layers3 size={20} /></span>
          <div><span>BENCHES</span><strong>Agents stay grouped</strong><p>Domains become routing benches for Crown assignments.</p></div>
        </article>
        <article className="foundation-card">
          <span className="icon-box"><ShieldCheck size={20} /></span>
          <div><span>GOVERNANCE</span><strong>Status gates routing</strong><p>Draft, review, and approved agents stay visible before automation.</p></div>
        </article>
        <article className="foundation-card">
          <span className="icon-box"><Wrench size={20} /></span>
          <div><span>SKILLS</span><strong>Reusable methods attach</strong><p>Agent cards reveal which skills they can invoke.</p></div>
        </article>
        <article className="foundation-card special">
          <span className="icon-box"><Sparkles size={20} /></span>
          <div><span>NEXT</span><strong>Assign from the Crown</strong><p>The planner can route build tasks to this foundry.</p></div>
        </article>
      </section>
    </div>
  );
}
