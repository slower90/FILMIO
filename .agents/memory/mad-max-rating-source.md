---
name: MAD MAX rating source
description: The product UI must show only platform-owned ratings, never third-party score values.
---

The MAD MAX interface uses the average of platform ratings on the existing 1–10 scale as its only displayed rating. TMDB and other providers remain metadata/discovery sources only; unrated titles show an explicit empty state rather than a fallback score.

**Why:** The product decision is to make MAD MAX reviews and ratings the single source of truth for visible title scores.

**How to apply:** Keep external score fields out of presentation components, and use the platform rating stats endpoint for cards, search, hero, lists, and detail pages.