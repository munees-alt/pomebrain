# Pomebrain App Factory Performance Directive

This directive applies to the Pomebrain Next.js App Router application in this repository.

## Operating rules

- Read the current implementation and `POMEBRAIN_PRODUCT_PLAN.md` before changing product behavior.
- Preserve the existing pomegranate, cream, rose, gold, green, and ink design system in `app/globals.css`.
- Preserve the strict access boundary: platform administration requires `app_metadata.pomebrain_role === "admin"`; customers may use Crown and Connectors but must not gain Brain, Seed Library, or Agent Foundry access.
- Do not claim tools, connectors, deployments, migrations, or visual checks ran unless they were verified in the current environment.
- Use the repository's existing React 19, Next.js, Supabase RLS, and Vitest stack. Do not install global Claude plugins or unrelated cleanup daemons.

## Track 1: Crown responsiveness and interaction latency

1. Treat the approved Crown build map as a responsive bento board:
   - build metadata and assembled agents on the compact side;
   - live step tracker and execution control as the primary panel;
   - immutable Supabase audit activity as a bounded full-width panel.
2. Use React `useOptimistic` for user-triggered transitions so creating, running, and approving work is reflected immediately while the server remains authoritative.
3. Make pending, processing, approval-required, completed, and failed states explicit and accessible.
4. Keep mobile layouts single-column and prevent long identifiers, logs, or connector names from forcing horizontal overflow.

## Track 2: bounded rendering and normalized inputs

1. Never render an unbounded audit or output history. Fetch a capped page and reveal older entries incrementally.
2. Keep large task outputs in a scrollable region with wrapping and containment.
3. Normalize role and agent identifiers before matching: Unicode-normalize, trim, lowercase, and remove whitespace.
4. Keep browser-only animation short and honor reduced-motion preferences.

## Track 3: atomic execution and privileged boundaries

1. Claim the next pending build task atomically in Postgres before performing slow model, GitHub, or Vercel work. A second request must not claim the same task.
2. Keep third-party operations outside the claim transaction; commit their success or release the claim after failure.
3. Before any service-role read, validate the authenticated user, workspace identifier, run ownership, and requested protected identifier at the normal RLS boundary.
4. Keep approval changes conditional on `status = 'pending'` and scoped to the caller's workspace.
5. Treat the immutable `audit_events` ledger as read-only in the UI and never add update/delete policies.

## Required verification

Run sequentially:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

If database migrations are added, apply them only to the intended Supabase project and report that separately from local verification.
