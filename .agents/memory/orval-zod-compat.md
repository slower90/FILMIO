---
name: Orval Zod compatibility
description: Monorepo code generation can emit Zod 4 shorthand against the shared Zod 3 runtime
---

The workspace uses Zod 3, while the installed Orval generator may emit Zod 4-only helpers such as top-level integer and URL constructors. Pin Orval's Zod output target explicitly to 3.

**Why:** Regenerating the API contract can otherwise make server tests fail during module import even when the application code and API contract are valid.

**How to apply:** After OpenAPI codegen, verify generated api-zod output against the installed Zod version. Keep the explicit generator pin until the monorepo can migrate Zod versions together.

The api-zod public barrel should export generated validators from `generated/api` only; exporting both generated API and generated type barrels can redeclare parameter symbols after Orval regeneration.

**Why:** Orval can place overlapping parameter exports in both generated surfaces, making a clean shared-library typecheck fail even though the individual generated files are valid.

**How to apply:** If regeneration recreates a duplicate-export error, preserve direct generated type files but remove the overlapping type barrel export from `lib/api-zod/src/index.ts`, then run the shared library typecheck.

The codegen command can recreate that barrel export, so the workspace runs a small post-generation normalizer that removes only the conflicting root export before typechecking.

**Why:** A clean fix can appear to have no effect when the next Orval run restores the conflicting export.

**How to apply:** Keep the normalizer in the API spec codegen path; do not rely on a manual cleanup after regeneration.