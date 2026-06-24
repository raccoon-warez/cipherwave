// ============================================================
// Crypto Engine Tests
// ============================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AES256GCM, ChaCha20Poly1305, HMAC, KeyDerivation } from '../../src/core/crypto/engine';

describe('AES-256-GCM', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    key = await AES256GCM.generateKey();
  });

  it('should encrypt and decrypt a message', async () => {
    const plaintext = 'Hello, CipherWave!';
    const { ciphertext, tag, nonce } = await AES256GCM.encrypt(plaintext, key);

    expect(ciphertext).toBeDefined();
    expect(tag).toBeDefined();
    expect(nonce).toBeDefined();
    expect(ciphertext.length).toBeGreaterThan(0);
  });

  it('should decrypt the correct plaintext', async () => {
    const plaintext = 'Secret message 123';
    const { ciphertext, tag, nonce } = await AES256GCM.encrypt(plaintext, key);
    const decrypted = await AES256GCM.decrypt(ciphertext, key, nonce, tag);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for the same plaintext', async () => {
    const plaintext = 'Same message';
    const result1 = await AES256GCM.encrypt(plaintext, key);
    const result2 = await AES256GCM.encrypt(plaintext, key);

    expect(result1.ciphertext).not.toEqual(result2.ciphertext);
  });

  it('should fail decryption with wrong key', async () => {
    const plaintext = 'Secret message';
    const wrongKey = await AES256GCM.generateKey();
    const { ciphertext, tag, nonce } = await AES256GCM.encrypt(plaintext, key);

    await expect(AES256GCM.decrypt(ciphertext, wrongKey, nonce, tag))
      .rejects.toThrow();
  });

  it('should fail decryption with tampered ciphertext', async () => {
    const plaintext = 'Secret message';
    const { ciphertext, tag, nonce } = await AES256GCM.encrypt(plaintext, key);

    const tampered = Buffer.from(ciphertext);
    tampered[0] ^= 0xff;

    await expect(AES256GCM.decrypt(tampered, key, nonce, tag))
      .rejects.toThrow();
  });
});

describe('ChaCha20-Poly1305', () => {
  it('should encrypt and decrypt a message', () => {
    const key = ChaCha20Poly1305.generateKeySync();
    const plaintext = 'Hello, ChaCha20!';
    const encrypted = ChaCha20Poly1305.encrypt(plaintext, key);

    expect(encrypted).toBeDefined();
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
  });

  it('should decrypt the correct plaintext', () => {
    const key = ChaCha20Poly1305.generateKeySync();
    const plaintext = 'Secret ChaCha20 message';
    const encrypted = ChaCha20Poly1305.encrypt(plaintext, key);
    const decrypted = ChaCha20Poly1305.decrypt(encrypted, key);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different encrypted output each time', () => {
    const key = ChaCha20Poly1305.generateKeySync();
    const plaintext = 'Same message';
    const encrypted1 = ChaCha20Poly1305.encrypt(plaintext, key);
    const encrypted2 = ChaCha20Poly1305.encrypt(plaintext, key);

    expect(encrypted1).not.toEqual(encrypted2);
  });
});

describe('HMAC', () => {
  it('should sign and verify data', () => {
    const key = Buffer.from('secret-key-12345678');
    const data = 'Hello, World!';

    const signature = HMAC.sign(data, key);
    expect(signature).toBeDefined();
    expect(signature.length).toBe(32); // SHA-256 = 256 bits = 32 bytes
  });

  it('should verify correct signature', () => {
    const key = Buffer.from('secret-key-12345678');
    const data = 'Hello, World!';
    const signature = HMAC.sign(data, key);

    expect(HMAC.verify(data, key, signature)).toBe(true);
  });

  it('should reject tampered data', () => {
    const key = Buffer.from('secret-key-12345678');
    const signature = HMAC.sign('original data', key);

    expect(HMAC.verify('modified data', key, signature)).toBe(false);
  });

  it('should reject wrong key', () => {
    const key1 = Buffer.from('key-one');
    const key2 = Buffer.from('key-two');
    const data = 'Hello, World!';
    const signature = HMAC.sign(data, key1);

    expect(HMAC.verify(data, key2, signature)).toBe(false);
  });
});

describe('Key Derivation', () => {
  it('should generate a SHA-256 hash', () => {
    const hash = KeyDerivation.hash('test');
    expect(hash).toHaveLength(64); // 256 bits = 64 hex chars
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate consistent IDs', () => {
    const id1 = KeyDerivation.generateId(32);
    const id2 = KeyDerivation.generateId(32);

    expect(id1).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(id2).toHaveLength(64);
    expect(id1).not.toBe(id2); // Should be unique
  });

  it('should generate short IDs', () => {
    const id = KeyDerivation.generateShortId(6);

    expect(id).toHaveLength(6);
    expect(id).toMatch(/^[A-Z0-9]+$/);
  });

  it('should derive keys from master key', async () => {
    const masterKey = Buffer.alloc(32, 0x42);
    const salt = Buffer.alloc(16, 0x00);

    const { encryptionKey, macKey } = await KeyDerivation.deriveKeys(masterKey, salt);

    expect(encryptionKey).toBeDefined();
    expect(macKey).toBeDefined();
    expect(encryptionKey.length).toBe(32);
    expect(macKey.length).toBe(32);
    expect(encryptionKey).not.toEqual(macKey);
  });
});

// Mirrors the client's P2P key agreement (App.svelte): two peers each generate
// an ECDH P-256 key pair, exchange raw public keys, and derive the SAME AES-GCM
// key. Regression guard for the "each peer made its own key → can't decrypt" bug.
describe('ECDH key exchange (client P2P)', () => {
  const subtle = globalThis.crypto.subtle;

  async function makePeer() {
    const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const pubRaw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
    return { pair, pubRaw };
  }
  async function deriveShared(myPriv: CryptoKey, peerPubRaw: Uint8Array) {
    const peerPub = await subtle.importKey('raw', peerPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    return subtle.deriveKey({ name: 'ECDH', public: peerPub }, myPriv,
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  it('derives an identical shared key on both peers', async () => {
    const a = await makePeer();
    const b = await makePeer();
    const keyA = await deriveShared(a.pair.privateKey, b.pubRaw);
    const keyB = await deriveShared(b.pair.privateKey, a.pubRaw);
    const rawA = new Uint8Array(await subtle.exportKey('raw', keyA));
    const rawB = new Uint8Array(await subtle.exportKey('raw', keyB));
    expect(Buffer.from(rawA)).toEqual(Buffer.from(rawB));
  });

  it('round-trips a message encrypted by one peer and decrypted by the other', async () => {
    const a = await makePeer();
    const b = await makePeer();
    const keyA = await deriveShared(a.pair.privateKey, b.pubRaw);
    const keyB = await deriveShared(b.pair.privateKey, a.pubRaw);

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, keyA, new TextEncoder().encode('secret hi'));
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, keyB, ct);
    expect(new TextDecoder().decode(pt)).toBe('secret hi');
  });

  it('independent (non-exchanged) keys fail to decrypt — the original bug', async () => {
    const keyA = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const keyB = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, keyA, new TextEncoder().encode('hi'));
    await expect(subtle.decrypt({ name: 'AES-GCM', iv }, keyB, ct)).rejects.toThrow();
  });
});
