// ============================================================
// Cryptography Engine - Real E2E Encryption
// ============================================================
import { randomBytes, createCipheriv, createDecipheriv, createHash, createHmac,
  timingSafeEqual } from 'node:crypto';

export type CipherType = 'aes256-gcm' | 'chacha20-poly1305' | 'x25519';

const CHACHA_KEY_SIZE = 32; // 256 bits
const IV_SIZE = 12;         // 96 bits for GCM/ChaCha20
const TAG_SIZE = 16;        // 128 bits

// WebCrypto APIs require an ArrayBuffer-backed view. Node's Buffer is typed as
// `Buffer<ArrayBufferLike>`, so copy into a fresh ArrayBuffer-backed Uint8Array.
const toBytes = (b: Buffer): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(b.length);
  out.set(b);
  return out;
};

// --- AES-256-GCM ---
export class AES256GCM {
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async encrypt(plaintext: string, key: CryptoKey, nonce?: Buffer): Promise<{
    ciphertext: Buffer;
    tag: Buffer;
    nonce: Buffer;
  }> {
    const iv = nonce || randomBytes(IV_SIZE);
    const cipher = createCipheriv('aes-256-gcm', await this.keyToBuffer(key), iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'binary');
    ciphertext += cipher.final('binary');
    const tag = cipher.getAuthTag();
    return {
      ciphertext: Buffer.from(ciphertext, 'binary'),
      tag,
      nonce: iv,
    };
  }

  static async decrypt(ciphertext: Buffer, key: CryptoKey, nonce: Buffer, tag: Buffer): Promise<string> {
    const cipher = createDecipheriv('aes-256-gcm', await this.keyToBuffer(key), nonce);
    cipher.setAuthTag(tag);
    let plaintext = cipher.update(ciphertext, undefined, 'utf8');
    plaintext += cipher.final('utf8');
    return plaintext;
  }

  static async deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<Buffer> {
    const bits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: publicKey },
      privateKey,
      256
    );
    return Buffer.from(bits);
  }

  private static async keyToBuffer(key: CryptoKey): Promise<Buffer> {
    const raw = await crypto.subtle.exportKey('raw', key);
    return Buffer.from(raw);
  }
}

// --- ChaCha20-Poly1305 ---
export class ChaCha20Poly1305 {
  static async generateKey(): Promise<Buffer> {
    return randomBytes(CHACHA_KEY_SIZE);
  }

  static generateKeySync(): Buffer {
    return randomBytes(CHACHA_KEY_SIZE);
  }

  static encrypt(plaintext: string, key: Buffer, nonce?: Buffer): Buffer {
    const iv = nonce || randomBytes(IV_SIZE);
    const cipher = createCipheriv('chacha20-poly1305', key, iv, { authTagLength: TAG_SIZE });
    let encrypted = cipher.update(plaintext, 'utf8', 'binary');
    encrypted += cipher.final('binary');
    const authTag = cipher.getAuthTag();

    // Combine: nonce (12) + authTag (16) + ciphertext
    const result = Buffer.alloc(IV_SIZE + TAG_SIZE + encrypted.length);
    iv.copy(result, 0);
    authTag.copy(result, IV_SIZE);
    Buffer.from(encrypted, 'binary').copy(result, IV_SIZE + TAG_SIZE);
    return result;
  }

  static decrypt(encryptedData: Buffer, key: Buffer): string {
    const iv = encryptedData.subarray(0, IV_SIZE);
    const authTag = encryptedData.subarray(IV_SIZE, IV_SIZE + TAG_SIZE);
    const ciphertext = encryptedData.subarray(IV_SIZE + TAG_SIZE);

    const decipher = createDecipheriv('chacha20-poly1305', key, iv, { authTagLength: TAG_SIZE });
    decipher.setAuthTag(authTag);
    let plaintext = decipher.update(ciphertext, undefined, 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }
}

// --- X25519 Key Exchange ---
export class X25519 {
  static async generateKeyPair(): Promise<{
    privateKey: CryptoKey;
    publicKey: CryptoKey;
  }> {
    return await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );
  }

  static async deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<Buffer> {
    const shared = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: publicKey },
      privateKey,
      256
    );
    return Buffer.from(shared);
  }

  static async encryptWithPublicKey(plaintext: string, publicKey: CryptoKey): Promise<{
    ephemeralKey: Buffer;
    ciphertext: Buffer;
    nonce: Buffer;
  }> {
    // Generate ephemeral key pair
    const ephemeral = await this.generateKeyPair();
    // Derive shared secret
    const sharedSecret = await this.deriveSharedSecret(ephemeral.privateKey, publicKey);
    // Derive AES key from shared secret
    const aesKey = await crypto.subtle.importKey(
      'raw',
      toBytes(sharedSecret),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    // Encrypt
    const nonce = randomBytes(IV_SIZE);
    const cipher = createCipheriv('aes-256-gcm', await this.cryptoKeyToBuffer(aesKey), nonce);
    let encrypted = cipher.update(plaintext, 'utf8', 'binary');
    encrypted += cipher.final('binary');
    const tag = cipher.getAuthTag();

    // Export the ephemeral public key so the recipient can derive the same secret
    const ephemeralPublicRaw = Buffer.from(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
    return {
      ephemeralKey: ephemeralPublicRaw,
      ciphertext: Buffer.concat([Buffer.from(encrypted, 'binary'), tag]),
      nonce,
    };
  }

  private static async cryptoKeyToBuffer(key: CryptoKey): Promise<Buffer> {
    const raw = await crypto.subtle.exportKey('raw', key);
    return Buffer.from(raw);
  }
}

// --- HMAC for Message Authentication ---
export class HMAC {
  static sign(data: string | Buffer, key: Buffer): Buffer {
    const hmac = createHmac('sha256', key);
    hmac.update(typeof data === 'string' ? Buffer.from(data) : data);
    return hmac.digest();
  }

  static verify(data: string | Buffer, key: Buffer, signature: Buffer): boolean {
    const expected = this.sign(data, key);
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(expected, signature);
  }
}

// --- Key Derivation ---
export class KeyDerivation {
  static async deriveKeys(masterKey: Buffer, salt: Buffer): Promise<{
    encryptionKey: Buffer;
    macKey: Buffer;
  }> {
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: toBytes(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      await crypto.subtle.importKey('raw', toBytes(masterKey), 'PBKDF2', false, ['deriveBits']),
      512
    );
    const derivedBuffer = Buffer.from(derived);
    return {
      encryptionKey: derivedBuffer.subarray(0, 256 / 8),
      macKey: derivedBuffer.subarray(256 / 8),
    };
  }

  static hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  static generateId(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  static generateShortId(length: number = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt((bytes[i] ?? 0) % chars.length);
    }
    return result;
  }
}
