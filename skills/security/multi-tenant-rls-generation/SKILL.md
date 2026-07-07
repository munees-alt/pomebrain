---
name: multi-tenant-rls-generation
description: Generate secure Supabase/Postgres Row Level Security SQL for multi-tenant workspace data. Use whenever private tables require tenant boundaries, auth.uid checks, auth.jwt claim checks, and anonymous-deny fallback policies.
---

# Multi-Tenant RLS Generation

Purpose: Produce secure RLS SQL declarations that check tenancy boundaries against active auth metadata.

## Inputs

- `table_name`: string
- `tenant_foreign_key`: string, default `organization_id`

## Outputs

- `rls_migration_sql`: executable SQL string for review

## Procedure

1. Enable RLS on the target table.
2. Draft SELECT, INSERT, UPDATE, and DELETE policies.
3. Check authenticated user scope using `auth.uid()` or `auth.jwt()` claims.
4. Use tenant boundary fields such as `organization_id`.
5. Include an explicit default-deny posture for anonymous traffic.
6. Mark all generated SQL for human review before execution.

## Evaluation

- Must block non-owner edits in basic transaction mock tests.
- Must deny anonymous traffic by default.
- Must not disable RLS.

