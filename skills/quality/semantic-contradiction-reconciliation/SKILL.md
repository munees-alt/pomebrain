---
name: semantic-contradiction-reconciliation
description: Compare incoming seed proposals against existing knowledge entries to detect duplicates, contradictions, version updates, and supersession candidates. Use during skill, agent, decision, or knowledge ingestion when Logic Reconciliation Engine checks graph coherence.
---

# Semantic Contradiction Reconciliation

Purpose: Parse incoming structural text against an existing library entry to evaluate logical gaps, version updates, or factual discrepancies.

## Inputs

- `existing_seed_content`: string
- `incoming_seed_proposal`: string

## Outputs

- `reconciliation_verdict`: JSON with `is_duplicate`, `has_contradiction`, `supersedes_older`, and `suggested_action`
- `comparison_rationale`: detailed markdown

## Procedure

1. Compare existing and incoming content structurally.
2. Determine whether the incoming item replaces, extends, duplicates, or contradicts the existing item.
3. Pinpoint explicit colliding statements when contradictions exist.
4. Evaluate which record has better evidence, specificity, or freshness.
5. Generate conflict/supersession proposals only; do not silently replace records.

## Required JSON Shape

```json
{
  "is_duplicate": false,
  "has_contradiction": false,
  "supersedes_older": false,
  "suggested_action": "keep_both"
}
```

Allowed `suggested_action` values:

- `keep_both`
- `merge`
- `create_conflict`
- `supersede_existing`
- `reject_incoming`
- `needs_human_review`

## Evaluation

- Output JSON must match the schema exactly.
- Factual differences must be registered as conflict relationships.
- The skill must not silently replace or ignore differences.

