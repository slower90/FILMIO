---
name: Browse query routing
description: Query-string behavior for Wouter routes in the web artifact
---

Wouter's `useLocation()` may expose only the pathname for this artifact, so pages whose state is encoded in query parameters must also read `window.location.search`.

**Why:** Direct preview verification showed a collection query silently falling back to the default listing when only the Wouter location value was parsed.

**How to apply:** Keep the pathname in `useLocation()` for navigation state, but use the browser search string for collection/filter parsing and query keys.