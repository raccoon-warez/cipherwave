// ============================================================
// Mesh transport — public MQTT pub/sub (no WebRTC).
//
// Why not WebRTC: direct browser-to-browser WebRTC fails in many real
// environments (NAT, mDNS isolation) and free TURN relays are unreliable, so
// peers never connect. Instead we relay through a public MQTT broker.
//
// RELAY-PROOF: every payload is encrypted with a key derived from the room code
// (deriveRoomKey). The broker never learns the room code (only a SHA-256 hash of
// it, used as the topic), so it sees nothing but opaque ciphertext — presence,
// nicknames, key exchange, and messages are all unreadable to it. (Messages also
// carry a second, per-pair ECDH layer inside, applied by chat.ts.)
// ============================================================
import mqtt from 'mqtt';
import { deriveRoomKey, encrypt, decrypt, type EncryptedPayload } from './e2e';

// Public MQTT-over-WebSocket brokers (auto-reconnect / failover across the list).
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];
const TOPIC_PREFIX = 'cipherwave/v3/';

export interface Mesh {
  readonly selfId: string;
  onPeerJoin(cb: (peerId: string) => void): void;
  onPeerLeave(cb: (peerId: string) => void): void;
  on(type: string, cb: (payload: unknown, peerId: string) => void): void;
  send(type: string, payload: unknown, target?: string): void;
  leave(): void;
}

type Envelope =
  | { t: 'hello' | 'hi' | 'bye'; from: string }
  | { t: 'app'; from: string; to?: string; type: string; d: unknown };

const randomId = () => globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);

// The broker only ever sees this hash, never the room code.
async function topicFor(roomCode: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('cipherwave-room|' + roomCode),
  );
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return TOPIC_PREFIX + hex.slice(0, 40);
}

export function createMesh(roomCode: string): Mesh {
  // Test affordance: a harness may swap the transport (e.g. for screenshots /
  // deterministic e2e) by setting globalThis.__cwMeshFactory.
  const override = (globalThis as unknown as { __cwMeshFactory?: (c: string) => Mesh }).__cwMeshFactory;
  if (typeof override === 'function') return override(roomCode);

  const selfId = randomId();
  const handlers = new Map<string, (payload: unknown, peerId: string) => void>();
  const knownPeers = new Set<string>();
  let onJoin: (peerId: string) => void = () => {};
  let onLeave: (peerId: string) => void = () => {};

  let client: mqtt.MqttClient | null = null;
  let roomKey: CryptoKey | null = null;
  let topic = '';
  let connected = false;
  const outbox: Envelope[] = [];

  console.log('[cw mesh] mqtt mesh, selfId =', selfId);

  async function flush() {
    if (!roomKey || !connected || !client) return;
    const pending = outbox.splice(0);
    for (const env of pending) {
      const enc = await encrypt(roomKey, JSON.stringify(env));
      client.publish(topic, JSON.stringify(enc), { qos: 0 });
    }
  }

  function publish(env: Envelope) {
    outbox.push(env);
    void flush();
  }

  function notePeer(peerId: string) {
    if (!knownPeers.has(peerId)) {
      knownPeers.add(peerId);
      console.log('[cw mesh] peer appeared', peerId);
      onJoin(peerId);
    }
  }

  (async () => {
    roomKey = await deriveRoomKey(roomCode);
    topic = await topicFor(roomCode);
    // Last-Will: the broker publishes this (encrypted) "bye" if we drop without
    // a clean disconnect (e.g. tab/window closed), so peers see us leave.
    const will = await encrypt(roomKey, JSON.stringify({ t: 'bye', from: selfId }));

    client = mqtt.connect(BROKERS[0]!, {
      clientId: 'cw-' + selfId,
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 8000,
      will: { topic, payload: JSON.stringify(will), qos: 0, retain: false },
      servers: BROKERS.map(url => {
        const u = new URL(url);
        return { host: u.hostname, port: Number(u.port), protocol: 'wss' as const, path: u.pathname };
      }),
    });

    client.on('connect', () => {
      console.log('[cw mesh] mqtt connected');
      client!.subscribe(topic, { qos: 0 }, () => {
        connected = true;
        publish({ t: 'hello', from: selfId }); // announce presence
        void flush();
      });
    });

    client.on('reconnect', () => console.log('[cw mesh] mqtt reconnecting…'));
    client.on('error', e => console.warn('[cw mesh] mqtt error:', (e as Error).message));

    client.on('message', async (_topic, payload) => {
      if (!roomKey) return;
      let env: Envelope;
      try {
        const enc = JSON.parse(payload.toString()) as EncryptedPayload;
        env = JSON.parse(await decrypt(roomKey, enc)) as Envelope;
      } catch {
        return; // not for us / wrong room key / malformed
      }
      if (!env || (env as { from?: string }).from === selfId) return; // ignore our own

      if (env.t === 'hello' || env.t === 'hi') {
        notePeer(env.from);
        if (env.t === 'hello') publish({ t: 'hi', from: selfId }); // let the newcomer learn us
      } else if (env.t === 'bye') {
        if (knownPeers.delete(env.from)) onLeave(env.from);
      } else if (env.t === 'app') {
        if (env.to && env.to !== selfId) return; // targeted at someone else
        notePeer(env.from);
        handlers.get(env.type)?.(env.d, env.from);
      }
    });
  })();

  return {
    selfId,
    onPeerJoin(cb) {
      onJoin = cb;
    },
    onPeerLeave(cb) {
      onLeave = cb;
    },
    on(type, cb) {
      handlers.set(type, cb);
    },
    send(type, payload, target) {
      console.log('[cw mesh] send', type, target ? `→ ${target}` : '(broadcast)');
      publish({ t: 'app', from: selfId, to: target, type, d: payload });
    },
    leave() {
      // Clean leave: tell peers, then disconnect (this also cancels the Will).
      publish({ t: 'bye', from: selfId });
      // Give the bye a moment to flush before closing the socket.
      setTimeout(() => {
        try {
          client?.end();
        } catch {
          /* ignore */
        }
      }, 150);
    },
  };
}
