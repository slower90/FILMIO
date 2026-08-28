import assert from "node:assert/strict";
import test from "node:test";
import { isConversationUnread } from "./chat-read-state";

test("marks a newly received conversation unread when it is not active", () => {
  assert.equal(isConversationUnread("2026-08-27T10:05:00.000Z", null, false), true);
  assert.equal(isConversationUnread("2026-08-27T10:05:00.000Z", "2026-08-27T10:00:00.000Z", false), true);
});

test("does not mark the active or already-read conversation unread", () => {
  assert.equal(isConversationUnread("2026-08-27T10:05:00.000Z", null, true), false);
  assert.equal(isConversationUnread("2026-08-27T10:05:00.000Z", "2026-08-27T10:05:00.000Z", false), false);
  assert.equal(isConversationUnread("2026-08-27T10:00:00.000Z", "2026-08-27T10:05:00.000Z", false), false);
});