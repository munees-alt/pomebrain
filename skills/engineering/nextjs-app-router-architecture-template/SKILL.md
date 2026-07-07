---
name: nextjs-app-router-architecture-template
description: Generate deterministic Next.js 14+ App Router directory mappings with strict src/app, src/components, src/modules, and @/* absolute import conventions. Use when initializing a repository or adding a major product feature module.
---

# Next.js App Router Architecture Template

Purpose: Generate a deterministic directory mapping for a Next.js 14+ system using strict folders and absolute path aliases.

## Inputs

- `feature_modules`: array, such as `["auth", "billing"]`
- `global_components`: array of UI requirements

## Outputs

- `directory_tree_json`: JSON layout mapping paths to default content templates

## Procedure

1. Use `src/app/` for layout routes and route entries.
2. Use `src/components/` for shared atomic UI blocks.
3. Use `src/modules/` for feature-focused contexts.
4. Enforce `@/*` absolute imports.
5. Avoid legacy Pages Router conventions.
6. Keep route folders limited to core `page.tsx`, `layout.tsx`, `loading.tsx`, and route-specific files.

## Evaluation

- No general component files should be dropped inside route directories.
- Directory output must be deterministic for the same module list.
- No Pages Router conventions should appear.

