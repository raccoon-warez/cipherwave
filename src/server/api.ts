import type { Express } from 'express';
import { getRedisClient } from '../core/redis/client';
import { RoomManager } from '../core/redis/room-manager';
import { config, getNodeId } from './config';

export function registerAPIRoutes(app: Express): void {
  const roomManager = new RoomManager();

  app.post('/api/v1/rooms', async (req, res) => {
    try {
      const { id, selfDestructSeconds = null, mediaEnabled = true, fileTransferEnabled = true } = req.body;
      if (!id || typeof id !== 'string') {
        res.status(400).json({ code: 'INVALID_INPUT', message: 'Room ID is required' });
        return;
      }
      const room = await roomManager.createRoom(id, {
        maxPeers: config.maxRoomSize,
        selfDestructSeconds,
        requireAuth: false,
        mediaEnabled,
        fileTransferEnabled,
      });
      res.status(201).json({
        success: true,
        room: { id: room.id, peerCount: 0, createdAt: room.createdAt, expiresAt: room.expiresAt, settings: room.settings },
      });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.get('/api/v1/rooms/:id', async (req, res) => {
    try {
      const room = await roomManager.getRoom(req.params.id);
      if (!room) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Room not found' });
        return;
      }
      res.json({
        success: true,
        room: { id: room.id, peerCount: room.peers.size, createdAt: room.createdAt, expiresAt: room.expiresAt, settings: room.settings },
      });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.get('/api/v1/rooms/:id/members', async (req, res) => {
    try {
      const members = await roomManager.getPeersInRoom(req.params.id);
      res.json({ success: true, members: members.map(id => ({ userId: id, online: false })) });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.get('/api/v1/rooms/:id/messages', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const messages = await roomManager.getRecentMessages(req.params.id, limit);
      res.json({ success: true, messages, count: messages.length });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.delete('/api/v1/rooms/:id', async (req, res) => {
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.del(`cw:room:${req.params.id}`);
        await redis.del(`cw:room-peers:${req.params.id}`);
        await redis.del(`cw:msg-cache:${req.params.id}`);
      }
      res.json({ success: true, message: 'Room deleted' });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.get('/api/v1/stats', async (_req, res) => {
    try {
      const metrics = await roomManager.getMetrics();
      res.json({
        success: true,
        stats: {
          nodeId: getNodeId(),
          version: '2.0.0',
          uptime: process.uptime(),
          ...metrics,
          memory: process.memoryUsage(),
          nodeCount: 1,
        },
      });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.get('/api/v1/rooms', async (_req, res) => {
    try {
      const rooms = await roomManager.listActiveRooms();
      res.json({ success: true, rooms: rooms.map(id => ({ id, peerCount: 0, createdAt: 0 })), total: rooms.length });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.get('/api/v1/users/:id/presence', async (req, res) => {
    try {
      const roomId = await roomManager.getRoom(req.params.id);
      res.json({ success: true, userId: req.params.id, online: !!roomId, roomId: roomId ? req.params.id : null });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.post('/api/v1/nodes/register', async (req, res) => {
    try {
      res.json({ success: true, nodeId: req.body.nodeId || 'unknown' });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.get('/api/v1/nodes', async (_req, res) => {
    try {
      res.json({ success: true, nodes: [] });
    } catch (err: unknown) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: (err as Error).message });
    }
  });

  app.get('/api/v1/ws/info', (_req, res) => {
    res.json({
      success: true,
      wsEndpoint: `ws://${config.host}:${config.port}`,
      nodeId: getNodeId(),
      version: '2.0.0',
    });
  });
}
