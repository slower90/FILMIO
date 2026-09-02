---
name: Cinema OS private sync
description: Durable privacy and migration rules for Cinema OS personal state
---

Cinema OS personal modules should remain private account data, scoped by both authenticated user and active viewing profile. Store them together so a save is an idempotent upsert, while keeping the existing device keys for signed-out use and one successful migration path.

**Why:** The modules are a personal cinema journal rather than public reviews. Profile scoping prevents one viewing profile from inheriting another profile's notes, and one-row upserts prevent repeated sign-in migrations from creating duplicates.

**How to apply:** Treat legacy device data as migration input only after the authenticated profile state has been fetched. Prefer existing remote notes/pairings and maximum progress, then mark migration complete and remove the legacy global keys only after the remote write succeeds. Keep account/profile-scoped local fallback separate from the legacy keys.