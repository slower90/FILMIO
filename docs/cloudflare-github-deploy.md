# Cloudflare deployment from GitHub

FILMIO production is deployed from the `main` branch through GitHub Actions:

1. Push a change to `main`.
2. GitHub Actions installs dependencies and builds the frontend.
3. The Cloudflare Worker is deployed.
4. The Cloudflare Pages project `filmio` is deployed.

The workflow is `.github/workflows/deploy-cloudflare.yml`. It deploys the frontend to
Cloudflare Pages and the API to `filmio-api-workers`.

## One-time GitHub setup

In the GitHub repository, open **Settings → Secrets and variables → Actions** and
create these repository secrets:

- `CLOUDFLARE_API_TOKEN` — a Cloudflare API token with permission to deploy Workers
  and Pages
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account ID
- `VITE_CLERK_PUBLISHABLE_KEY` — the Clerk publishable key used by the web bundle

The workflow validates these names before deploying and never stores their values
in the repository.

GitHub is the deployment trigger and source repository; it does not serve runtime
traffic. Users continue to reach the application through Cloudflare Pages and the
Cloudflare Worker.
