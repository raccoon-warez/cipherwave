// ============================================================
// Tests for the pairwise mesh E2E crypto (src/client/src/lib/e2e.ts)
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  generateIdentity,
  exportPublicKey,
  deriveSharedKey,
  deriveRoomKey,
  encrypt,
  decrypt,
} from '../../src/client/src/lib/e2e';

const ROOM = 'ROOMSECRET~8';

async function peer() {
  const id = await generateIdentity();
  return { id, pub: await exportPublicKey(id) };
}

describe('E2E pairwise key agreement', () => {
  it('two peers derive the same key and round-trip a message', async () => {
    const a = await peer();
    const b = await peer();
    const keyA = await deriveSharedKey(a.id.privateKey, b.pub, ROOM);
    const keyB = await deriveSharedKey(b.id.privateKey, a.pub, ROOM);

    const msg = await encrypt(keyA, 'hello mesh');
    expect(await decrypt(keyB, msg)).toBe('hello mesh');
    // and the other direction
    const msg2 = await encrypt(keyB, 'hi back');
    expect(await decrypt(keyA, msg2)).toBe('hi back');
  });

  it('different pairs derive different keys (per-pair isolation)', async () => {
    const a = await peer();
    const b = await peer();
    const c = await peer();
    const keyAB = await deriveSharedKey(a.id.privateKey, b.pub, ROOM);
    const keyAC = await deriveSharedKey(a.id.privateKey, c.pub, ROOM);

    // A message for B cannot be read by C
    const forB = await encrypt(keyAB, 'secret for B');
    await expect(decrypt(keyAC, forB)).rejects.toThrow();
  });

  it('binds the key to the room secret — a different room code cannot decrypt', async () => {
    const a = await peer();
    const b = await peer();
    const keyRoom1 = await deriveSharedKey(a.id.privateKey, b.pub, 'ROOM-ONE~8');
    const keyRoom2 = await deriveSharedKey(b.id.privateKey, a.pub, 'ROOM-TWO~8');

    const msg = await encrypt(keyRoom1, 'room-bound');
    // Same peers, different room secret → keys differ → decrypt fails.
    await expect(decrypt(keyRoom2, msg)).rejects.toThrow();
  });

  it('an outsider (wrong identity) cannot decrypt', async () => {
    const a = await peer();
    const b = await peer();
    const outsider = await peer();
    const keyAB = await deriveSharedKey(a.id.privateKey, b.pub, ROOM);
    const keyOutsider = await deriveSharedKey(outsider.id.privateKey, a.pub, ROOM);

    const msg = await encrypt(keyAB, 'members only');
    await expect(decrypt(keyOutsider, msg)).rejects.toThrow();
  });

  it('room-key transport encryption: same code decrypts, the relay (no code) cannot', async () => {
    const keyA = await deriveRoomKey('ROOMCODE~8');
    const keyB = await deriveRoomKey('ROOMCODE~8'); // another member, same code
    const relayGuess = await deriveRoomKey('WRONGCODE~8'); // relay doesn't know the code

    const env = await encrypt(keyA, JSON.stringify({ t: 'hello', from: 'x', nick: 'Alice' }));
    expect(JSON.stringify(env)).not.toContain('Alice'); // nickname not leaked in the clear
    expect(await decrypt(keyB, env)).toContain('Alice'); // a member can read it
    await expect(decrypt(relayGuess, env)).rejects.toThrow(); // the relay cannot
  });

  it('ciphertext is not the plaintext and uses a fresh nonce each time', async () => {
    const a = await peer();
    const b = await peer();
    const key = await deriveSharedKey(a.id.privateKey, b.pub, ROOM);
    const m1 = await encrypt(key, 'same text');
    const m2 = await encrypt(key, 'same text');
    expect(m1.content).not.toContain('same text');
    expect(m1.nonce).not.toBe(m2.nonce);
    expect(m1.content).not.toBe(m2.content);
  });
});
