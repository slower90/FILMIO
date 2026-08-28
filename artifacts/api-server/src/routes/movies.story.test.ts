import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";
import moviesRouter from "./movies";

function makeServer() {
  const app = express();
  app.use(moviesRouter);
  return app.listen(0);
}

function storyUrl(server: ReturnType<typeof makeServer>, movieId: number) {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}/movies/${movieId}/story`;
}

test("returns a safe 404 when the catalog does not contain the movie", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      success: false,
      status_code: 34,
      status_message: "The resource you requested could not be found.",
    })) as typeof fetch;
  const server = makeServer();

  try {
    const response = await originalFetch(storyUrl(server, 990001));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Movie not found" });
  } finally {
    server.close();
    globalThis.fetch = originalFetch;
  }
});

test("returns only the unavailable contract when every catalog provider fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("UPSTREAM PROVIDER BODY: invented fact and provider diagnostic", {
      status: 502,
      headers: { "content-type": "text/plain" },
    })) as typeof fetch;
  const server = makeServer();

  try {
    const response = await originalFetch(storyUrl(server, 990002));
    const body = await response.text();

    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(body), {
      error: "Movie story is temporarily unavailable",
      status: "unavailable",
    });
    assert.doesNotMatch(body, /invented fact|provider diagnostic|UPSTREAM PROVIDER BODY/);
  } finally {
    server.close();
    globalThis.fetch = originalFetch;
  }
});