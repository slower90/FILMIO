#!/bin/bash
set -e
# Merged task branches can update catalog declarations without a matching
# lockfile snapshot. Reconcile the workspace lockfile before rebuilding.
pnpm install --no-frozen-lockfile
pnpm --filter db push
