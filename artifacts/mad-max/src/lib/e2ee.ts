const DEVICE_KEY = "madmax.e2ee.device";
type DeviceIdentity = { deviceId: string; privateKey: JsonWebKey; publicKey: JsonWebKey };
type RecipientDevice = { deviceId: string; userId: string; publicKey: string; revoked?: boolean };
export type DeviceLinkPackage = {
  version: 1;
  challenge: string;
  backup: string;
};

export function hasStoredDeviceIdentity() {
  return Boolean(localStorage.getItem(DEVICE_KEY));
}
export type EncryptedEnvelope = {
  version: 2;
  algorithm: "P-256-ECDH/HKDF-SHA-256/AES-GCM";
  senderDeviceId: string;
  senderPublicKey: string;
  createdAt: number;
  recipients: Record<string, { ephemeralPublicKey: string; iv: string; ciphertext: string }>;
};

export type EncryptedAttachment = {
  name: string;
  type: string;
  size: number;
  data: string;
};
export type DecryptedMessage = { text: string; attachment?: EncryptedAttachment };

const encode = (value: ArrayBuffer | Uint8Array) => {
  const bytes = new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer);
  let result = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(result);
};
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

function requirePassphrase(passphrase: string) {
  if (typeof passphrase !== "string" || passphrase.trim().length < 12) {
    throw new Error("Use a recovery passphrase with at least 12 characters.");
  }
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 210_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function identity(): Promise<DeviceIdentity> {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return JSON.parse(existing) as DeviceIdentity;
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const identity = {
    deviceId: crypto.randomUUID(),
    privateKey: await crypto.subtle.exportKey("jwk", (keys as CryptoKeyPair).privateKey),
    publicKey: await crypto.subtle.exportKey("jwk", (keys as CryptoKeyPair).publicKey),
  };
  localStorage.setItem(DEVICE_KEY, JSON.stringify(identity));
  return identity;
}

async function deriveMessageKey(publicKey: string | JsonWebKey, privateKey: JsonWebKey, context: string) {
  const remote = await crypto.subtle.importKey("jwk", typeof publicKey === "string" ? JSON.parse(publicKey) : publicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const own = await crypto.subtle.importKey("jwk", privateKey, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: remote }, own, 256);
  const material = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", salt: new TextEncoder().encode("mad-max-ratchet-v2"), info: new TextEncoder().encode(context), hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function registerDevice() {
  const current = await identity();
  await fetch("/api/chat/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: current.deviceId, publicKey: JSON.stringify(current.publicKey), deviceName: `${navigator.platform} · ${navigator.userAgent.includes("Mobile") ? "Mobile" : "Browser"}` }) });
  return current;
}

/**
 * Encrypts the complete device identity locally. The returned string is safe
 * to copy into a QR/code transfer because it contains no usable plaintext
 * without the recovery passphrase.
 */
export async function createEncryptedKeyBackup(passphrase: string) {
  requirePassphrase(passphrase);
  const current = await identity();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(current)),
  );
  return JSON.stringify({ version: 1, algorithm: "PBKDF2-SHA-256/AES-GCM", salt: encode(salt), iv: encode(iv), ciphertext: encode(ciphertext) });
}

export async function restoreEncryptedKeyBackup(raw: string, passphrase: string) {
  requirePassphrase(passphrase);
  const backup = JSON.parse(raw) as { version?: number; algorithm?: string; salt?: string; iv?: string; ciphertext?: string };
  if (backup.version !== 1 || backup.algorithm !== "PBKDF2-SHA-256/AES-GCM" || !backup.salt || !backup.iv || !backup.ciphertext) {
    throw new Error("This recovery code is not valid.");
  }
  try {
    const key = await deriveBackupKey(passphrase, decode(backup.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(backup.iv) },
      key,
      decode(backup.ciphertext),
    );
    const restored = JSON.parse(new TextDecoder().decode(plaintext)) as DeviceIdentity;
    if (!restored.deviceId || !restored.privateKey || !restored.publicKey) throw new Error();
    localStorage.setItem(DEVICE_KEY, JSON.stringify(restored));
    return restored;
  } catch {
    throw new Error("The recovery code or passphrase is incorrect.");
  }
}

export function createDeviceLinkCode(challenge: string, backup: string) {
  const payload: DeviceLinkPackage = { version: 1, challenge, backup };
  return btoa(JSON.stringify(payload));
}

export function parseDeviceLinkCode(code: string): DeviceLinkPackage {
  try {
    const payload = JSON.parse(atob(code.trim())) as DeviceLinkPackage;
    if (payload.version !== 1 || !payload.challenge || !payload.backup) throw new Error();
    return payload;
  } catch {
    throw new Error("This device link code is not valid.");
  }
}

export async function encryptMessage(text: string, devices: RecipientDevice[], attachment?: File): Promise<string> {
  const current = await identity();
  const recipients = [...devices.filter((device) => !device.revoked), { deviceId: current.deviceId, userId: "self", publicKey: JSON.stringify(current.publicKey) }];
  const encrypted: EncryptedEnvelope = {
    version: 2,
    algorithm: "P-256-ECDH/HKDF-SHA-256/AES-GCM",
    senderDeviceId: current.deviceId,
    senderPublicKey: JSON.stringify(current.publicKey),
    createdAt: Date.now(),
    recipients: {},
  };
  const attachmentPayload = attachment ? {
    name: attachment.name.slice(0, 160),
    type: attachment.type || "application/octet-stream",
    size: attachment.size,
    data: encode(await attachment.arrayBuffer()),
  } : undefined;
  const plaintext = JSON.stringify({ text, attachment: attachmentPayload });
  for (const recipient of recipients) {
    // A fresh ephemeral key is used for every recipient and every message. Its
    // private half is never persisted or sent, providing forward secrecy.
    const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const ephemeralPrivate = await crypto.subtle.exportKey("jwk", (ephemeral as CryptoKeyPair).privateKey);
    const ephemeralPublic = await crypto.subtle.exportKey("jwk", (ephemeral as CryptoKeyPair).publicKey);
    const key = await deriveMessageKey(recipient.publicKey, ephemeralPrivate, `message:${current.deviceId}:${recipient.deviceId}:${encrypted.createdAt}`);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
    encrypted.recipients[recipient.deviceId] = { ephemeralPublicKey: JSON.stringify(ephemeralPublic), iv: encode(iv), ciphertext: encode(ciphertext) };
  }
  return JSON.stringify(encrypted);
}

export async function decryptMessagePayload(raw: string): Promise<DecryptedMessage | null> {
  try {
    const envelope = JSON.parse(raw) as EncryptedEnvelope;
    if (envelope.version !== 2 || envelope.algorithm !== "P-256-ECDH/HKDF-SHA-256/AES-GCM") return null;
    const current = await identity();
    const payload = envelope.recipients[current.deviceId];
    if (!payload) return null;
    const key = await deriveMessageKey(payload.ephemeralPublicKey, current.privateKey, `message:${envelope.senderDeviceId}:${current.deviceId}:${envelope.createdAt}`);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(payload.iv) }, key, decode(payload.ciphertext));
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as DecryptedMessage;
    if (typeof parsed.text !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function decryptMessage(raw: string) {
  const message = await decryptMessagePayload(raw);
  return message?.text ?? "Unable to decrypt this message";
}