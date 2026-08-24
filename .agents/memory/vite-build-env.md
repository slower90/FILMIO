---
name: Vite build environment
description: Required environment variables for building the MAD MAX Vite artifact locally.
---

Development runs still require `PORT` and `BASE_PATH`; production builds use safe artifact-specific defaults when those variables are absent.

**Why:** Managed workflows supply both values, while workspace builds run without workflow-injected environment variables.

**How to apply:** Use the managed workflow for development; local production builds can run directly through the workspace build command.