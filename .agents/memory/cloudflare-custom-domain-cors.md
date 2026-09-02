---
name: Cloudflare custom-domain CORS
description: Separate Pages custom domains must be allow-listed on the Worker for browser API and auth requests
---

Every frontend hostname attached to Cloudflare Pages, including both the apex domain and its `www` alias, must be present in the Worker CORS origin list. A Pages site can load normally while cross-origin API requests fail if one alias is missing.

**Why:** The `www` alias initially served the frontend successfully but its authenticated API preflight was rejected because only the apex and pages.dev origins were configured.

**How to apply:** When attaching or changing a Pages custom domain, add each browser-facing hostname to the Worker CORS origins before testing Clerk sessions or protected API mutations.