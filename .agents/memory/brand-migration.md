---
name: Brand migration compatibility
description: Safe approach for changing the product name without breaking deployed references or existing user data
---

Visible product branding can change independently from technical identifiers. Preserve artifact/package paths, deployment routes, and persisted storage keys during a rebrand unless a deliberate migration is planned.

**Why:** Renaming technical paths or local storage keys can break deployment references and make existing users lose saved data even when the change is only cosmetic.

**How to apply:** Update visible copy, metadata, assets, and display fonts first; treat internal identifiers as compatibility-sensitive and rename them only with an explicit migration plan.