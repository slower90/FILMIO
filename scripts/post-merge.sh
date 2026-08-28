#!/bin/bash
set -e
# Merged task branches can update catalog declarations without a matching
# lockfile snapshot. Reconcile the workspace lockfile before rebuilding.
pnpm install --no-frozen-lockfile
if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 -f lib/db/migrations/0000_smart_search.sql
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 -f lib/db/migrations/0001_meilisearch.sql
  psql "$DATABASE_URL" --set ON_ERROR_STOP=1 -f lib/db/migrations/0002_performance_indexes.sql
fi
pnpm --filter db push
