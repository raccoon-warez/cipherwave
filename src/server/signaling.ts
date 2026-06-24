import WebSocket, { WebSocketServer } from 'ws';
import type { Server as HTTPServer } from 'http';
import { createRedisClient } from '../core/redis/client';
import { RoomManager } from '../core/redis/room-manager';
import type { ServerConfig, PeerSession, SignalingMessage } from '../core/types';
import { KeyDerivation } from '../core/crypto/engine';

interface RoomPeers {
  [roomId: string]: Set<WebSocket>;
}

export class SignalingServer {
  private wss: WebSocketServer | null = null;
  private roomPeers: RoomPeers = {};
  private roomManager: RoomManager;
  private config: ServerConfig;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: ServerConfig) {
    this.config = config;
    this.roomManager = new RoomManager();
  }

  async initialize(httpServer: HTTPServer): Promise<void> {
    await createRedisClient(this.config);

    this.wss = new WebSocketServer({
      server: httpServer,
      maxPayload: this.config.maxMessageSize,
      perMessageDeflate: false,
    });

    this.heartbeatTimer = setInterval(
      this.checkConnections.bind(this),
      this.config.heartbeatInterval
    );

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log(`[Signaling] Initialized on node ${this.config.nodeId}`);
  }

  private handleConnection(ws: WebSocket): void {
    const peerId = KeyDerivation.generateShortId(8);
    console.log(`[Signaling] New connection: ${peerId}`);

    (ws as any).isAlive = true;
    ws.on('pong', () => { (ws as any).isAlive = true; });

    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(ws, data, peerId);
    });

    ws.on('close', () => {
      this.handleDisconnect(ws, peerId);
    });

    ws.on('error', (err) => {
      console.error(`[Signaling] Error for ${peerId}:`, err.message);
    });
  }

  private async handleMessage(ws: WebSocket, data: WebSocket.Data, peerId: string): Promise<void> {
    try {
      const raw = typeof data === 'string' ? data : data.toString();

      if (raw.length > this.config.maxMessageSize) {
        this.sendError(ws, 'Message too large');
        return;
      }

      const message: SignalingMessage = JSON.parse(raw);

      switch (message.type) {
        case 'join':
          await this.handleJoin(ws, peerId, message);
          break;
        case 'leave':
          await this.handleLeave(ws, peerId, message);
          break;
        case 'offer':
        case 'answer':
        case 'candidate':
        case 'key-exchange':
        case 'key-confirm':
        case 'call-offer':
        case 'call-answer':
        case 'call-ice':
        case 'call-cancel':
        case 'call-hangup':
        case 'message':
        case 'typing':
        case 'media-status':
        case 'file-meta':
        case 'file-chunk':
        case 'file-complete':
        case 'delivery-receipt':
        case 'read-receipt':
        case 'reaction':
          await this.relayMessage(ws, peerId, message);
          break;
        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (err) {
      console.error(`[Signaling] Parse error:`, err);
      this.sendError(ws, 'Invalid message format');
    }
  }

  private async handleJoin(ws: WebSocket, peerId: string, message: SignalingMessage): Promise<void> {
    const roomId = (message.data?.room || message.room) as string;
    const cipher = (message.data?.cipher as string) || 'aes256-gcm';

    if (!roomId || typeof roomId !== 'string') {
      this.sendError(ws, 'Room ID required');
      return;
    }

    let room = await this.roomManager.getRoom(roomId);
    if (room && room.peers.size >= this.config.maxRoomSize) {
      this.sendError(ws, 'Room is full');
      return;
    }

    if (!room) {
      room = await this.roomManager.createRoom(roomId, {
        maxPeers: this.config.maxRoomSize,
        selfDestructSeconds: (message.data?.selfDestruct as number) || null,
        requireAuth: false,
        mediaEnabled: true,
        fileTransferEnabled: true,
      });
    }

    // A peer joining a room that already has someone becomes the WebRTC
    // initiator (it sends the offer); the first peer waits to receive it.
    // NOTE: must be computed BEFORE adding this peer to room.peers below.
    const isInitiator = (room?.peers.size ?? 0) > 0;

    const session: PeerSession = {
      userId: peerId,
      ws,
      roomId,
      isInitiator,
      connectedAt: Date.now(),
      lastPong: Date.now(),
      ip: (ws as any).remoteAddress || 'unknown',
      cipher: cipher as any,
    };

    if (room) {
      room.peers.set(peerId, session);
    }
    this.roomPeers[roomId] = this.roomPeers[roomId] || new Set();
    this.roomPeers[roomId].add(ws);

    await this.roomManager.addPeer(roomId, session);

    const peerNickname = (message.data?.nickname as string) || `User ${peerId}`;

    ws.send(JSON.stringify({
      type: 'init',
      initiator: isInitiator,
      peers: room?.peers.size || 1,
    }));

    this.notifyRoom(roomId, { type: 'peer-joined', data: { userId: peerId, nickname: peerNickname, isInitiator: false } });

    console.log(`[Signaling] ${peerId} joined room ${roomId}`);
  }

  private async handleLeave(ws: WebSocket, peerId: string, message: SignalingMessage): Promise<void> {
    const roomId = message.data?.room as string;
    if (!roomId) return;
    await this.handleDisconnect(ws, peerId);
  }

  private async relayMessage(ws: WebSocket, _peerId: string, message: SignalingMessage): Promise<void> {
    const roomId = (message.room || message.data?.room) as string | undefined;
    if (!roomId) {
      this.sendError(ws, 'Room ID required');
      return;
    }

    this.notifyRoom(roomId, message, ws);
    await this.roomManager.cacheMessage(roomId, message);
  }

  private notifyRoom(roomId: string, message: unknown, exclude?: WebSocket): void {
    const peers = this.roomPeers[roomId];
    if (!peers) return;

    const data = JSON.stringify(message);
    for (const peer of peers) {
      if (peer !== exclude && peer.readyState === WebSocket.OPEN) {
        peer.send(data);
      }
    }
  }

  private handleDisconnect(ws: WebSocket, peerId: string): void {
    for (const [roomId, peers] of Object.entries(this.roomPeers)) {
      if (peers.has(ws)) {
        peers.delete(ws);
        if (peers.size === 0) {
          delete this.roomPeers[roomId];
        } else {
          this.notifyRoom(roomId, { type: 'peer-left', data: { userId: peerId } });
        }
        this.roomManager.removePeer(roomId, {
          userId: peerId, ws, roomId, isInitiator: false,
          connectedAt: 0, lastPong: 0, ip: '', cipher: 'aes256-gcm',
        });
        console.log(`[Signaling] ${peerId} left room ${roomId}`);
        break;
      }
    }
  }

  private checkConnections(): void {
    if (!this.wss) return;
    this.wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) {
        this.handleDisconnect(ws, '(unknown)');
        return ws.terminate();
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }

  private sendError(ws: WebSocket, error: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', error }));
    }
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.wss) this.wss.close();
    console.log('[Signaling] Server shut down');
  }
}
