---
name: Deleted artifact dependency overrides
description: Local package overrides can keep a workspace from installing after an artifact directory is removed
---

When restoring a deleted workspace artifact, check root-level package overrides and lockfile references for local paths owned by that artifact, and restore those targets before reinstalling.

**Why:** pnpm resolves local override paths during installation even when the package is only used transitively, so a missing target can block every workspace package from installing.

**How to apply:** Search `package.json`, workspace manifests, and the lockfile for the artifact slug and local `file:` targets before declaring the restored package ready.