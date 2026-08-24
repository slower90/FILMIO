import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeDeliveryDevices,
  conversationAccessError,
} from "./chat-security";

const devices = [
  { deviceId: "alice-phone", userId: "alice", revoked: false },
  { deviceId: "alice-laptop", userId: "alice", revoked: true },
  { deviceId: "bob-phone", userId: "bob", revoked: false },
];

test("only authenticated conversation participants can access envelopes and device keys", () => {
  assert.equal(conversationAccessError(null, ["alice", "bob"]), "unauthorized");
  assert.equal(conversationAccessError("mallory", ["alice", "bob"]), "forbidden");
  assert.equal(conversationAccessError("alice", ["alice", "bob"]), null);
  assert.equal(conversationAccessError("bob", ["alice", "bob"]), null);
});

test("revoked devices are excluded from new-message delivery targets", () => {
  assert.deepEqual(
    activeDeliveryDevices(devices).map((device) => device.deviceId),
    ["alice-phone", "bob-phone"],
  );
});