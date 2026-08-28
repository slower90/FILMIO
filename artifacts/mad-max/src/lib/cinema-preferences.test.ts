import assert from "node:assert/strict";
import test from "node:test";
import { collectCinemaPreferenceOptions } from "./cinema-preferences";

test("builds explicit preference suggestions from catalog metadata", () => {
  const options = collectCinemaPreferenceOptions([
    {
      movie: {
        releaseDate: "2024-01-01",
        genres: [{ name: "Drama" }, { name: "Drama" }, { name: "Thriller" }],
        originalLanguage: "hi",
        productionCountries: ["India"],
      },
      credits: {
        cast: [{ name: "Asha Rao" }, { name: "Asha Rao" }],
        crew: [{ name: "Mira Sen", job: "Director" }],
      },
    },
    {
      movie: {
        releaseDate: "1999-01-01",
        genres: [{ name: "Thriller" }],
        originalLanguage: "en",
        productionCountries: ["United States"],
      },
      credits: {
        cast: [{ name: "Asha Rao" }],
        crew: [{ name: "Mira Sen", job: "Director" }],
      },
    },
  ]);

  assert.deepEqual(options.favoriteActor.slice(0, 2), ["Asha Rao"]);
  assert.deepEqual(options.favoriteDirector.slice(0, 2), ["Mira Sen"]);
  assert.deepEqual(options.favoriteGenre.slice(0, 2), ["Drama", "Thriller"]);
  assert.deepEqual(options.favoriteCountry, ["India", "United States"]);
  assert.deepEqual(options.favoriteDecade, ["1990s", "2020s"]);
  assert.deepEqual(options.favoriteLanguage, ["English", "Hindi"]);
});