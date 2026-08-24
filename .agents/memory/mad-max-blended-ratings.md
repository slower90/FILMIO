---
name: MAD MAX blended ratings
description: The visible rating combines a TMDB baseline with MAD MAX user ratings while exposing only the MAD MAX brand.
---

The UI should always show a MAD MAX score. Before platform ratings exist, use the TMDB 0–10 vote average as the baseline; once user ratings exist, display the average of the TMDB baseline and MAD MAX user average. Never expose TMDB as a separate visible rating source.

**Why:** The product needs a useful score immediately while keeping MAD MAX as the only rating identity users see.

**How to apply:** Keep the blend calculation shared across hero, cards, Top 10, genre results, and movie detail, and refresh the platform stats after a rating submission.