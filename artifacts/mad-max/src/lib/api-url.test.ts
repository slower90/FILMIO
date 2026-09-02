import assert from "node:assert/strict";
import test from "node:test";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { apiFetch, apiUrl } from "./api-url";

test("apiUrl preserves relative paths when no API base is configured", () => {
  assert.equal(apiUrl("/api/movies/indian"), "/api/movies/indian");
});

test("apiUrl does not rewrite absolute URLs", () => {
  const signedUrl = "https://storage.example.test/upload?signature=abc";
  assert.equal(apiUrl(signedUrl), signedUrl);
});

test("apiFetch forwards the Clerk session token for hand-written API requests", async () => {
  const originalFetch = globalThis.fetch;
  let requestHeaders: Headers | undefined;

  globalThis.fetch = async (_input, init) => {
    requestHeaders = new Headers(init?.headers);
    return new Response("ok", { status: 200 });
  };
  setAuthTokenGetter(async () => "clerk-session-token");

  try {
    const response = await apiFetch("/api/users/me", {
      credentials: "include",
    });
    assert.equal(response.status, 200);
    assert.equal(
      requestHeaders?.get("authorization"),
      "Bearer clerk-session-token",
    );
  } finally {
    setAuthTokenGetter(null);
    globalThis.fetch = originalFetch;
  }
});

test("apiFetch does not replace an explicitly supplied authorization header", async () => {
  const originalFetch = globalThis.fetch;
  let requestHeaders: Headers | undefined;

  globalThis.fetch = async (_input, init) => {
    requestHeaders = new Headers(init?.headers);
    return new Response("ok", { status: 200 });
  };
  setAuthTokenGetter(async () => "new-session-token");

  try {
    await apiFetch("/api/users/me", {
      headers: { Authorization: "Bearer explicit-token" },
    });
    assert.equal(
      requestHeaders?.get("authorization"),
      "Bearer explicit-token",
    );
  } finally {
    setAuthTokenGetter(null);
    globalThis.fetch = originalFetch;
  }
});