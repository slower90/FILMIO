---
name: Craft dimension signals
description: The Cinema Fingerprint derives transparent craft signals from FILMIO ratings/reviews and public Reddit discussion
---

Craft dimensions are evidence-based auto-signals, not seven manually invented scores: FILMIO ratings/review text and public Reddit discussion are combined, while unavailable Reddit data stays an explicit empty state.

**Why:** The score should update as community data arrives without presenting third-party ratings as FILMIO's own audience score or fabricating evidence for titles with no signal.

**How to apply:** Keep the source counts, Reddit links, refresh state, and confidence visible; use bounded polling/cache refresh and preserve a neutral/empty fallback when providers are unavailable.