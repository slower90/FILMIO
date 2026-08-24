---
name: Movie detail request bundling
description: Performance convention for movie detail pages and TMDB-backed hero data
---

Movie detail’s above-the-fold data should come from one server endpoint that uses TMDB `append_to_response` for credits, videos, and watch providers. Keep ratings, reviews, recommendations, and genre rows non-blocking.

**Why:** TMDB-backed requests can each take several seconds; making the browser wait on multiple independent detail requests makes navigation feel stalled even when the requests are parallel.

**How to apply:** When adding hero-critical movie metadata, extend the combined overview response rather than adding another browser request. Cache the combined query on the client with a finite stale time.