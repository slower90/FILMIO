---
name: Post-merge setup timing
description: Timing constraint for the workspace's automatic post-merge reconciliation
---

The post-merge setup combines workspace dependency reconciliation with a database schema push, so its timeout must include both operations and a buffer.

**Why:** A healthy run can finish the database push successfully but still be killed by an overly aggressive timeout immediately afterward.

**How to apply:** Keep the setup script non-interactive and idempotent, and use a timeout of at least two minutes unless measured runtime and environment stability justify a smaller value.