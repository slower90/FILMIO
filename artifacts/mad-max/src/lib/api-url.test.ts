import assert from "node:assert/strict";
import test from "node:test";
import { apiUrl } from "./api-url";

test("apiUrl preserves relative paths when no API base is configured", () => {
  assert.equal(apiUrl("/api/movies/indian"), "/api/movies/indian");
});

test("apiUrl does not rewrite absolute URLs", () => {
  const signedUrl = "https://storage.example.test/upload?signature=abc";
  assert.equal(apiUrl(signedUrl), signedUrl);
});