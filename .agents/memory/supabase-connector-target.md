---
name: Supabase connector target
description: Replit Supabase connector behavior when its project target is not correctly configured
---

An attached Supabase connector is not usable for application data access until `/rest/v1/...` returns PostgREST JSON from the selected project. A 404 response containing Supabase dashboard HTML indicates the connector target/configuration is unresolved; it is not evidence that the application table is missing.

**Why:** The connector can report `added` and still route requests to the Supabase dashboard rather than the project API, so coding against it would create a broken runtime integration.

**How to apply:** Verify or reconnect the Supabase integration with the correct project target/API configuration, then test a known PostgREST path before migrating application reads, writes, or Storage calls.

Railway's Supabase production database can be missing the application's entire Drizzle schema even when the Replit development database is populated; verify the exact production pooler database independently before diagnosing route SQL.

**Why:** The workspace `DATABASE_URL` may resolve to a separate development database, so local table checks can falsely suggest production is healthy.

**How to apply:** Query `information_schema` on the exact Railway/Supabase target, preserve runtime-only tables, and apply only the reviewed additive schema before retesting the compiled API against that same target.