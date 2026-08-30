---
name: Web API authentication across origins
description: Authenticated web API calls must forward the Clerk session token when the frontend and API are deployed on separate origins.
---

The web client must not rely only on browser session cookies for authenticated API mutations when the frontend and API can run on different origins. Configure the shared fetch layer with the current Clerk session-token getter; same-origin requests can still use cookies.

**Why:** Cookies scoped to the frontend origin are not automatically sent to a separately hosted API, so authenticated actions such as ratings can appear to work after login but receive an unauthenticated response.

**How to apply:** Keep the token getter bridge mounted inside `ClerkProvider` for web apps that use a separate API base URL, and retain explicit bearer-token coverage in shared fetch tests.