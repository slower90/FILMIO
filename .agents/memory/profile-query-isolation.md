---
name: Profile query isolation
description: Prevent stale viewing-profile data from crossing authenticated account changes in client query caches.
---

Viewing-profile query caches must be cleared or keyed by the authenticated account whenever Clerk identity changes; a stable query key can otherwise render the previous account's profiles before the refetch finishes.

**Why:** Profile data is private account-owned state, so even a brief stale render during account switching is an isolation bug rather than a cosmetic cache issue.

**How to apply:** When adding account-scoped React Query resources, reset the active selection and remove or user-scope the cached query on sign-in, sign-out, and account changes.