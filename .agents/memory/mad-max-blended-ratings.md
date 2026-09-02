---
name: FILMIO canonical ratings
description: The visible rating is FILMIO's own Bayesian aggregate; external scores remain metadata only.
---

The UI should show only the FILMIO score. Use the platform's Bayesian weighted score when ratings exist and show an explicit empty state for unrated titles. Keep TMDB and other provider scores visibly labeled as reference metadata, never as FILMIO.

**Why:** The platform's trust model depends on separating FILMIO community judgment from third-party discovery signals.

**How to apply:** Keep the canonical score shared across hero, cards, Top 10, genre results, mobile detail, and movie detail; refresh platform stats after rating submissions.