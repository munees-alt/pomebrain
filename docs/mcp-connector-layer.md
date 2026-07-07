# MCP & Connector Layer

Pomebrain agents do not call external APIs directly. They request named capabilities, and the server validates payloads, applies approval policy, audits the decision, then routes allowed actions to the correct MCP adapter.

## Boundary rules

- Browser code never receives service-role keys, API tokens, deploy tokens, PATs, or encrypted secret material.
- Frontend clients call `/api/v1/rpc/execute_capability`.
- The server validates the capability request with strict Zod schemas.
- Raw authorization blocks, approval overrides, and credential-like fields are rejected as policy violations.
- Destructive, high-risk, or consequential capabilities return `requires_approval` until a real approval workflow signs them.

## MCP server template

Use `config/mcp.servers.example.json` as the shape for local or deployment configuration. Values are environment placeholders, not real secrets.

## Core capability matrix

| Capability ID | Target action | Safety class | Default policy |
| --- | --- | --- | --- |
| `supabase.database.read` | `list_tables`, `get_table_schema` | Safe / Read | Auto-run allowed |
| `supabase.task_state.write` | `update_task_status` | Reversible Write | Auto-run allowed |
| `supabase.migrations.apply` | `execute_sql` | Destructive / Write | Requires team confirmation |
| `github.pull_requests.create` | `create_pull_request` | Reversible Write | Auto-run allowed |
| `github.branches.merge` | `merge_branch` | High-risk Write | Requires team confirmation |
| `vercel.deploy.preview` | `create_preview_deployment` | Safe Execution | Auto-run allowed |
| `vercel.deploy.production` | `promote_to_production` | Consequential Action | Always needs owner approval |
| `google.drive.read` | `drive.files.read` | Safe / Read | Auto-run allowed |
| `google.drive.write` | `drive.files.write` | Reversible Write | Auto-run allowed |
| `google.gmail.send` | `gmail.messages.send` | External Communication | Requires team confirmation |
| `fathom.analytics.read` | `analytics.query` | Safe / Read | Auto-run allowed |
| `llm.cross_route` | `model.route` | Safe Execution | Auto-run allowed |

## Current implementation state

Phase 0 implements the secure validation and policy gateway. It does not spawn live MCP stdio processes yet. Live adapter execution should be enabled only after connector credentials are configured server-side and the approval queue exists.
