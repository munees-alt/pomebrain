# Phase 4 App Factory MVP Schema

This schema asset defines the unified Phase 1 graph spine plus Phase 4 App Factory runtime state needed for the Pomebrain Architect Orchestrator and Recursive Task Resolution Loop to function.

Executable migration:

- `supabase/migrations/01_unified_pomebrain_core.sql`

Write-back smoke test:

- `supabase/tests/learned_from_writeback_smoke.sql`

## Tables

| Table | Purpose |
| --- | --- |
| `public.seeds` | Stores Brain nodes such as agents, skills, knowledge, projects, and artifacts. |
| `public.seed_versions` | Stores immutable-ish content versions with approval status and embeddings. |
| `public.fibres` | Stores typed Brain relationships such as `USES`, `SUPERSEDES`, and `LEARNED_FROM`. |
| `public.projects` | Stores app/project definitions created from briefs. |
| `public.project_runs` | Continuity log store for each App Factory execution run. |
| `public.build_tasks` | Ordered backlog of granular build steps for the Master Leader loop. |
| `public.approval_queue` | Human-in-the-loop gate for high-risk capabilities. |
| `public.audit_events` | Immutable append-only audit ledger for run/task/approval mutations. |

## Runtime mapping

- Brief Synthesizer creates `projects`.
- Pomebrain Architect Orchestrator creates `project_runs` and `build_tasks`.
- Token Throttle Controller updates `project_runs.total_token_cost`.
- High-risk capability requests write to `approval_queue` and block the run.
- On restart, the Orchestrator reads `project_runs.execution_context` and completed `build_tasks` to resume from the last valid checkpoint.
- At the end of a successful run, Orchestrator logic must insert a `fibres` row with `relationship_type = 'LEARNED_FROM'` to prove the Brain learned from the produced app.

## Safety note

Do not add UPDATE or DELETE policies to `public.audit_events`. Do not weaken the `SECURITY DEFINER` audit function. Those two constraints enforce the "nothing is overwritten" guarantee at the database layer.
