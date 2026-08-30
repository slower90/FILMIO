---
name: Future cinema rollout
description: Phased visual/product direction for evolving FILMIO toward the attached future cinema OS brief.
---

The future-cinema direction should be shipped as phased, real-data product surfaces rather than a broad visual rewrite: start with the homepage discovery language, then deepen movie detail, social conversation, public cinema identity, and exploration tools.

The governing product idea is that cinema is a universe of stories, emotions, people, cultures, and memories—not a list of movie titles. FILMIO should invent its own interaction grammar around that idea instead of reproducing familiar ranking, feed, shelf, or review-platform conventions.

The future-facing visual language should not be expressed through accumulating gradients, glows, 3D, neon, animation, or panels. Effects are justified only when they explain hierarchy, state, navigation, readability, or emotional context.

FILMIO should grow through a reusable design system rather than one-off page styling. The shared vocabulary includes MovieCard, MovieHero, RatingRing, VScore, FilmDNA, ReviewCard, UserAvatar, ProfileHeader, TrendPulse, CinemaGraph, FilmOracle, SearchCommand, FilterRail, Timeline, WorldMap, SignalNotification, DiscussionPanel, TrailerPlayer, SpoilerBlock, TasteGraph, and GenreNode. Each shared component must account for desktop, tablet, mobile, hover, focus, loading, empty, and error states.

Only adopt a new component or visual treatment when it is a clear improvement over the current design; consistency and usefulness matter more than novelty.

**Why:** The brief is intentionally larger than one safe change, while FILMIO already has working discovery, social, auth, and profile infrastructure that should not be destabilized.

**How to apply:** Keep the FILMIO artifact paths, APIs, and persisted identity stable unless the user explicitly requests a brand migration; use the brief's concepts as progressive UI/product layers and never replace real data with decorative mock metrics.