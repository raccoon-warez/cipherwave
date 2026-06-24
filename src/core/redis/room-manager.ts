import type { Redis } from 'ioredis';
import type { Room, RoomSettings, PeerSession, ServerEvent } from '../types';
import { getRedisClient } from './client';

export class RoomManager {
  private redis: Redis | null;
  private prefix: string;
  private memoryRooms = new Map<string, Room>();
  private memoryPeers = new Map<string, string>();
  private memoryRoomPeers = new Map<string, Set<string>>();

  constructor() {
    this.redis = getRedisClient();
    this.prefix = 'cw:';
  }

  private key(type: string, id: string): string {
    return `${this.prefix}${type}:${id}`;
  }

  async createRoom(roomId: string, settings: RoomSettings): Promise<Room> {
    const room: Room = {
      id: roomId,
      peers: new Map(),
      createdAt: Date.now(),
      expiresAt: settings.selfDestructSeconds ? Date.now() + settings.selfDestructSeconds * 1000 : null,
      settings,
    };

    this.memoryRooms.set(roomId, room);

    if (this.redis) {
      await this.redis.hset(this.key('room', roomId), {
        json: JSON.stringify(room),
        createdAt: String(room.createdAt),
        expiresAt: room.expiresAt?.toString() || '0',
        peerCount: '0',
      });
    }

    await this.broadcastEvent({ type: 'peer-joined', room: roomId, user: 'system' });
    return room;
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const cached = this.memoryRooms.get(roomId);
    if (cached) return cached;

    if (this.redis) {
      const data = await this.redis.hgetall(this.key('room', roomId));
      if (data?.json) {
        const room = JSON.parse(data.json) as Room;
        // `peers` was a Map when serialized, so JSON.parse yields a plain object
        // (or `{}`). Revive it as a Map so callers can use .size/.set/.get.
        room.peers = new Map<string, PeerSession>(
          room.peers && typeof room.peers === 'object'
            ? (Object.entries(room.peers) as [string, PeerSession][])
            : []
        );
        return room;
      }
    }
    return null;
  }

  async addPeer(roomId: string, peer: PeerSession): Promise<void> {
    this.memoryPeers.set(peer.userId, roomId);
    this.memoryRoomPeers.get(roomId)?.add(peer.userId);

    if (this.redis) {
      await this.redis.hset(this.key('peer', peer.userId), {
        roomId,
        wsId: 'local',
        isInitiator: String(peer.isInitiator),
        connectedAt: String(peer.connectedAt),
        cipher: peer.cipher,
        nodeId: process.env.NODE_ID || 'unknown',
      });
    }

    await this.broadcastEvent({ type: 'peer-joined', room: roomId, user: peer.userId });
  }

  async removePeer(roomId: string, peer: PeerSession): Promise<void> {
    this.memoryPeers.delete(peer.userId);
    this.memoryRoomPeers.get(roomId)?.delete(peer.userId);

    // Remove the peer from the room's roster so the room frees up; without this
    // room.peers grows monotonically and the room is "full" forever.
    const room = this.memoryRooms.get(roomId);
    if (room) {
      room.peers.delete(peer.userId);
      if (room.peers.size === 0) {
        this.memoryRooms.delete(roomId);
        this.memoryRoomPeers.delete(roomId);
      }
    }

    if (this.redis) {
      await this.redis.del(this.key('peer', peer.userId));
    }

    await this.broadcastEvent({ type: 'peer-left', room: roomId, user: peer.userId });
  }

  async getPeersInRoom(roomId: string): Promise<string[]> {
    return Array.from(this.memoryRoomPeers.get(roomId) || []);
  }

  async isRoomFull(roomId: string, maxSize: number): Promise<boolean> {
    const peers = this.memoryRoomPeers.get(roomId);
    return peers ? peers.size >= maxSize : false;
  }

  async listActiveRooms(): Promise<string[]> {
    return Array.from(this.memoryRooms.keys());
  }

  async cacheMessage(roomId: string, _message: unknown): Promise<void> {
    if (!this.memoryRoomPeers.has(roomId)) return;
  }

  async getRecentMessages(_roomId: string, _limit: number = 50): Promise<unknown[]> {
    return [];
  }

  async heartbeatPeer(_userId: string, _roomId: string): Promise<void> {}

  async getOfflinePeers(): Promise<string[]> { return []; }

  async broadcastEvent(_event: ServerEvent): Promise<void> {}

  async publishToRoom(_roomId: string, _message: unknown): Promise<void> {}

  async cleanupExpiredRooms(): Promise<number> { return 0; }

  async getMetrics(): Promise<{ rooms: number; peers: number; messages: number }> {
    return {
      rooms: this.memoryRooms.size,
      peers: this.memoryPeers.size,
      messages: 0,
    };
  }
}
