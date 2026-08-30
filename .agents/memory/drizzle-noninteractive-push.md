---
name: Drizzle noninteractive pushes
description: Environment behavior when applying additive Drizzle schema changes from noninteractive workflows
---

Drizzle Kit can stop both regular and force PostgreSQL pushes on a named-schema conflict when no TTY is available, even when the new table names are unused. This database also has no Drizzle migration journal, so raw SQL migrations should run directly rather than through `drizzle-kit migrate`.

**Why:** The repository's database push scripts run through noninteractive tooling, so a schema change can appear blocked despite a clean typecheck and an additive diff; a migration command that assumes Drizzle journal metadata will fail before applying SQL.

**How to apply:** Check the development schema before choosing a recovery path; apply checked-in idempotent SQL for prerequisites/additive objects, avoid guessing at renames or destructive changes, and keep the Drizzle schema aligned with any additive database change that is applied.