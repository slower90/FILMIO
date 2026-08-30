import assert from "node:assert/strict";
import test from "node:test";
import { customFetch, setAuthTokenGetter } from "./custom-fetch";

test("adds the current auth token to API requests", async () => {
  const originalFetch = globalThis.fetch;
  let requestHeaders: Headers | undefined;

  globalThis.fetch = async (_input, init) => {
    requestHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ saved: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  setAuthTokenGetter(async () => "clerk-session-token");

  try {
    const result = await customFetch<{ saved: boolean }>("/api/ratings", {
      method: "POST",
      body: JSON.stringify({ movieId: 550, score: 8 }),
    });
    assert.deepEqual(result, { saved: true });
    assert.equal(requestHeaders?.get("authorization"), "Bearer clerk-session-token");
  } finally {
    setAuthTokenGetter(null);
    globalThis.fetch = originalFetch;
  }
});