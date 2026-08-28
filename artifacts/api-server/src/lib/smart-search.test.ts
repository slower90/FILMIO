import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SMART_SEARCH_LIMIT,
  MAX_SMART_SEARCH_LIMIT,
  TRIGRAM_SIMILARITY_THRESHOLD,
  parseSearchIntent,
  textSimilarity,
} from "./smart-search";

test("parses a misspelled Malayalam language request", () => {
  const intent = parseSearchIntent("malyalm movie", ["Malayalam", "English"]);
  assert.equal(intent.language, "Malayalam");
  assert.equal(intent.languageCode, "ml");
  assert.equal(intent.residual, "");
  assert.equal(intent.sort, "rating");
});

test("keeps a misspelled movie title as the fuzzy residual", () => {
  const intent = parseSearchIntent("Intersteller");
  assert.equal(intent.residual, "intersteller");
  assert.equal(intent.language, null);
  assert.equal(intent.genre, null);
});

test("extracts a bounded anime ranking request", () => {
  const intent = parseSearchIntent("top 10 anime");
  assert.equal(intent.anime, true);
  assert.equal(intent.limit, 10);
  assert.equal(intent.sort, "rating");
  assert.equal(intent.residual, "");
  assert.ok(intent.limit <= MAX_SMART_SEARCH_LIMIT);
});

test("uses the default rating limit for best-of-best requests", () => {
  const intent = parseSearchIntent("best of best");
  assert.equal(intent.limit, DEFAULT_SMART_SEARCH_LIMIT);
  assert.equal(intent.sort, "rating");
  assert.equal(intent.residual, "");
});

test("recognizes recency intent without treating it as a title", () => {
  const intent = parseSearchIntent("latest Malayalam movies");
  assert.equal(intent.language, "Malayalam");
  assert.equal(intent.sort, "recent");
  assert.equal(intent.residual, "");
});

test("accepts a reasonable fuzzy language spelling but rejects unrelated text", () => {
  assert.ok(textSimilarity("malaylaam", "Malayalam") >= 0.7);
  assert.ok(textSimilarity("malyalm", "Malayalam") >= TRIGRAM_SIMILARITY_THRESHOLD);
  assert.ok(textSimilarity("spaceship nonsense", "Malayalam") < TRIGRAM_SIMILARITY_THRESHOLD);
});