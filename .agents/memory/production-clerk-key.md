---
name: Production Clerk build guard
description: The production Pages build must use a live Clerk publishable key that matches the Worker authentication configuration.
---

Production deployments must reject a Clerk development publishable key before the Cloudflare Pages deploy step.

**Why:** A deployed pk_test bundle can render the application while signed-in API mutations fail or run against the wrong Clerk instance, making ratings and watchlist saves appear broken.

**How to apply:** Keep the CI check on the Pages build secret, and update the GitHub Actions secret to the production pk_live value before rerunning deployment. Never bypass the check just to publish frontend changes.