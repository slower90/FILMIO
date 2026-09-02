import test from "node:test";
import assert from "node:assert/strict";
import { getPrismDisplayRating } from "./mad-max-ratings";

test("keeps external ratings out of the FILMIO score", () => {
  assert.equal(getPrismDisplayRating(8.4, undefined), 0);
});

test("prefers the canonical Bayesian score over the raw average", () => {
  assert.equal(
    getPrismDisplayRating(8.4, {
      averageRating: 9.2,
      totalRatings: 3,
      weightedScore: 7.6,
    }),
    7.6,
  );
});

test("falls back to the platform average for older rating payloads", () => {
  assert.equal(
    getPrismDisplayRating(8.4, {
      averageRating: 7.1,
      totalRatings: 4,
      weightedScore: 0,
    }),
    7.1,
  );
});