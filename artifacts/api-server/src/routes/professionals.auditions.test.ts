import assert from "node:assert/strict";
import { test } from "node:test";
import {
  auditionFileAccessError,
  ownsProfessionalResource,
} from "./professionals";

test("rejects anonymous access to private audition files", () => {
  assert.equal(auditionFileAccessError(null, "owner", false), "unauthorized");
  assert.equal(auditionFileAccessError(undefined, "owner", false), "unauthorized");
});

test("forbids another signed-in account from private audition files", () => {
  assert.equal(auditionFileAccessError("viewer", "owner", false), "forbidden");
});

test("allows the owner to access a private audition file", () => {
  assert.equal(auditionFileAccessError("owner", "owner", false), null);
});

test("keeps public audition files available without an account", () => {
  assert.equal(auditionFileAccessError(null, "owner", true), null);
  assert.equal(auditionFileAccessError("viewer", "owner", true), null);
});

test("limits professional resource mutations to the owning account", () => {
  assert.equal(ownsProfessionalResource("owner", "owner"), true);
  assert.equal(ownsProfessionalResource("viewer", "owner"), false);
});