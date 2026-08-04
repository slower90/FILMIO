---
name: TMDB auth method
description: TMDB v3 API keys require api_key query param, not Bearer Authorization header
---

The user's TMDB key (stored as TMDB_API_KEY env var) is a v3 API key. V3 auth requires:

```typescript
url.searchParams.set("api_key", key);
const res = await fetch(url.toString()); // no Authorization header
```

V4 Bearer token auth (what was mistakenly used initially):
```typescript
headers: { Authorization: `Bearer ${key}` } // WRONG for v3 keys
```

**Why:** TMDB has two auth systems. V3 keys (32-char hex) go as ?api_key=... V4 access tokens (JWT) go as Bearer. The stored key is v3. Using Bearer returns 401.

**How to apply:** Any new TMDB fetch in the codebase must use the api_key query param pattern shown in artifacts/api-server/src/routes/movies.ts tmdbFetch().
