---
name: Local API preview proxy
description: Why local FILMIO previews route API calls through Vite instead of calling the separate Railway origin directly
---

Local FILMIO previews should use a same-origin Vite `/api` proxy and must not apply the configured absolute Railway API base while running on localhost or 127.0.0.1. Deployed frontend bundles can continue using the configured absolute API origin.

**Why:** Replit preview origins are ephemeral and are not necessarily included in Railway's production CORS allowlist. Direct browser calls then fail with opaque CORS network errors and make catalog sections appear empty even when the API is healthy.

**How to apply:** Detect local preview hostnames in both generated API-client setup and manual API URL helpers; keep the Vite proxy target pointed at the configured API origin.