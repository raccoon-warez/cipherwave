# Migration Guide: v1.x → v2.0

## What Changed

### Architecture
- **Old**: Single Node.js file (`server.js`) with Express + ws
- **New**: Modular TypeScript project with separate server, client, and core modules

### Cryptography
- **Old**: Simulated RSA/ChaCha20 (actually used AES internally)
- **New**: Real AES-256-GCM, ChaCha20-Poly1305, and X25519 key exchange

### Signaling
- **Old**: In-memory room state
- **New**: Redis-backed distributed state with pub/sub

### Frontend
- **Old**: Vanilla JS + HTML
- **New**: SvelteKit with TypeScript, WebCrypto API, PWA support

### API
- **Old**: WebSocket-only protocol
- **New**: WebSocket + REST API with OpenAPI-compatible endpoints

## Breaking Changes

| Area | v1.x | v2.0 |
|------|------|------|
| Server port | 8080 or 52178 | 8080 (configurable) |
| Room limit | 2 peers | 2 peers (configurable) |
| Encryption | Client-selected, server-relayed | ECDH key exchange over TLS |
| Message format | Plain JSON | Encrypted envelope with HMAC |
| WebSocket path | Root (`/`) | Root (`/`) |
| Room ID | Any string | Alphanumeric, 12-32 chars |

## How to Upgrade

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Redis
```bash
# Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or install locally
brew install redis
redis-server
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env as needed
```

### 4. Start the Server
```bash
npm run dev
```

### 5. Access the App
Open `http://localhost:5173`

## Signal Protocol

v2.0 uses the Signal Protocol for key exchange. This means:

1. **Automatic key rotation**: Keys rotate after each message
2. **Forward secrecy**: Compromised keys don't expose past messages
3. **Post-compromise recovery**: Keys recover after a compromise

If you were manually exchanging encryption keys in v1.x, this is now automatic.

## API Changes

### WebSocket Protocol

The WebSocket protocol remains compatible, but message formats have changed:

```json
// v1.x
{ "type": "message", "content": "base64encrypted" }

// v2.0
{
  "type": "message",
  "payload": {
    "content": {
      "data": "base64",
      "nonce": "base64",
      "cipher": "aes256-gcm"
    },
    "messageId": "uuid"
  }
}
```

### New REST Endpoints

v2.0 adds REST endpoints for room management:

```bash
# Create a room
curl -X POST http://localhost:8080/api/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{"id":"my-room"}'
```

See [docs/api.md](api.md) for full API reference.

## Docker Deployment

v2.0 includes Docker support out of the box:

```bash
docker compose up -d
```

## Testing

v2.0 includes a comprehensive test suite:

```bash
npm test
npm run test:coverage
npx playwright test
```

## Troubleshooting

### Redis Connection Failed
```bash
# Check Redis is running
redis-cli ping

# Should return: PONG
```

### Port Already in Use
```bash
# Change port in .env
PORT=8081
```

### TypeScript Errors
```bash
npm run typecheck
npm run lint
```
