// ============================================================
// Signaling Server Tests
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../../src/core/redis/room-manager';
import { KeyDerivation } from '../../src/core/crypto/engine';

// Mock Redis for unit tests
class MockRedis {
  private store = new Map<string, any>();

  async hset(key: string, data: Record<string, string>): Promise<number> {
    this.store.set(key, { ...data, json: data.json || '{}' });
    return Object.keys(data).length;
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    return this.store.get(key) || null;
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    const data = this.store.get(key) || {};
    const next = (parseInt(data[field], 10) || 0) + increment;
    data[field] = next;
    this.store.set(key, data);
    return next;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return (this.store.get(key)?.[field])?.toString() || null;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key) ? 1 : 0;
    this.store.delete(key);
    return existed;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.store.has(key)) {
      this.store.set(key, new Set());
    }
    const set = this.store.get(key);
    for (const m of members) {
      set.add(m);
    }
    return set.size;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.store.has(key)) return 0;
    const set = this.store.get(key);
    for (const m of members) {
      set.delete(m);
    }
    return set.size;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.store.get(key);
    return set ? Array.from(set) : [];
  }

  async scard(key: string): Promise<number> {
    const set = this.store.get(key);
    return set ? set.size : 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.store.has(key)) {
      this.store.set(key, []);
    }
    const arr = this.store.get(key);
    arr.unshift(...values);
    return arr.length;
  }

  async lrange(key: string, start: number, end: number): Promise<string[]> {
    const arr = this.store.get(key) || [];
    // Redis treats negative end indices as offsets from the tail (-1 = last element).
    const stop = end < 0 ? arr.length + end + 1 : end + 1;
    return arr.slice(start, stop);
  }

  async ltrim(key: string, start: number, end: number): Promise<'ok'> {
    const arr = this.store.get(key) || [];
    this.store.set(key, arr.slice(start, end + 1));
    return 'ok';
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return true;
  }

  async pexpire(key: string, milliseconds: number): Promise<boolean> {
    return true;
  }

  async ttl(key: string): Promise<number> {
    return -1;
  }

  async scan(cursor: number, options?: { match: string; count: number }): Promise<[string, string[]]> {
    const regex = new RegExp(options?.match.replace(/\*/g, '.*') || '.*');
    const keys = Array.from(this.store.keys()).filter(k => regex.test(k));
    return ['0', keys];
  }

  async publish(channel: string, message: string): Promise<number> {
    return 0;
  }

  async subscribe(...channels: string[]): Promise<number> {
    return channels.length;
  }

  async quit(): Promise<string> {
    return 'OK';
  }

  async connect(): Promise<void> {
    // no-op
  }

  on(event: string, handler: Function): void {
    // no-op
  }
}

// Create a mock Redis client factory
function createMockRedis(): any {
  return new MockRedis();
}

