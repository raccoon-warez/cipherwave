// ============================================================
// Server Configuration
// ============================================================
import dotenv from 'dotenv';
import type { ServerConfig } from '../core/types';

dotenv.config();

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    prefix: 'cw:',
    cluster: process.env.REDIS_CLUSTER === 'true',
  },
  maxRoomSize: parseInt(process.env.MAX_ROOM_SIZE || '2', 10),
  maxMessageSize: parseInt(process.env.MAX_MESSAGE_SIZE || '65536', 10),
  roomTtlMinutes: parseInt(process.env.ROOM_TTL_MINUTES || '60', 10),
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
  connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '60000', 10),
  rateLimit: {
    windowMs: 60000,
    maxConnections: 50,
    maxMessagesPerSecond: 30,
    maxMessagesPerMinute: 600,
  },
  tls: {
    enabled: process.env.TLS_ENABLED === 'true',
    certPath: process.env.TLS_CERT_PATH,
    keyPath: process.env.TLS_KEY_PATH,
  },
  nodeId: process.env.NODE_ID || crypto.randomUUID(),
  nodeToken: process.env.NODE_TOKEN,
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    port: parseInt(process.env.METRICS_PORT || '9090', 10),
    path: '/metrics',
  },
};

export function getNodeId(): string {
  return config.nodeId;
}
