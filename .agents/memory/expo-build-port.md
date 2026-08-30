---
name: Expo build port isolation
description: Local Metro port behavior during static Expo production builds
---

Static Expo build scripts must not assume Metro can bind its default port; another preview service may already own it while the build is running.

**Why:** The workspace can run the mockup preview and Expo tooling concurrently, and Expo prompts interactively when its default port is occupied, which stalls noninteractive production validation.

**How to apply:** Reserve an available local Metro port before starting Expo and use that selected port consistently for health checks, bundle requests, manifests, and asset requests.