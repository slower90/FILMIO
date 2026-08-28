import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import type { Server } from "node:http";
import { after, test } from "node:test";
import express from "express";
import {
  chatDevicesTable,
  chatMessagesTable,
  conversationParticipantsTable,
  conversationsTable,
  db,
  pool,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { createChatRouter } from "./chat";

const subtle = webcrypto.subtle;
const algorithm = "P-256-ECDH/HKDF-SHA-256/AES-GCM" as const;

type AccountKeys = {
  deviceId: string;
  publicKey: webcrypto.JsonWebKey;
  privateKey: webcrypto.JsonWebKey;
};

type EncryptedEnvelope = {
  version: 2;
  algorithm: typeof algorithm;
  senderDeviceId: string;
  senderPublicKey: string;
  createdAt: number;
  recipients: Record<string, {
    ephemeralPublicKey: string;
    iv: string;
    ciphertext: string;
  }>;
};

function encode(value: ArrayBuffer | Uint8Array) {
  return Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value).toString("base64");
}

function decode(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

async function deriveMessageKey(publicKey: webcrypto.JsonWebKey, privateKey: webcrypto.JsonWebKey, context: string) {
  const remote = await subtle.importKey("jwk", publicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const own = await subtle.importKey("jwk", privateKey, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "ECDH", public: remote }, own, 256);
  const material = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    {
      name: "HKDF",
      salt: new TextEncoder().encode("mad-max-ratchet-v2"),
      info: new TextEncoder().encode(context),
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function createAccountKeys(): Promise<AccountKeys> {
  const keys = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as webcrypto.CryptoKeyPair;
  return {
    deviceId: webcrypto.randomUUID(),
    publicKey: await subtle.exportKey("jwk", keys.publicKey),
    privateKey: await subtle.exportKey("jwk", keys.privateKey),
  };
}

async function encryptForAccounts(
  sender: AccountKeys,
  recipients: AccountKeys[],
  text: string,
): Promise<EncryptedEnvelope> {
  const createdAt = Date.now();
  const envelope: EncryptedEnvelope = {
    version: 2,
    algorithm,
    senderDeviceId: sender.deviceId,
    senderPublicKey: JSON.stringify(sender.publicKey),
    createdAt,
    recipients: {},
  };
  for (const recipient of [sender, ...recipients]) {
    const ephemeral = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as webcrypto.CryptoKeyPair;
    const ephemeralPrivateKey = await subtle.exportKey("jwk", ephemeral.privateKey);
    const ephemeralPublicKey = await subtle.exportKey("jwk", ephemeral.publicKey);
    const key = await deriveMessageKey(
      recipient.publicKey,
      ephemeralPrivateKey,
      `message:${sender.deviceId}:${recipient.deviceId}:${createdAt}`,
    );
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify({ text })),
    );
    envelope.recipients[recipient.deviceId] = {
      ephemeralPublicKey: JSON.stringify(ephemeralPublicKey),
      iv: encode(iv),
      ciphertext: encode(ciphertext),
    };
  }
  return envelope;
}

async function decryptForAccount(raw: string, account: AccountKeys): Promise<string | null> {
  const envelope = JSON.parse(raw) as EncryptedEnvelope;
  const payload = envelope.recipients[account.deviceId];
  if (!payload) return null;
  const key = await deriveMessageKey(
    JSON.parse(payload.ephemeralPublicKey) as webcrypto.JsonWebKey,
    account.privateKey,
    `message:${envelope.senderDeviceId}:${account.deviceId}:${envelope.createdAt}`,
  );
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: decode(payload.iv) },
    key,
    decode(payload.ciphertext),
  );
  return (JSON.parse(new TextDecoder().decode(plaintext)) as { text: string }).text;
}

function createAuthMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.header("x-test-user");
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as express.Request & { userId: string }).userId = userId;
    next();
  };
}

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api", createChatRouter(createAuthMiddleware()));
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/api` };
}

async function request(
  baseUrl: string,
  userId: string,
  path: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("x-test-user", userId);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

test("two authenticated accounts persist and decrypt a private message without exposing it to a third account", async () => {
  const suffix = webcrypto.randomUUID();
  const accounts = {
    alice: `chat-test-alice-${suffix}`,
    bob: `chat-test-bob-${suffix}`,
    mallory: `chat-test-mallory-${suffix}`,
  };
  const keys = {
    alice: await createAccountKeys(),
    bob: await createAccountKeys(),
    mallory: await createAccountKeys(),
  };
  let conversationId: number | undefined;
  let server: Server | undefined;
  let baseUrl = "";

  try {
    await db.insert(usersTable).values([
      { clerkId: accounts.alice, username: `${accounts.alice}-user`, displayName: "Alice Test" },
      { clerkId: accounts.bob, username: `${accounts.bob}-user`, displayName: "Bob Test" },
      { clerkId: accounts.mallory, username: `${accounts.mallory}-user`, displayName: "Mallory Test" },
    ]);

    ({ server, baseUrl } = await startTestServer());

    for (const [userId, accountKeys] of [[accounts.alice, keys.alice], [accounts.bob, keys.bob]] as const) {
      const response = await request(baseUrl, userId, "/chat/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: accountKeys.deviceId,
          publicKey: JSON.stringify(accountKeys.publicKey),
          deviceName: `${userId} browser`,
        }),
      });
      assert.equal(response.status, 201);
    }

    const createConversationResponse = await request(baseUrl, accounts.alice, "/chat/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId: accounts.bob }),
    });
    assert.equal(createConversationResponse.status, 201);
    const createdConversation = await createConversationResponse.json() as { id: number };
    conversationId = createdConversation.id;

    const bobConversationResponse = await request(baseUrl, accounts.bob, "/chat/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId: accounts.alice }),
    });
    assert.equal(bobConversationResponse.status, 201);
    const bobConversation = await bobConversationResponse.json() as { id: number };
    assert.equal(bobConversation.id, conversationId);

    const devicesResponse = await request(baseUrl, accounts.alice, `/chat/conversations/${conversationId}/devices`);
    assert.equal(devicesResponse.status, 200);
    const deliveryDevices = await devicesResponse.json() as Array<{ deviceId: string; userId: string }>;
    assert.deepEqual(
      deliveryDevices.map((device) => device.userId).sort(),
      [accounts.alice, accounts.bob],
    );

    const envelope = await encryptForAccounts(keys.alice, [keys.bob], "Meet me after the screening.");
    const sendResponse = await request(baseUrl, accounts.alice, `/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: JSON.stringify(envelope) }),
    });
    assert.equal(sendResponse.status, 201);
    const sent = await sendResponse.json() as { content: string; senderId: string };
    assert.equal(sent.senderId, accounts.alice);
    assert.equal(sent.content, JSON.stringify(envelope));
    assert.equal(sent.content.includes("Meet me after the screening."), false);

    const persistedRows = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.conversationId, conversationId));
    assert.equal(persistedRows.length, 1);
    assert.equal(persistedRows[0]?.content.includes("Meet me after the screening."), false);
    assert.equal(await decryptForAccount(persistedRows[0]!.content, keys.bob), "Meet me after the screening.");
    assert.equal(await decryptForAccount(persistedRows[0]!.content, keys.mallory), null);

    const bobMessagesAfterSend = await request(baseUrl, accounts.bob, `/chat/conversations/${conversationId}/messages`);
    assert.equal(bobMessagesAfterSend.status, 200);
    const bobMessages = await bobMessagesAfterSend.json() as Array<{ content: string; senderId: string }>;
    assert.equal(bobMessages.length, 1);
    assert.equal(bobMessages[0]?.senderId, accounts.alice);
    assert.equal(await decryptForAccount(bobMessages[0]!.content, keys.bob), "Meet me after the screening.");

    const bobReloadedConversations = await request(baseUrl, accounts.bob, "/chat/conversations");
    assert.equal(bobReloadedConversations.status, 200);
    const reloadedConversations = await bobReloadedConversations.json() as Array<{ id: number; lastMessage: string | null; lastMessageAt: string | null }>;
    const reloaded = reloadedConversations.find((conversation) => conversation.id === conversationId);
    assert.ok(reloaded);
    assert.equal(reloaded.lastMessage, "[Encrypted message]");
    assert.ok(reloaded.lastMessageAt);

    const malloryConversations = await request(baseUrl, accounts.mallory, "/chat/conversations");
    assert.equal(malloryConversations.status, 200);
    assert.deepEqual(await malloryConversations.json(), []);

    const malloryMessages = await request(baseUrl, accounts.mallory, `/chat/conversations/${conversationId}/messages`);
    assert.equal(malloryMessages.status, 403);
    const malloryDevices = await request(baseUrl, accounts.mallory, `/chat/conversations/${conversationId}/devices`);
    assert.equal(malloryDevices.status, 403);
  } finally {
    const runningServer = server;
    if (runningServer) {
      await new Promise<void>((resolve, reject) => runningServer.close((error) => error ? reject(error) : resolve()));
    }
    if (conversationId !== undefined) {
      await db.delete(chatMessagesTable).where(eq(chatMessagesTable.conversationId, conversationId));
      await db.delete(conversationParticipantsTable).where(eq(conversationParticipantsTable.conversationId, conversationId));
      await db.delete(conversationsTable).where(eq(conversationsTable.id, conversationId));
    }
    await db.delete(chatDevicesTable).where(inArray(chatDevicesTable.userId, Object.values(accounts)));
    await db.delete(usersTable).where(inArray(usersTable.clerkId, Object.values(accounts)));
  }
});

after(async () => {
  await pool.end();
});