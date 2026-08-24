import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptMessage, encryptMessage, registerDevice } from "./e2ee";

function installBrowserGlobals() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { platform: "test", userAgent: "Browser" },
  });
  return values;
}

test("two authenticated device identities can decrypt their own envelope copies", async () => {
  const storage = installBrowserGlobals();
  const registrations: Array<{ deviceId: string; publicKey: string }> = [];
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { deviceId: string; publicKey: string };
      registrations.push(body);
      return new Response(JSON.stringify(body), { status: 201 });
    },
  });

  const alice = await registerDevice();
  storage.clear();
  const bob = await registerDevice();

  storage.clear();
  storage.set("madmax.e2ee.device", JSON.stringify(alice));
  const envelope = await encryptMessage("encrypted hello", [
    { deviceId: bob.deviceId, userId: "bob", publicKey: JSON.stringify(bob.publicKey) },
  ]);
  assert.equal(await decryptMessage(envelope), "encrypted hello");

  storage.clear();
  storage.set("madmax.e2ee.device", JSON.stringify(bob));
  assert.equal(await decryptMessage(envelope), "encrypted hello");
  assert.deepEqual(registrations.map(({ deviceId }) => deviceId), [alice.deviceId, bob.deviceId]);
});

test("a revoked device is not included in a subsequently encrypted envelope", async () => {
  const storage = installBrowserGlobals();
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async () => new Response("{}", { status: 201 }),
  });
  const sender = await registerDevice();
  storage.clear();
  const revoked = await registerDevice();
  storage.clear();
  storage.set("madmax.e2ee.device", JSON.stringify(sender));

  const envelope = JSON.parse(await encryptMessage("after revoke", [
    { deviceId: revoked.deviceId, userId: "bob", publicKey: JSON.stringify(revoked.publicKey), revoked: true },
  ])) as { recipients: Record<string, unknown> };
  assert.equal(envelope.recipients[revoked.deviceId], undefined);
});