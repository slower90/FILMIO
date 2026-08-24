import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import {
  clearRecentlyViewed,
  loadRecentlyViewed,
  recordRecentlyViewed,
} from "./viewing-history";

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

beforeEach(() => {
  storage.clear();
  globalThis.window = {
    localStorage: localStorageMock,
    dispatchEvent: () => true,
  } as unknown as Window & typeof globalThis;
  globalThis.localStorage = localStorageMock as Storage;
});

const movie = { id: 1, title: "Local movie", posterPath: null, releaseDate: null };

test("signed-out browsing records, loads, and clears local history without API calls", async () => {
  const fetchBefore = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error("signed-out history must not call the API");
  }) as typeof fetch;
  try {
    recordRecentlyViewed(movie);
    assert.deepEqual(await loadRecentlyViewed(false), [movie]);
    assert.equal(await clearRecentlyViewed(false), true);
    assert.deepEqual(await loadRecentlyViewed(false), []);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

test("sign-in sends local history to the account and removes the local copy after sync", async () => {
  recordRecentlyViewed(movie);
  const requests: RequestInit[] = [];
  globalThis.fetch = (async (_input, init) => {
    requests.push(init ?? {});
    return new Response(JSON.stringify([movie]), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  assert.deepEqual(await loadRecentlyViewed(true), [movie]);
  assert.equal(requests[0]?.method, "POST");
  assert.match(String(requests[0]?.body), /Local movie/);
  assert.deepEqual(await loadRecentlyViewed(false), []);
});