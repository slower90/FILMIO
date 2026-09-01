import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCraftDimensions,
  calculateFilmioAutoScore,
  searchRedditDiscussions,
} from "./craft-dimensions";

test("calculates a FILMIO auto score from the existing blended rating rules", () => {
  assert.equal(
    calculateFilmioAutoScore({ baselineScore: 8, averageRating: 6, totalRatings: 2 }),
    7,
  );
  assert.equal(
    calculateFilmioAutoScore({ baselineScore: 0, averageRating: 7.25, totalRatings: 1 }),
    7.3,
  );
  assert.equal(
    calculateFilmioAutoScore({ baselineScore: 0, averageRating: 0, totalRatings: 0 }),
    0,
  );
});

test("derives craft dimensions from FILMIO review text and Reddit discussion", () => {
  const dimensions = calculateCraftDimensions({
    overallScore: 7.4,
    filmioRatings: { averageRating: 7.4, totalRatings: 4 },
    filmioReviews: [
      {
        text: "The writing and performances are strong, with beautiful cinematography and a moving emotional payoff.",
        rating: 8,
        weight: 1,
      },
    ],
    redditPosts: [
      {
        title: "A fresh and original visual experience",
        snippet: "The sound design is excellent too.",
        subreddit: "r/movies",
        score: 20,
        comments: 8,
        url: "https://www.reddit.com/r/movies/example",
      },
    ],
  });
  const story = dimensions.find((dimension) => dimension.key === "Story");
  const visuals = dimensions.find((dimension) => dimension.key === "Visuals");
  assert.ok(story);
  assert.ok(visuals);
  assert.notEqual(story.score, null);
  assert.notEqual(visuals.score, null);
  assert.equal(story.confidence, "emerging");
  assert.ok((visuals.evidenceCount ?? 0) > 0);
});

test("returns an honest empty Reddit state when the public search is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
  try {
    const result = await searchRedditDiscussions("FILMIO test title with no cache");
    assert.deepEqual(result, { posts: [], status: "unavailable" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});