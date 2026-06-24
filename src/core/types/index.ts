// ============================================================
// CipherWave Core Type Definitions
// ============================================================

// --- User & Session ---
export interface User {
  id: string;
  nickname: string;
  avatar: string;
  createdAt: number;
  lastSeen: number;
}

export interface PeerSession {
  userId: string;
  // Opaque connection handle. On the server this is a `ws` WebSocket; typed as
  // `unknown` to keep core types free of any specific socket implementation.
  ws: unknown;
  roomId: string;
  isInitiator: boolean;
  connectedAt: number;
  lastPong: number;
  ip: string;
  cipher: CipherType;
  signalKeys?: SignalKeyBundle;
}

export interface Room {
  id: string;
  peers: Map<string, PeerSession>;
  createdAt: number;
  expiresAt: number | null;
  settings: RoomSettings;
}

export interface RoomSettings {
  maxPeers: number;
  selfDestructSeconds: number | null;
  requireAuth: boolean;
  mediaEnabled: boolean;
  fileTransferEnabled: boolean;
}

// --- Encryption ---
export type CipherType = 'aes256-gcm' | 'chacha20' | 'x25519';

export interface EncryptionKey {
  cipher: CipherType;
  publicKey: string;
  privateKey: string;
  sharedKey?: string;
  createdAt: number;
  expiresAt: number | null;
}

export interface EncryptedMessage {
  content: string;
  nonce: string;
  cipher: CipherType;
  timestamp: number;
  messageId: string;
  selfDestructAfter?: number;
}

export interface SignalIdentity {
  signedKeyPair: SignalKeyPair;
  identityKeyPair: SignalKeyPair;
  registrationId: number;
}

export interface SignalKeyPair {
  publicKey: Buffer;
  privateKey: Buffer;
}

export interface SignalPreKey {
  id: number;
  keyPair: SignalKeyPair;
  signature?: string;
}

export interface SignalOneTimePreKey extends SignalPreKey {}

export interface SignalSignedPreKey extends SignalPreKey {
  signature: string;
}

export interface SignalKeyBundle {
  registrationId: number;
  identityKey: SignalKeyPair;
  signedPreKey: SignalSignedPreKey;
  oneTimePreKeys: SignalOneTimePreKey[];
}

export interface MessageEnvelope {
  type: 'key' | 'message' | 'call' | 'presence' | 'file';
  from: string;
  to: string;
  timestamp: number;
  data: unknown;
}

// --- WebSocket Messages ---
export interface SignalingMessage {
  type: 'join' | 'leave' | 'offer' | 'answer' | 'candidate' | 'key-exchange' | 'key-confirm'
    | 'call-offer' | 'call-answer' | 'call-cancel' | 'call-hangup' | 'call-ice'
    | 'typing' | 'media-status' | 'file-meta' | 'file-chunk' | 'file-complete'
    | 'message' | 'delivery-receipt' | 'read-receipt' | 'reaction' | 'self-destruct';
  room?: string;
  data?: Record<string, unknown>;
  payload?: unknown;
}

export interface ChatMessage {
  id: string;
  content: EncryptedMessage;
  senderId: string;
  timestamp: number;
  delivered: boolean;
  read: boolean;
  selfDestructAfter?: number;
  replyTo?: string;
  reactions?: Map<string, string[]>;
}

export interface FileChunk {
  fileId: string;
  chunkIndex: number;
  data: ArrayBuffer;
  totalChunks: number;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  senderId: string;
  timestamp: number;
  chunks: number;
}

export interface CallOffer {
  offer: RTCSessionDescriptionInit;
  media: 'audio' | 'video';
}

export interface CallAnswer {
  answer: RTCSessionDescriptionInit;
  media: 'audio' | 'video';
}

// --- API Types ---
export interface ServerInfo {
  version: string;
  uptime: number;
  activeRooms: number;
  connectedPeers: number;
  nodeCount: number;
  nodeId: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuthToken {
  userId: string;
  roomId: string;
  expiresAt: number;
  token: string;
}

// --- Config ---
export interface ServerConfig {
  port: number;
  host: string;
  redis: RedisConfig;
  maxRoomSize: number;
  maxMessageSize: number;
  roomTtlMinutes: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  rateLimit: RateLimitConfig;
  tls: TLSConfig;
  nodeId: string;
  nodeToken?: string;
  metrics: MetricsConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  prefix: string;
  cluster?: boolean;
}

export interface RateLimitConfig {
  windowMs: number;
  maxConnections: number;
  maxMessagesPerSecond: number;
  maxMessagesPerMinute: number;
}

export interface TLSConfig {
  enabled: boolean;
  certPath?: string;
  keyPath?: string;
}

export interface MetricsConfig {
  enabled: boolean;
  port: number;
  path: string;
}

// --- Events ---
export type ServerEvent =
  | { type: 'peer-joined'; room: string; user: string }
  | { type: 'peer-left'; room: string; user: string }
  | { type: 'room-expired'; room: string }
  | { type: 'node-connected'; nodeId: string }
  | { type: 'node-disconnected'; nodeId: string }
  | { type: 'message-delivered'; messageId: string; roomId: string }
  | { type: 'connection-error'; error: string };
