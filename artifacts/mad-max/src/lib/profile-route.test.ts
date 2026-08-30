import assert from "node:assert/strict";
import test from "node:test";
import { resolveProfileId } from "./profile-route";

test("uses the route profile id for public profile links", () => {
  assert.equal(resolveProfileId("42", "current-user"), "42");
});

test("resolves the current user for the /profile entry route", () => {
  assert.equal(resolveProfileId(undefined, "current-user"), "current-user");
});

test("returns an empty id instead of an invalid blank request", () => {
  assert.equal(resolveProfileId("  ", undefined), "");
});