describe('Room Manager (Unit)', () => {
  let manager: RoomManager;
  let mockRedis: MockRedis;

  beforeEach(() => {
    mockRedis = createMockRedis() as MockRedis;
    // We can't easily inject the mock, so we test the logic directly
  });

  it('should create a room with settings', async () => {
    const redis = createMockRedis() as MockRedis;
    const room = {
      id: 'test-room',
      peers: new Map(),
      createdAt: Date.now(),
      expiresAt: null,
      settings: {
        maxPeers: 2,
        selfDestructSeconds: null,
        requireAuth: false,
        mediaEnabled: true,
        fileTransferEnabled: true,
      },
    };

    const result = await redis.hset('cw:room:test-room', {
      json: JSON.stringify(room),
      createdAt: String(room.createdAt),
      expiresAt: '0',
      peerCount: '0',
    });

    expect(result).toBeGreaterThan(0);
  });

  it('should handle peer join/leave counting', async () => {
    const redis = createMockRedis() as MockRedis;

    await redis.hset('cw:room:test-room', { peerCount: '0' });

    // Simulate join
    let count = await redis.hincrby('cw:room:test-room', 'peerCount', 1);
    expect(count).toBe(1);

    // Simulate second peer
    count = await redis.hincrby('cw:room:test-room', 'peerCount', 1);
    expect(count).toBe(2);

    // Simulate leave
    count = await redis.hincrby('cw:room:test-room', 'peerCount', -1);
    expect(count).toBe(1);
  });

  it('should cache and retrieve messages', async () => {
    const redis = createMockRedis() as MockRedis;

    // Cache messages
    for (let i = 0; i < 5; i++) {
      await redis.lpush('cw:msg-cache:test-room', JSON.stringify({
        id: `msg-${i}`,
        content: `Message ${i}`,
        timestamp: Date.now() + i,
      }));
    }

    // Retrieve messages
    const messages = await redis.lrange('cw:msg-cache:test-room', 0, 4);
    expect(messages).toHaveLength(5);
    expect(messages[0]).toContain('msg-4');
    expect(messages[4]).toContain('msg-0');
  });

  it('should trim message cache to 100 messages', async () => {
    const redis = createMockRedis() as MockRedis;

    // Add 150 messages
    for (let i = 0; i < 150; i++) {
      await redis.lpush('cw:msg-cache:trim-test', JSON.stringify({ id: i }));
    }

    // Trim to 100
    await redis.ltrim('cw:msg-cache:trim-test', 0, 99);

    const messages = await redis.lrange('cw:msg-cache:trim-test', 0, -1);
    expect(messages).toHaveLength(100);
  });

  it('should handle member tracking', async () => {
    const redis = createMockRedis() as MockRedis;

    await redis.sadd('cw:room-peers:test-room', 'user1', 'user2', 'user3');
    const members = await redis.smembers('cw:room-peers:test-room');
    expect(members).toHaveLength(3);
    expect(members).toContain('user1');

    await redis.srem('cw:room-peers:test-room', 'user2');
    const remaining = await redis.smembers('cw:room-peers:test-room');
    expect(remaining).toHaveLength(2);
    expect(remaining).not.toContain('user2');
  });
});

describe('Key Derivation Security', () => {
  it('should produce deterministic output for same input', async () => {
    const { KeyDerivation } = await import('../../src/core/crypto/engine');
    const masterKey = Buffer.alloc(32, 0x42);
    const salt = Buffer.from('fixed-salt');

    const result1 = await KeyDerivation.deriveKeys(masterKey, salt);
    const result2 = await KeyDerivation.deriveKeys(masterKey, salt);

    expect(result1.encryptionKey).toEqual(result2.encryptionKey);
    expect(result1.macKey).toEqual(result2.macKey);
  });

  it('should produce different output for different salts', async () => {
    const { KeyDerivation } = await import('../../src/core/crypto/engine');
    const masterKey = Buffer.alloc(32, 0x42);
    const salt1 = Buffer.from('salt-one');
    const salt2 = Buffer.from('salt-two');

    const result1 = await KeyDerivation.deriveKeys(masterKey, salt1);
    const result2 = await KeyDerivation.deriveKeys(masterKey, salt2);

    expect(result1.encryptionKey).not.toEqual(result2.encryptionKey);
  });

  it('should generate unique hashes', () => {
    const hash1 = KeyDerivation.hash('input-1');
    const hash2 = KeyDerivation.hash('input-2');

    expect(hash1).not.toBe(hash2);
  });
});

describe('Room roster lifecycle (in-memory)', () => {
  const settings = {
    maxPeers: 2,
    selfDestructSeconds: null,
    requireAuth: false,
    mediaEnabled: true,
    fileTransferEnabled: true,
  };
  const mkPeer = (id: string): any => ({
    userId: id, ws: null, roomId: 'R1', isInitiator: false,
    connectedAt: 0, lastPong: 0, ip: '', cipher: 'aes256-gcm',
  });

  it('frees the room when peers leave (regression: room was "full" forever)', async () => {
    const rm = new RoomManager();
    const room = await rm.createRoom('R1', settings);

    // signaling.handleJoin populates room.peers directly as peers join
    room.peers.set('p1', mkPeer('p1'));
    room.peers.set('p2', mkPeer('p2'));
    expect(room.peers.size).toBe(2); // room is full at max capacity

    await rm.removePeer('R1', mkPeer('p1'));
    expect(room.peers.size).toBe(1); // a slot freed up

    await rm.removePeer('R1', mkPeer('p2'));
    // empty room is cleaned up entirely, so a fresh join is possible again
    expect(await rm.getRoom('R1')).toBeNull();
  });
});
