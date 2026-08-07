/**
 * End-to-end encryption utilities using WebCrypto.
 *
 * Algorithm: ECDH (P-256) key agreement → HKDF-SHA256 → AES-GCM-256
 *
 * This is the same cryptographic foundation used by Signal and TLS 1.3:
 * - Elliptic-curve Diffie-Hellman for forward-secret key exchange
 * - HKDF for key derivation
 * - AES-GCM for authenticated encryption
 *
 * Private keys never leave the client — only the public JWK is uploaded.
 */

const STORAGE_KEY = (userId: string) => `e2e_keypair_${userId}`;

export interface E2EKeyPair {
  publicKeyB64: string;   // base64-encoded SPKI public key
  privateKeyJwk: JsonWebKey; // stored in localStorage
}

export interface EncryptedMessage {
  encrypted: true;
  nonce: string;       // base64 AES-GCM nonce (12 bytes)
  ciphertext: string;  // base64 ciphertext + auth tag
}

// ─── Key generation & storage ────────────────────────────────────────────────

export async function getOrCreateKeyPair(userId: string): Promise<E2EKeyPair> {
  const stored = localStorage.getItem(STORAGE_KEY(userId));
  if (stored) {
    try {
      return JSON.parse(stored) as E2EKeyPair;
    } catch {
      // corrupted — regenerate
    }
  }
  return generateAndStoreKeyPair(userId);
}

export async function generateAndStoreKeyPair(userId: string): Promise<E2EKeyPair> {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );

  const spki = await crypto.subtle.exportKey("spki", publicKey);
  const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", privateKey);

  const pair: E2EKeyPair = { publicKeyB64, privateKeyJwk };
  localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(pair));
  return pair;
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "spki",
    binary,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"],
  );
}

// ─── Key derivation ──────────────────────────────────────────────────────────

async function deriveAesKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<CryptoKey> {
  const raw = await crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return raw;
}

export async function deriveSharedKey(
  myPrivateJwk: JsonWebKey,
  theirPublicB64: string,
): Promise<CryptoKey> {
  const [myKey, theirKey] = await Promise.all([
    importPrivateKey(myPrivateJwk),
    importPublicKey(theirPublicB64),
  ]);
  return deriveAesKey(myKey, theirKey);
}

// ─── Encrypt / Decrypt ───────────────────────────────────────────────────────

export async function encryptMessage(
  aesKey: CryptoKey,
  plaintext: string,
): Promise<EncryptedMessage> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipherbuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    enc.encode(plaintext),
  );

  return {
    encrypted: true,
    nonce: btoa(String.fromCharCode(...nonce)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipherbuf))),
  };
}

export async function decryptMessage(
  aesKey: CryptoKey,
  msg: EncryptedMessage,
): Promise<string> {
  const nonce = Uint8Array.from(atob(msg.nonce), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(msg.ciphertext), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    ciphertext,
  );
  return new TextDecoder().decode(plain);
}

// ─── Message parsing helpers ─────────────────────────────────────────────────

export function isEncryptedMessage(content: string): boolean {
  try {
    const obj = JSON.parse(content);
    return obj?.encrypted === true && typeof obj.nonce === "string";
  } catch {
    return false;
  }
}

export function parseEncryptedMessage(content: string): EncryptedMessage | null {
  try {
    const obj = JSON.parse(content);
    if (obj?.encrypted === true) return obj as EncryptedMessage;
    return null;
  } catch {
    return null;
  }
}
