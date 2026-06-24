// ============================================================
// Chat orchestration — wires the mesh transport to the E2E crypto.
//
// A factory (not a singleton) so the UI creates one instance and tests can
// spin up several bridged by a mock mesh. On peer join we exchange ECDH public
// keys and derive a per-pair AES key; messages are encrypted per-recipient.
// ============================================================
import { writable, type Writable } from 'svelte/store';
import { createMesh as defaultCreateMesh, type Mesh } from './mesh';
import {
  generateIdentity,
  exportPublicKey,
  deriveSharedKey,
  encrypt,
  decrypt,
  type EncryptedPayload,
} from './e2e';

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  mine: boolean;
}
export interface Peer {
  id: string;
  nickname: string;
  avatar: string;
}
export interface Identity {
  nickname: string;
  id: string;
  avatar: string;
}

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous I/O/0/1
const clampSize = (n: number) => Math.min(64, Math.max(2, n));

/** Parse the capacity encoded in a room code (`<random>~<size>`). */
export function parseRoomCode(code: string): { size: number } {
  const idx = code.lastIndexOf('~');
  const size = idx === -1 ? 8 : parseInt(code.slice(idx + 1), 10);
  return { size: Number.isFinite(size) ? clampSize(size) : 8 };
}

/** Generate a shareable room code: 16 random chars + the capacity suffix. */
export function generateRoomCode(size: number): string {
  const rnd = globalThis.crypto.getRandomValues(new Uint8Array(16));
  let code = '';
  for (let i = 0; i < rnd.length; i++) code += ROOM_CHARS[rnd[i]! % ROOM_CHARS.length];
  return `${code}~${clampSize(size)}`;
}

function avatarOf(nick: string): string {
  return (
    nick
      .split(' ')
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

const rid = () => globalThis.crypto.randomUUID();

export interface Chat {
  peers: Writable<Peer[]>;
  messages: Writable<ChatMessage[]>;
  status: Writable<string>;
  connected: Writable<boolean>;
  roomFull: Writable<boolean>;
  connect(roomCode: string, identity: Identity): Promise<void>;
  sendMessage(text: string): Promise<void>;
  disconnect(): void;
}

export function createChat(createMesh: (code: string) => Mesh = defaultCreateMesh): Chat {
  const peers = writable<Peer[]>([]);
  const messages = writable<ChatMessage[]>([]);
  const status = writable('');
  const connected = writable(false);
  const roomFull = writable(false);

  let mesh: Mesh | null = null;
  let myKeyPair: CryptoKeyPair | null = null;
  let myPub = '';
  let me: Identity | null = null;
  let roomSecret = '';
  let cap = 8;
  const keys = new Map<string, CryptoKey>(); // peerId -> shared AES key
  const nicks = new Map<string, string>(); // peerId -> nickname
  const peerIds = new Set<string>(); // all connected peers (pre/post key)
  const sentKeyTo = new Set<string>(); // peers we've sent our public key to

  function refreshPeers() {
    peers.set(
      [...peerIds]
        .filter(id => nicks.has(id))
        .map(id => ({ id, nickname: nicks.get(id)!, avatar: avatarOf(nicks.get(id)!) })),
    );
  }

  function sendMyKey(peerId: string) {
    if (sentKeyTo.has(peerId) || !mesh || !me) return;
    sentKeyTo.add(peerId);
    mesh.send('key', { pub: myPub, nick: me.nickname }, peerId);
  }

  // Best-effort serverless cap: with a stable id ordering, peers beyond the cap
  // self-eject so every client converges on the same membership.
  function enforceCap() {
    if (!mesh) return;
    const ids = [mesh.selfId, ...peerIds].sort();
    if (ids.indexOf(mesh.selfId) >= cap) {
      roomFull.set(true);
      disconnect();
    }
  }

  async function connect(roomCode: string, identity: Identity) {
    me = identity;
    roomSecret = roomCode;
    cap = parseRoomCode(roomCode).size;
    roomFull.set(false);
    myKeyPair = await generateIdentity();
    myPub = await exportPublicKey(myKeyPair);
    mesh = createMesh(roomCode);
    status.set('Connecting…');

    mesh.on('key', async (payload, peerId) => {
      console.log('[cw] received key from', peerId);
      try {
        const { pub, nick } = payload as { pub: string; nick: string };
        nicks.set(peerId, nick);
        peerIds.add(peerId);
        if (!keys.has(peerId) && myKeyPair) {
          keys.set(peerId, await deriveSharedKey(myKeyPair.privateKey, pub, roomSecret));
          console.log('[cw] derived shared key with', peerId);
        }
        sendMyKey(peerId); // reply (idempotent) so both sides derive
        connected.set(keys.size > 0);
        status.set('Connected');
      } catch (err) {
        console.error('[cw] key exchange failed with', peerId, err);
      } finally {
        refreshPeers();
      }
    });

    mesh.on('msg', async (payload, peerId) => {
      const key = keys.get(peerId);
      if (!key) return;
      try {
        const text = await decrypt(key, payload as EncryptedPayload);
        messages.update(m => [
          ...m,
          {
            id: rid(),
            content: text,
            senderId: peerId,
            senderName: nicks.get(peerId) ?? 'Unknown',
            timestamp: Date.now(),
            mine: false,
          },
        ]);
      } catch (e) {
        console.error('decrypt failed', e);
      }
    });

    mesh.onPeerJoin(peerId => {
      console.log('[cw] peer joined', peerId);
      peerIds.add(peerId);
      // Show the peer immediately (pending key exchange) so the room reflects
      // the Trystero connection even before the encrypted channel is ready.
      if (!nicks.has(peerId)) nicks.set(peerId, 'Connecting…');
      refreshPeers();
      status.set(`Peer connected — securing…`);
      sendMyKey(peerId);
      enforceCap();
    });

    mesh.onPeerLeave(peerId => {
      peerIds.delete(peerId);
      keys.delete(peerId);
      nicks.delete(peerId);
      sentKeyTo.delete(peerId);
      refreshPeers();
      connected.set(keys.size > 0);
      enforceCap();
    });
  }

  async function sendMessage(text: string) {
    const t = text.trim();
    if (!t || !mesh || !me) return;
    for (const [peerId, key] of keys) {
      mesh.send('msg', await encrypt(key, t), peerId);
    }
    messages.update(m => [
      ...m,
      { id: rid(), content: t, senderId: me!.id, senderName: me!.nickname, timestamp: Date.now(), mine: true },
    ]);
  }

  function disconnect() {
    mesh?.leave();
    mesh = null;
    myKeyPair = null;
    me = null;
    roomSecret = '';
    myPub = '';
    keys.clear();
    nicks.clear();
    peerIds.clear();
    sentKeyTo.clear();
    peers.set([]);
    messages.set([]);
    connected.set(false);
    status.set('');
  }

  return { peers, messages, status, connected, roomFull, connect, sendMessage, disconnect };
}
