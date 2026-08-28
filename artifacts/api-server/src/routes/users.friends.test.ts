import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canMutateFriendRequest,
  canUnfriend,
  friendRequestConflict,
} from "./users";

const pending = (senderId: string, receiverId: string) => ({
  status: "pending",
  senderId,
  receiverId,
});

const accepted = (senderId: string, receiverId: string) => ({
  status: "accepted",
  senderId,
  receiverId,
});

test("rejects self friend requests", () => {
  assert.equal(friendRequestConflict("alice", "alice"), "self");
});

test("detects duplicate and reciprocal pending requests", () => {
  assert.equal(friendRequestConflict("alice", "bob", pending("alice", "bob")), "outgoing");
  assert.equal(friendRequestConflict("alice", "bob", pending("bob", "alice")), "incoming");
});

test("does not allow a second request after friendship exists", () => {
  assert.equal(friendRequestConflict("alice", "bob", accepted("alice", "bob")), "accepted");
});

test("only the right request owner can accept, decline, or cancel", () => {
  const request = pending("alice", "bob");
  assert.equal(canMutateFriendRequest("accept", "bob", request), true);
  assert.equal(canMutateFriendRequest("decline", "bob", request), true);
  assert.equal(canMutateFriendRequest("accept", "alice", request), false);
  assert.equal(canMutateFriendRequest("decline", "alice", request), false);
  assert.equal(canMutateFriendRequest("cancel", "alice", request), true);
  assert.equal(canMutateFriendRequest("cancel", "bob", request), false);
});

test("does not mutate an already accepted or removed request", () => {
  const request = accepted("alice", "bob");
  assert.equal(canMutateFriendRequest("accept", "bob", request), false);
  assert.equal(canMutateFriendRequest("decline", "bob", request), false);
  assert.equal(canMutateFriendRequest("cancel", "alice", request), false);
});

test("only removes an existing friendship between the two users", () => {
  assert.equal(canUnfriend("alice", "bob", accepted("alice", "bob")), true);
  assert.equal(canUnfriend("alice", "bob", accepted("bob", "alice")), true);
  assert.equal(canUnfriend("alice", "charlie", accepted("alice", "bob")), false);
  assert.equal(canUnfriend("alice", "bob", pending("alice", "bob")), false);
  assert.equal(canUnfriend("alice", "bob"), false);
});