---
name: Catalog resilience
description: The catalog transport's provider and cache contract for future upstream integrations
---

The catalog transport keeps route contracts stable while allowing an ordered primary and configured compatible fallback. The fallback is intentionally opt-in through environment configuration so no unapproved provider or credential is introduced.

**Why:** Catalog outages should degrade to a compatible source or bounded last-known-good data without changing every frontend caller.

**How to apply:** Keep adapters provider-specific at the transport boundary, validate object envelopes and non-empty result pages, and preserve primary fields when merging fallback or paginated records.

Catalog provider base URLs may include a required path prefix; normalize incoming route paths before URL resolution so leading slashes do not discard that prefix.

**Why:** The URL constructor treats a leading slash as host-rooted, which can turn a valid versioned API endpoint into a misleading 404.

**How to apply:** Strip leading slashes from catalog route paths in the shared URL builder, and keep a regression test for a versioned base URL.