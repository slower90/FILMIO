---
name: Video.js wrapper styling
description: The DOM behavior to account for when styling Video.js players rendered through a data-vjs-player wrapper
---

When Video.js initializes a video inside a `data-vjs-player` wrapper, it can promote the wrapper to the player root and discard the wrapper's original class list. Styling hooks that need to survive initialization belong on an ancestor that remains outside the Video.js root.

**Why:** Player controls rendered correctly but appeared to ignore the app's scoped CSS because the class used as the selector ancestor disappeared during Video.js setup.

**How to apply:** For React Video.js players, keep component-specific layout/style classes on the persistent media container and use the `data-vjs-player` element only for Video.js lifecycle ownership.