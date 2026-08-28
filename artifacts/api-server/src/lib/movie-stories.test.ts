import assert from "node:assert/strict";
import test from "node:test";
import { getMovieStory, storyForMovie } from "./movie-stories";

const baseInput = {
  id: 27205,
  title: "Inception",
  mediaType: "movie" as const,
  releaseDate: "2010-07-16",
  posterPath: "/poster.jpg",
  backdropPath: "/backdrop.jpg",
  overview: "A thief who steals corporate secrets through dream-sharing technology is given an inverse task.",
  tagline: "Your mind is the scene of the crime.",
  runtime: 148,
  genres: [{ id: 878, name: "Science Fiction" }],
  imdbId: "tt1375666",
  cast: [{ id: 6193, name: "Leonardo DiCaprio" }],
  crew: [
    { id: 525, name: "Christopher Nolan", job: "Director" },
    { id: 525, name: "Christopher Nolan", job: "Writer" },
  ],
  productionCompanies: ["Warner Bros. Pictures"],
  productionCountries: ["United Kingdom", "United States"],
  originalLanguage: "en",
  budget: 160000000,
  revenue: 839000000,
  catalogStatus: "Released",
  trailerUrl: "https://www.youtube.com/watch?v=YoHD9XEInc0",
  updatedAt: "2026-08-26T00:00:00.000Z",
};

test("builds a ready story with source attribution and verified title metadata", () => {
  const story = storyForMovie({
    ...baseInput,
    wikipedia: {
      extract: "Inception is a 2010 science fiction action film written and directed by Christopher Nolan.",
      url: "https://en.wikipedia.org/wiki/Inception",
    },
  });

  assert.equal(story.status, "ready");
  assert.equal(story.movie.title, "Inception");
  assert.equal(story.movie.releaseDate, "2010-07-16");
  assert.equal(story.sections.length, 4);
  assert.match(story.headline, /people and craft/);
  assert.match(story.sections[0]?.body[0] ?? "", /Inception/);
  assert.match(story.sections.find((section) => section.id === "the-people")?.body.join(" ") ?? "", /Christopher Nolan/);
  assert.ok(story.topics.some((topic) => topic.href === "/actors/525"));
  assert.ok(story.topics.some((topic) => topic.href === "/genre/878"));
  assert.deepEqual(
    story.sources.map((source) => source.name),
    ["TMDB", "Wikipedia", "IMDb", "Official trailer"],
  );
});

test("adds a history chapter only for documented reference context", () => {
  const story = storyForMovie({
    ...baseInput,
    wikipedia: {
      extract: "Inception is a 2010 science fiction film. It premiered at the 2010 London Film Festival and was nominated for eight Academy Awards.",
      url: "https://en.wikipedia.org/wiki/Inception",
    },
  });

  const history = story.sections.find((section) => section.id === "the-history");
  assert.ok(history);
  assert.match(story.headline, /history/);
  assert.match(history.body.join(" "), /London Film Festival/);
  assert.match(history.body.join(" "), /Academy Awards/);
  assert.equal(story.topics.find((topic) => topic.kind === "country")?.href, "/search?q=United%20Kingdom");
});

test("returns a partial story without inventing missing source context", () => {
  const story = storyForMovie({
    ...baseInput,
    overview: "",
    wikipedia: null,
    imdbId: null,
    trailerUrl: null,
  });

  assert.equal(story.status, "partial");
  assert.equal(story.sources.length, 1);
  assert.equal(story.sources[0]?.name, "TMDB");
  assert.equal(story.movie.overview, "");
  assert.ok(story.sections.every((section) => section.body.every((paragraph) => paragraph.length > 0)));
  assert.equal(story.sections.some((section) => section.id === "the-history"), false);
});

test("marks a catalog-only story partial when Wikipedia is unavailable", async () => {
  const movieId = 920001;
  const story = await getMovieStory({
    ...baseInput,
    id: movieId,
    fetchCatalog: async () => ({
      id: movieId,
      title: baseInput.title,
      overview: baseInput.overview,
      release_date: baseInput.releaseDate,
      genres: baseInput.genres,
      credits: { cast: baseInput.cast, crew: baseInput.crew },
    }),
    fetchWikipedia: async () => null,
  });

  assert.equal(story.status, "partial");
  assert.deepEqual(story.sources.map((source) => source.name), ["TMDB"]);
  assert.doesNotMatch(JSON.stringify(story), /Wikipedia/);
});

test("does not credit Wikipedia when its summary lookup fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("opensearch")) {
      return Response.json(["Inception", ["Inception"], [], []]);
    }
    return new Response("Wikipedia unavailable", { status: 503 });
  }) as typeof fetch;

  try {
    const movieId = 920002;
    const story = await getMovieStory({
      ...baseInput,
      id: movieId,
      fetchCatalog: async () => ({
        id: movieId,
        title: baseInput.title,
        overview: baseInput.overview,
        release_date: baseInput.releaseDate,
        genres: baseInput.genres,
        credits: { cast: baseInput.cast, crew: baseInput.crew },
      }),
    });

    assert.equal(story.status, "partial");
    assert.deepEqual(story.sources.map((source) => source.name), ["TMDB"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps a partial story and its sources stable across retries", async () => {
  const movieId = 920003;
  let wikipediaAvailable = false;
  let catalogCalls = 0;
  const fetchCatalog = async () => {
    catalogCalls += 1;
    return {
      id: movieId,
      title: baseInput.title,
      overview: baseInput.overview,
      release_date: baseInput.releaseDate,
      genres: baseInput.genres,
      credits: { cast: baseInput.cast, crew: baseInput.crew },
    };
  };
  const options = {
    ...baseInput,
    id: movieId,
    fetchCatalog,
    fetchWikipedia: async () =>
      wikipediaAvailable
        ? { extract: "Inception is a science fiction film.", url: "https://en.wikipedia.org/wiki/Inception" }
        : null,
  };

  const first = await getMovieStory(options);
  wikipediaAvailable = true;
  const retry = await getMovieStory(options);

  assert.equal(first.status, "partial");
  assert.deepEqual(retry, first);
  assert.equal(catalogCalls, 1);
});

test("serves the last story during a stale catalog outage, then becomes unavailable", async () => {
  let clock = 1_000;
  const movieId = 920004;
  const fetchCatalog = async () => ({
    data: {
      id: movieId,
      title: baseInput.title,
      overview: baseInput.overview,
      release_date: baseInput.releaseDate,
      genres: baseInput.genres,
      credits: { cast: baseInput.cast, crew: baseInput.crew },
    },
    source: "tmdb",
    fetchedAt: "2026-08-26T00:00:00.000Z",
    stale: false,
  });
  const options = {
    ...baseInput,
    id: movieId,
    fetchCatalog,
    fetchWikipedia: async () => ({
      extract: "Inception is a science fiction film.",
      url: "https://en.wikipedia.org/wiki/Inception",
    }),
    now: () => clock,
    storyTtlMs: 10,
    storyStaleTtlMs: 100,
  };

  const first = await getMovieStory(options);
  clock += 20;
  const stale = await getMovieStory({
    ...options,
    fetchCatalog: async () => ({
      ...(await fetchCatalog()),
      stale: true,
    }),
  });

  assert.deepEqual(stale, first);
  assert.equal(stale.status, "ready");
  assert.deepEqual(stale.sources.map((source) => source.name), ["TMDB", "Wikipedia"]);

  clock += 100;
  await assert.rejects(
    getMovieStory({
      ...options,
      fetchCatalog: async () => {
        throw new Error("catalog outage");
      },
    }),
    /catalog outage/,
  );
});