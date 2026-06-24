// ============================================================
// End-to-end encryption for CipherWave's pairwise mesh.
//
// Each pair of peers derives its OWN AES-256-GCM key from an ECDH(P-256)
// agreement between their identity keys, then HKDF-mixed with the shared room
// secret so the key is cryptographically bound to the room (a party without the
// room code cannot derive a usable key, even if it observes the public keys).
// Pure functions over WebCrypto — no I/O, fully unit-testable.
// ============================================================

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder();

export interface EncryptedPayload {
  /** base64 12-byte AES-GCM nonce */
  nonce: string;
  /** base64 ciphertext (includes the GCM auth tag) */
  content: string;
}

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]!);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Generate an ephemeral ECDH P-256 identity key pair for this session. */
export async function generateIdentity(): Promise<CryptoKeyPair> {
  return subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

/**
 * Derive a symmetric AES-256-GCM key from the room code alone (HKDF). Used to
 * encrypt the ENTIRE transport payload so the relay/broker — which never learns
 * the room code (only a hash of it) — sees nothing but opaque ciphertext.
 */
export async function deriveRoomKey(roomCode: string): Promise<CryptoKey> {
  const material = await subtle.importKey('raw', te.encode(roomCode), 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: te.encode('cipherwave-room-transport'),
      info: te.encode('cipherwave-transport-v1'),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Export our public key as raw base64 to share with peers. */
export async function exportPublicKey(keyPair: CryptoKeyPair): Promise<string> {
  return toB64(await subtle.exportKey('raw', keyPair.publicKey));
}

/**
 * Derive the shared AES-256-GCM key for a peer: ECDH → HKDF(salt = SHA-256(roomSecret)).
 * Both peers compute the identical key; without `roomSecret`, the key won't match.
 */
export async function deriveSharedKey(
  myPrivate: CryptoKey,
  peerPublicB64: string,
  roomSecret: string,
): Promise<CryptoKey> {
  const peerPublic = await subtle.importKey(
    'raw',
    fromB64(peerPublicB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const sharedBits = await subtle.deriveBits({ name: 'ECDH', public: peerPublic }, myPrivate, 256);
  const salt = await subtle.digest('SHA-256', te.encode(roomSecret));
  const hkdfKey = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('cipherwave-e2e-v1') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a UTF-8 string with a pair key. */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, te.encode(plaintext));
  return { nonce: toB64(nonce), content: toB64(ct) };
}

/** Decrypt a payload with a pair key. Throws if the key/tag don't match. */
export async function decrypt(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const pt = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(payload.nonce) },
    key,
    fromB64(payload.content),
  );
  return td.decode(pt);
}
