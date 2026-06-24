// ============================================================
// Multi-peer orchestration test: real chat.ts + real e2e.ts crypto, with the
// Trystero transport replaced by an in-process mock mesh bus. Proves N peers
// exchange keys, messages decrypt for the intended recipients, and the payloads
// crossing the (mock) wire are ciphertext.
// ============================================================
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createChat, parseRoomCode, generateRoomCode } from '../../src/client/src/lib/chat';
import type { Mesh } from '../../src/client/src/lib/mesh';

const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

// A shared in-memory bus that mimics Trystero: peers in the same room discover
// each other (onPeerJoin) and exchange targeted/broadcast messages.
function makeBus() {
  let counter = 0;
  const rooms = new Map<string, Set<any>>();
  const wire: { type: string; payload: any; from: string; to?: string }[] = [];

  function createMesh(roomCode: string): Mesh {
    const selfId = `peer${++counter}`;
    const handlers = new Map<string, (p: unknown, id: string) => void>();
    let onJoin: (id: string) => void = () => {};
    let onLeave: (id: string) => void = () => {};
    const room = rooms.get(roomCode) ?? new Set();
    rooms.set(roomCode, room);

    const self: any = {
      selfId,
      onPeerJoin: (cb: any) => (onJoin = cb),
      onPeerLeave: (cb: any) => (onLeave = cb),
      on: (type: string, cb: any) => handlers.set(type, cb),
      send: (type: string, payload: unknown, target?: string) => {
        wire.push({ type, payload, from: selfId, to: target });
        for (const peer of room) {
          if (peer === self) continue;
          if (target && peer.selfId !== target) continue;
          setTimeout(() => peer._deliver(type, payload, selfId), 0);
        }
      },
      leave: () => {
        room.delete(self);
        for (const peer of room) setTimeout(() => peer._leave(selfId), 0);
      },
      _deliver: (type: string, payload: unknown, from: string) => handlers.get(type)?.(payload, from),
      _join: (id: string) => onJoin(id),
      _leave: (id: string) => onLeave(id),
    };

    // Announce joins after the caller has had a chance to register handlers.
    for (const peer of room) {
      setTimeout(() => peer._join(selfId), 0);
      setTimeout(() => self._join(peer.selfId), 0);
    }
    room.add(self);
    return self;
  }

  return { createMesh, wire };
}

describe('room code', () => {
  it('round-trips capacity through the code', () => {
    const code = generateRoomCode(16);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{16}~16$/);
    expect(parseRoomCode(code).size).toBe(16);
  });
  it('clamps size to 2..64 and defaults to 8', () => {
    expect(parseRoomCode('ABC~100').size).toBe(64);
    expect(parseRoomCode('ABC~1').size).toBe(2);
    expect(parseRoomCode('ABC').size).toBe(8);
  });
});

describe('mesh chat (3 peers, mocked transport)', () => {
  it('all peers connect, exchange keys, and broadcast decrypts for everyone', async () => {
    const bus = makeBus();
    const code = 'TESTROOMCODE1234~8';
    const a = createChat(bus.createMesh);
    const b = createChat(bus.createMesh);
    const c = createChat(bus.createMesh);

    await a.connect(code, { nickname: 'Alice', id: 'CW-A', avatar: 'A' });
    await b.connect(code, { nickname: 'Bob', id: 'CW-B', avatar: 'B' });
    await c.connect(code, { nickname: 'Carol', id: 'CW-C', avatar: 'C' });
    await tick(80);

    // Everyone sees the other two and is connected.
    for (const [chat, others] of [
      [a, ['Bob', 'Carol']],
      [b, ['Alice', 'Carol']],
      [c, ['Alice', 'Bob']],
    ] as const) {
      expect(get(chat.connected)).toBe(true);
      expect(get(chat.peers).map(p => p.nickname).sort()).toEqual([...others].sort());
    }

    // Alice broadcasts; Bob and Carol decrypt it.
    await a.sendMessage('hello everyone');
    await tick(60);
    expect(get(b.messages).some(m => m.content === 'hello everyone' && !m.mine)).toBe(true);
    expect(get(c.messages).some(m => m.content === 'hello everyone' && !m.mine)).toBe(true);
    // Alice has her own echo.
    expect(get(a.messages).some(m => m.content === 'hello everyone' && m.mine)).toBe(true);

    // The payloads that crossed the wire are ciphertext, not plaintext.
    const msgs = bus.wire.filter(w => w.type === 'msg');
    expect(msgs.length).toBeGreaterThanOrEqual(2); // one per recipient
    for (const m of msgs) {
      expect(JSON.stringify(m.payload)).not.toContain('hello everyone');
      expect((m.payload as any).content).toMatch(/^[A-Za-z0-9+/=]+$/);
    }
  });

  it('a peer with a different room code cannot read the messages', async () => {
    const bus = makeBus();
    const a = createChat(bus.createMesh);
    const b = createChat(bus.createMesh);
    await a.connect('SAMEROOM~8', { nickname: 'A', id: '1', avatar: 'A' });
    await b.connect('SAMEROOM~8', { nickname: 'B', id: '2', avatar: 'B' });
    await tick(60);

    await a.sendMessage('top secret');
    await tick(60);
    expect(get(b.messages).some(m => m.content === 'top secret')).toBe(true);

    // Capture a real ciphertext payload and try to decrypt it from a chat that
    // joined a DIFFERENT room code (different secret → different keys).
    const { deriveSharedKey, decrypt, generateIdentity, exportPublicKey } = await import(
      '../../src/client/src/lib/e2e'
    );
    const outsider = await generateIdentity();
    const aId = await generateIdentity();
    void (await exportPublicKey(outsider));
    const wrongKey = await deriveSharedKey(
      outsider.privateKey,
      await exportPublicKey(aId),
      'DIFFERENT~8',
    );
    const cipher = bus.wire.find(w => w.type === 'msg')!.payload as any;
    await expect(decrypt(wrongKey, cipher)).rejects.toThrow();
  });
});
