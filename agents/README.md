# Pomebrain Agent Registry

This folder is the portable source of truth for every agent supplied to or created by Pomebrain.

## Allocation rule

Every agent must live at:

```text
agents/<domain>/<agent-slug>/
```

Examples:

```text
agents/security/threat-model-reviewer/
agents/security/secure-code-auditor/
agents/engineering/full-stack-builder/
agents/finance/financial-model-builder/
```

The domain is chosen from the agent's primary responsibility, not from the project currently using it. If an agent genuinely spans domains, it keeps one primary home and declares secondary domains in its manifest. Pomebrain must not duplicate the agent across folders.

## Canonical domains

| Folder | Agents placed here |
|---|---|
| `security/` | Threat modelling, secure code review, access control, privacy, incident response |
| `engineering/` | Frontend, backend, mobile, infrastructure, integrations, architecture |
| `product/` | Discovery, requirements, product strategy, prioritisation |
| `design/` | UX, UI, research, content design, accessibility |
| `data/` | Analytics, data engineering, machine learning, reporting |
| `finance/` | Accounting, FP&A, CFO, audit, tax and finance operations |
| `quality/` | QA, testing, evaluation, release verification |
| `operations/` | Delivery, workflows, support, onboarding and business operations |
| `research/` | Research, evidence gathering, synthesis and knowledge curation |

If no domain fits confidently, the agent goes to review instead of being silently placed in the wrong folder.

## Required agent package

```text
agents/<domain>/<agent-slug>/
├── agent.yaml           # identity, purpose, routing and version
├── prompt.md            # operating instructions and boundaries
├── skills.yaml          # approved skill references
├── mcp.yaml             # allowlisted MCP capabilities, never credentials
├── evaluations/         # cases and quality thresholds
├── policies/            # approval and safety rules
└── CHANGELOG.md         # version and supersession history
```

## MCP access rule

Agent packages reference capabilities such as:

```yaml
mcp:
  allow:
    - supabase.database.read
    - supabase.migrations.apply
    - vercel.deploy.preview
  confirm:
    - vercel.deploy.production
  deny:
    - secrets.read_raw
```

Raw API keys, service-role keys, deployment tokens, OAuth refresh tokens and passwords must never be stored inside an agent package. The server-side connector vault owns credentials; the agent only receives scoped MCP tools.

## Intake workflow

Whenever an agent is supplied:

1. Parse its purpose, inputs, outputs, skills and requested tools.
2. Classify its primary domain and secondary domains.
3. Create a stable slug and validate `agent.yaml`.
4. Separate reusable skills from agent-specific instructions.
5. Map requested access to known MCP capability IDs.
6. Flag ambiguous, destructive or unavailable capabilities for review.
7. Add evaluations before promoting the agent from draft to approved.
8. Preserve earlier versions and connect replacements with `supersedes`.

