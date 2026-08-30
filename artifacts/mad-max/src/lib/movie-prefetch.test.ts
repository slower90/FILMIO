import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getMovieOverviewQueryKey,
  prefetchMovieOverview,
} from "./movie-prefetch";

test("movie overview keys keep movie and TV caches separate", () => {
  assert.deepEqual(getMovieOverviewQueryKey(42, "movie"), ["movie-overview", 42, "movie"]);
  assert.deepEqual(getMovieOverviewQueryKey(42, "tv"), ["movie-overview", 42, "tv"]);
});

test("movie overview prefetch skips cached and in-flight queries", async () => {
  const calls: unknown[] = [];
  const queryClient = {
    getQueryState: (key: readonly unknown[]) =>
      key[2] === "tv" ? { data: { movie: {} } } : { fetchStatus: "fetching" },
    prefetchQuery: (options: unknown) => {
      calls.push(options);
      return Promise.resolve();
    },
  };

  await prefetchMovieOverview(queryClient as never, 42, "movie");
  await prefetchMovieOverview(queryClient as never, 42, "tv");

  assert.equal(calls.length, 0);
});

test("movie overview prefetch uses the exact route query key", async () => {
  let options: { queryKey?: readonly unknown[] } | undefined;
  const queryClient = {
    getQueryState: () => undefined,
    prefetchQuery: (next: { queryKey?: readonly unknown[] }) => {
      options = next;
      return Promise.resolve();
    },
  };

  await prefetchMovieOverview(queryClient as never, 84, "tv");

  assert.deepEqual(options?.queryKey, ["movie-overview", 84, "tv"]);
});