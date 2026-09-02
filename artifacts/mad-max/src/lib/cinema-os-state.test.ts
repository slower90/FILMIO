import assert from "node:assert/strict";
import test from "node:test";
import {
  getGetTrendingMoviesQueryKey,
  getGetTrendingMoviesUrl,
} from "@workspace/api-client-react";
import {
  CINEMA_OS_TEST_IDS,
  getProfileActivityState,
  readCinemaLocal,
  saveCinemaLocal,
  type ProfileActivitySnapshot,
} from "./cinema-os-state";

const storageValues = new Map<string, string>();
const storage = {
  getItem: (key: string) => storageValues.get(key) ?? null,
  setItem: (key: string, value: string) => storageValues.set(key, value),
};

const defaultProfileSnapshot: ProfileActivitySnapshot = {
  isSignedIn: true,
  isReady: true,
  historyLoading: false,
  ratingsLoading: false,
  watchlistLoading: false,
  historyError: false,
  ratingsError: false,
  watchlistError: false,
  watchedCount: 0,
  ratedCount: 0,
  queuedCount: 0,
};

test("reads valid local state and safely falls back for malformed values", () => {
  storageValues.set("valid", JSON.stringify({ note: "remember this" }));
  assert.deepEqual(
    readCinemaLocal(storage, "valid", { note: "" }, (value): value is { note: string } =>
      Boolean(value && typeof value === "object" && "note" in value && typeof value.note === "string"),
    ),
    { note: "remember this" },
  );

  storageValues.set("malformed", "{not-json");
  assert.deepEqual(readCinemaLocal(storage, "malformed", { note: "" }, () => false), { note: "" });
  storageValues.set("wrong-shape", JSON.stringify(["not", "a", "note"]));
  assert.deepEqual(readCinemaLocal(storage, "wrong-shape", { note: "" }, () => false), { note: "" });
  assert.equal(readCinemaLocal(undefined, "server", "fallback", (value): value is string => typeof value === "string"), "fallback");
});

test("saves local state as JSON under the requested key", () => {
  saveCinemaLocal(storage, "afterglow", {
    movieId: 84,
    movieTitle: "Local film",
    note: "The ending stayed with me.",
  });
  assert.equal(
    storageValues.get("afterglow"),
    JSON.stringify({
      movieId: 84,
      movieTitle: "Local film",
      note: "The ending stayed with me.",
    }),
  );
});

test("profile activity keeps signed-out, loading, error, empty, and ready states distinct", () => {
  assert.equal(getProfileActivityState({ ...defaultProfileSnapshot, isSignedIn: false }), "signed-out");
  assert.equal(getProfileActivityState({ ...defaultProfileSnapshot, isReady: false }), "loading");
  assert.equal(getProfileActivityState({ ...defaultProfileSnapshot, historyLoading: true }), "loading");
  assert.equal(getProfileActivityState({ ...defaultProfileSnapshot, ratingsError: true }), "error");
  assert.equal(getProfileActivityState(defaultProfileSnapshot), "empty");
  assert.equal(getProfileActivityState({ ...defaultProfileSnapshot, watchedCount: 1 }), "ready");
  assert.equal(getProfileActivityState({ ...defaultProfileSnapshot, queuedCount: 2 }), "ready");
});

test("Cinema OS uses the generated trending route and page query contract", () => {
  assert.equal(getGetTrendingMoviesUrl({ page: 1 }), "/api/movies/trending?page=1");
  assert.deepEqual(getGetTrendingMoviesQueryKey({ page: 1 }), ["/api/movies/trending", { page: 1 }]);
});

test("key Cinema OS interactions keep stable test ids", () => {
  assert.equal(CINEMA_OS_TEST_IDS.signedOutStatus, "status-cinema-os-signed-out");
  assert.equal(CINEMA_OS_TEST_IDS.signalRetryButton, "button-cinema-os-retry");
  assert.equal(CINEMA_OS_TEST_IDS.afterglowSaveButton, "button-cinema-os-save-afterglow");
  assert.equal(CINEMA_OS_TEST_IDS.featureSelect(1), "select-cinema-os-feature-1");
  assert.equal(CINEMA_OS_TEST_IDS.featureSaveButton, "button-cinema-os-save-feature");
  assert.equal(CINEMA_OS_TEST_IDS.spoilerToggleButton, "button-cinema-os-spoiler-toggle");
  assert.equal(CINEMA_OS_TEST_IDS.spoilerSaveButton, "button-cinema-os-save-spoiler");
  assert.equal(CINEMA_OS_TEST_IDS.passportStampButton, "button-cinema-os-passport-stamp");
  assert.equal(CINEMA_OS_TEST_IDS.curriculumProgressButton, "button-cinema-os-curriculum-progress");
});