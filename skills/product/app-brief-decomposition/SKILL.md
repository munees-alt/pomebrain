---
name: app-brief-decomposition
description: Decompose loose conversational app ideas into functional requirements, data entities, workflows, and MVP boundaries. Use as the first App Factory skill for Brief Synthesizer before engineering, schema, design, or deployment planning begins.
---

# App Brief Decomposition

Purpose: Ingest loose product descriptions and extract explicit core entities, functional workflows, and structural boundaries.

Use this skill as the first step of an App Factory build run.

## Inputs

- `raw_user_prompt`: text
- `target_tech_stack`: array, such as `["Next.js", "Supabase"]`

## Outputs

- `functional_requirements`: structured markdown
- `data_entities_list`: array of objects defining properties and relations

## Procedure

1. Separate structural business requirements from design preferences.
2. Identify every unique noun as a potential database entity.
3. Identify every action verb as a potential API route, mutation, or workflow step.
4. Map the primary login-to-dashboard workflow in sequence.
5. Mark assumptions and unstated dependencies.
6. Explicitly list what falls outside MVP scope.

## Evaluation

- Identify at least three primary database entities when the app idea is data-backed.
- Map a complete sequential login-to-dashboard workflow.
- Avoid assuming unstated external dependencies.
- Keep optional features separate from MVP scope.

