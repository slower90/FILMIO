---
name: Optional-auth route tests
description: Express route tests that exercise Clerk getAuth must register Clerk middleware before mounting the route.
---

Optional-auth middleware still calls Clerk's getAuth, which throws if clerkMiddleware has not run first, even for anonymous requests.

**Why:** Directly mounting a router that uses optionalAuth produces a misleading 500 in tests instead of exercising the anonymous path.

**How to apply:** Add clerkMiddleware() to the test Express app before mounting routes that use optionalAuth or requireAuth; mock upstream fetches separately.