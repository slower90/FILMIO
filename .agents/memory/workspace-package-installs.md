---
name: Workspace package installs
description: Package installation behavior for this pnpm monorepo
---

The generic Node package installer can resolve a dependency at the workspace root instead of the package that imports it. In a pnpm monorepo, install package dependencies against the owning workspace explicitly.

**Why:** A root install is rejected by pnpm's workspace-root safety check and does not update the intended artifact package.

**How to apply:** Identify the importing workspace first, then use its pnpm workspace filter for the package install and verify that workspace's package manifest and lockfile.