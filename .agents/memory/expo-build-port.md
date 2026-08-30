---
name: Expo build port isolation
description: Local Metro port behavior during static Expo production builds
---

Static Expo build scripts must not assume Metro can bind its default port; another preview service may already own it while the build is running.

**Why:** The workspace can run the mockup preview and Expo tooling concurrently, and Expo prompts interactively when its default port is occupied, which stalls noninteractive production validation.

**How to apply:** Reserve an available local Metro port before starting Expo and use that selected port consistently for health checks, bundle requests, manifests, and asset requests.

Expo SDK 54 startup can crash while fetching remote native-module metadata if the endpoint returns an empty body; `EXPO_OFFLINE=1` makes the CLI use its bundled dependency map while keeping localhost Metro available.

**Why:** The CLI's remote response was not valid JSON, but local dependency checks and Expo Doctor were healthy.

**How to apply:** Use `EXPO_OFFLINE=1` in the development command when the workspace's Expo metadata endpoint is unreliable; rerun `expo install --check` and `expo-doctor` separately to keep dependency validation explicit.