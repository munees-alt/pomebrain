---
name: type-safe-zod-validator-scaffolding
description: Compile client-side and server-side Zod runtime validation schemas from database entity structures or SQL DDL. Use whenever forms, server actions, API payloads, or Supabase table contracts need explicit type-safe validation.
---

# Type-Safe Zod Validator Scaffolding

Purpose: Generate runtime validation schemas from database table/entity structure.

## Inputs

- `database_table_schema`: SQL DDL string or structured entity description

## Outputs

- `zod_schema_code`: executable TypeScript file

## Procedure

1. Map database column types directly to Zod primitives.
2. Map `VARCHAR` and text fields to `z.string()`.
3. Apply length constraints when available.
4. Map nullable columns to `.nullable()` or `.optional()` according to payload direction.
5. Add `.email()`, `.uuid()`, URL, number, date, and enum validation when column names or constraints clearly indicate them.
6. Avoid ambiguous `any` and implicit `unknown`.

## Evaluation

- Generated TypeScript must compile.
- Generated schema must avoid `any`.
- Required and nullable fields must match the database contract.

