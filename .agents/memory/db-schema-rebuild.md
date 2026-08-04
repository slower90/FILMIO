---
name: DB schema rebuild after new tables
description: After adding schema files to lib/db/src/schema/, typecheck:libs must run before api-server can typecheck
---

The lib/db package uses TypeScript project references. When new tables/exports are added to lib/db/src/schema/index.ts, the declaration files (.d.ts) must be rebuilt before downstream packages (api-server) can see the new exports.

**Command:** `pnpm run typecheck:libs` (runs `tsc --build` at workspace root)

**Why:** api-server imports from @workspace/db which resolves to lib/db/dist or tsconfig path aliases. Without rebuilding, TS sees the old declarations and reports "Module has no exported member 'xTable'" errors.

**How to apply:** Any time a new table is added to lib/db/src/schema/, run typecheck:libs first, then typecheck the api-server.
