---
name: Static route SEO
description: Production static hosting needs route HTML generation beyond client-side Helmet
---

Client-side Helmet updates and Vite's request-time HTML transform are not enough when the deployed web artifact serves one static index file for every route. For static hosting, emit route-specific `.html` files during the build and map extensionless public paths to them with ordered wildcard rewrites before the SPA fallback.

**Why:** Crawlers and social link unfurlers may read the homepage title, canonical, and structured data for movie, actor, genre, and journal URLs instead of executing the React app.

**How to apply:** Before treating dynamic page SEO as production-ready, generate route-specific HTML during the build or move those routes behind an SSR/dynamic HTML service, then verify raw production responses rather than only browser-rendered metadata. Keep generation behind a build-command guard: Vite can run `closeBundle` during dev restarts, and per-route API fetches can exhaust public rate limits. For large catalogs, fetch the catalog once and reuse it while generating item pages. Replit static rewrites skip existing files; the generator's nested `index.html` layout must match the artifact wildcard rewrite contract exactly.