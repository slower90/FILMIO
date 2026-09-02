---
name: Clerk public-domain proxy mode
description: How Clerk proxying must differ between development and production credentials on the split Pages/Worker deployment
---

Development Clerk keys should use Clerk's direct Frontend API path. The Cloudflare Worker proxy must remain disabled for development secrets; when production secrets are active, the Worker proxy should send Clerk the authorized public Pages hostname rather than its workers.dev hostname.

**Why:** Clerk rejects a development proxy request through the temporary workers.dev host with `host_invalid`, while production proxy validation is tied to the authorized public identity domain.

**How to apply:** Keep the Pages deployment free of a development proxy URL, forward Clerk session tokens explicitly to the separate Worker origin, and configure the Worker public proxy host before enabling production proxying.