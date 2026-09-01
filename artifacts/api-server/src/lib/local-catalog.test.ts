import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import {
  catalogMoviesTable,
  db,
} from "@workspace/db";
import {
  buildLocalMovieId,
  findLocalCatalogMovieByTitle,
  isManagedMovieTitle,
  localCatalogMovieToRaw,
  persistLocalCatalogMovie,
  resolveManagedMovieTitle,
} from "./local-catalog";

const metadata = (source: string) => ({
  source,
  fetchedAt: "2026-09-01T00:00:00.000Z",
  stale: false,
});

test("recognizes the managed title with punctuation differences", () => {
  assert.equal(isManagedMovieTitle("the vvaan: force of the forest"), true);
  assert.equal(isManagedMovieTitle("A different forest film"), false);
});

test("allocates stable numeric ids in the isolated local namespace", () => {
  const first = buildLocalMovieId("omdb", "tt1234567");
  const second = buildLocalMovieId("manual", "manual:the vvaan force of the forest");
  assert.equal(Number.isInteger(first), true);
  assert.equal(first >= 1_500_000_000 && first < 2_000_000_000, true);
  assert.equal(second >= 1_500_000_000 && second < 2_000_000_000, true);
  assert.notEqual(first, second);
});

test("keeps an exact primary match on the normal TMDB id", async () => {
  const title = "Primary Exact Match Test";
  const result = await resolveManagedMovieTitle(title, {
    managedTitles: [title],
    primaryFetch: async () => ({
      data: {
        results: [{
          id: 987654,
          title,
          release_date: "2027-01-01",
        }],
      },
      ...metadata("tmdb"),
    }),
    fallbackFetch: async () => {
      throw new Error("fallback should not be called");
    },
  });

  assert.equal(result?.raw.id, 987654);
  assert.equal(result?.metadata.source, "tmdb");
  assert.equal(result?.local, null);
});

test("persists fallback metadata and reuses it through the local catalog", async (t) => {
  const title = "Local Catalog Fallback Test";
  const sourceId = "tt7654321-local-catalog-test";

  try {
    try {
      await db.select({ id: catalogMoviesTable.id }).from(catalogMoviesTable).limit(1);
    } catch {
      t.skip("development catalog_movies table is not available");
      return;
    }

    const persisted = await persistLocalCatalogMovie({
      source: "omdb",
      sourceId,
      mediaType: "movie",
      title,
      normalizedTitle: "local catalog fallback test",
      posterPath: "https://img.test/local-catalog.jpg",
      backdropPath: null,
      overview: "A persisted fallback record.",
      releaseDate: "2027-01-01",
      runtime: 120,
      genres: [{ id: 1, name: "Drama" }],
      credits: {
        cast: [{ id: -1, name: "Actor One", character: "" }],
        crew: [{ id: -101, name: "Director One", job: "Director", department: "Directing" }],
      },
      voteAverage: 7.5,
      voteCount: 765,
      tagline: null,
      status: "",
      budget: 0,
      revenue: 0,
      imdbId: "tt7654321",
      isUpcoming: true,
      metadata: { provider: "omdb" },
    });

    assert.ok(persisted);
    assert.equal(persisted.source, "omdb");
    assert.equal(persisted.id >= 1_500_000_000, true);
    assert.deepEqual(localCatalogMovieToRaw(persisted), localCatalogMovieToRaw(
      (await findLocalCatalogMovieByTitle(title))!,
    ));
  } finally {
    await db.delete(catalogMoviesTable).where(eq(catalogMoviesTable.sourceId, sourceId)).catch(() => undefined);
  }
});