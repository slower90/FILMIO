---
name: Cloudflare credential handling
description: Replit Secrets are presence-only to the agent and may be redacted in shell commands; Cloudflare API-key connector access must be refreshed separately.
---

Cloudflare deployment credentials should be supplied through the connected Cloudflare integration for agent-side API work, not copied from chat into shell commands. Replit Secrets can be stored for runtime use, but the agent may only see a redacted placeholder when invoking Wrangler directly.

**Why:** A valid-looking token stored as a Replit Secret was unavailable as its real value to the agent shell, while the attached API-key connector retained an older invalid credential.

**How to apply:** For Pages or Workers deployment, have the user refresh the Cloudflare integration connection with a valid account token and use its authenticated proxy. Keep `CLOUDFLARE_API_TOKEN` as a runtime secret only; never print, inspect, or hardcode it.