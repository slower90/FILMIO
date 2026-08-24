import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalogStatusMessage } from "./catalog-status-notice";

test("does not announce fresh catalog data", () => {
  assert.equal(getCatalogStatusMessage({ source: "tmdb", fetchedAt: "2026-08-22T00:00:00.000Z", stale: false }), null);
});

test("announces cached and partial catalog data", () => {
  assert.match(getCatalogStatusMessage({ source: "cache", fetchedAt: "2026-08-22T00:00:00.000Z", stale: true }) ?? "", /cached/);
  assert.match(getCatalogStatusMessage({ source: "tmdb", fetchedAt: "2026-08-22T00:00:00.000Z", stale: false, partial: true }) ?? "", /incomplete/);
});

test("announces unavailable catalog metadata", () => {
  assert.match(getCatalogStatusMessage({ source: "unavailable", fetchedAt: "1970-01-01T00:00:00.000Z" }) ?? "", /unavailable/);
});