---
name: External Clerk deployments
description: Replit-managed Clerk behavior when the frontend is built and hosted outside Replit
---

Replit-managed Clerk's automatic development-to-production key handling is tied to Replit's own published deployment flow. An external Railway build can bake a `pk_test` key unless its production Clerk configuration is supplied separately.

**Why:** A Railway-served FILMIO bundle was healthy at the HTTP layer but contained a development publishable key, while the local preview showed the expected development-key warning. The external host therefore cannot be treated as equivalent to a Replit publish.

**How to apply:** For Railway, either use the supported Replit publishing path for managed Clerk or configure a matching external production Clerk setup at build/runtime, including frontend and backend keys and the deployed domain. Never paste key values into chat.