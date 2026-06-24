# CipherWave Architecture

## Overview

CipherWave v2.0 is a fully decentralized, peer-to-peer messaging platform with end-to-end encryption. It consists of:

1. **Distributed Signaling Server** - WebSocket-based signaling with Redis-backed state
2. **REST API** - HTTP endpoints for room management and server metrics
3. **SvelteKit Frontend** - Modern web application with PWA support
4. **WebRTC Client** - Browser-based P2P communication
5. **Signal Protocol** - Double ratchet for forward secrecy

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐
│   Browser 1     │     │   Browser 2     │
│  (SvelteKit)    │     │  (SvelteKit)    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    WebRTC DataChannel │
         │   (E2E Encrypted)     │
         │                       │
         ▼                       ▼
    ┌─────────────────────────────────┐
    │     Signaling Server (Node.js)   │
    │  - WebSocket (signaling only)    │
    │  - REST API                      │
    │  - Rate Limiting                 │
    └────────────────┬────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │    Redis     │
              │  (State +    │
              │   Pub/Sub)   │
              └──────────────┘
```

## Component Details

### 1. Signaling Server

The signaling server handles:
- WebSocket connections for WebRTC signaling
- Room management (create, join, leave)
- Message relay between peers in the same room
- Distributed coordination via Redis pub/sub

**Key files:**
- `src/server/index.ts` - Main server entry
- `src/server/signaling.ts` - WebSocket signaling logic
- `src/server/api.ts` - REST API routes
- `src/server/config.ts` - Configuration

### 2. Redis State Manager

Redis provides:
- Room state persistence
- Peer tracking (who's in which room)
- Message history caching (last 100 messages)
- Distributed coordination between signaling nodes
- Pub/sub for cross-node messaging

**Key files:**
- `src/core/redis/client.ts` - Redis client
- `src/core/redis/room-manager.ts` - Room operations

### 3. Cryptography

Real cryptographic primitives:
- **AES-256-GCM** - Symmetric encryption (WebCrypto API in browser, node:crypto on server)
- **ChaCha20-Poly1305** - Stream cipher alternative
- **X25519/ECDH** - Key exchange for forward secrecy
- **HMAC-SHA256** - Message authentication
- **PBKDF2** - Key derivation with 100K iterations

**Key files:**
- `src/core/crypto/engine.ts` - Cryptographic primitives
- `src/core/crypto/signal-protocol.ts` - Double ratchet implementation

### 4. Frontend (SvelteKit)

Modern web application:
- **Svelte 5** - Reactive UI framework
- **WebRTC** - P2P media and data channels
- **WebCrypto API** - Browser-side encryption
- **Service Worker** - Offline support (PWA)
- **Responsive** - Mobile-first design

**Key files:**
- `src/client/src/routes/+page.svelte` - Main page
- `src/client/src/lib/signaling-client.ts` - WebSocket client
- `src/client/src/lib/crypto-client.ts` - Browser encryption
- `src/client/src/lib/webrtc-client.ts` - WebRTC management

## Data Flow

### 1. Connection Flow
```
User → Enter Room ID → WebSocket → Signaling Server → Redis (create room)
     → Receive ICE candidates → WebRTC Offer/Answer → P2P Connection Established
```

### 2. Message Flow
```
Sender → Encrypt (AES-256-GCM) → WebSocket → Signaling Server → Redis (cache)
       → Relay to receiver → Decrypt → Display
```

### 3. Distributed Flow
```
Node A → Peer connects → Redis (store peer) → Pub/Sub → Node B, C, D
       → Relay message → Redis pub/sub → Other nodes relay to their peers
```

## Security Model

1. **Transport Security**: TLS for WebSocket connections
2. **End-to-End Encryption**: All messages encrypted before leaving the sender
3. **Forward Secrecy**: Signal Protocol ratchet ensures past messages can't be decrypted if a key is compromised
4. **No Server Storage**: Messages are relayed, never stored (except cached for history)
5. **Rate Limiting**: Protection against DoS attacks
6. **Input Validation**: All inputs validated and sanitized

## Deployment

### Docker Compose
```bash
docker compose up -d
```

This starts:
- Redis (persistent)
- CipherWave server (single instance)
- Nginx (reverse proxy with TLS)

### Multi-Node Deployment
For distributed deployments, run multiple CipherWave instances with the same Redis backend. Each instance registers itself via the `/api/v1/nodes/register` endpoint.
