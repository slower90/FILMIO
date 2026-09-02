---
name: Worker Hyperdrive connection lifecycle
description: Cloudflare Worker database access through Hyperdrive and node-postgres
---

Cloudflare Workers should not reuse the shared Node `pg.Pool` for Hyperdrive-backed requests. Use a short-lived `pg.Client` for each query, and keep one client only for the duration of a Drizzle transaction.

**Why:** A global pool appeared healthy on isolated requests but accumulated suspended/stale connections as the Worker handled several route groups, causing intermittent 1101 hangs across unrelated database routes.

**How to apply:** Keep the native `pg.Pool` for Railway/Node, but select a client-per-query adapter when the Worker bootstrap marks the runtime. Re-test with a warm multi-route request matrix, not only a fresh health check.