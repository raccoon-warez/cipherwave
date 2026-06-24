# CipherWave API Documentation

## Base URL
```
http://localhost:8080/api/v1
```

## Authentication
Most endpoints don't require authentication. For self-hosted deployments, you can enable API keys via `NODE_TOKEN`.

## Endpoints

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "nodeId": "cipherwave-node-1",
  "uptime": 1234.56,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Rooms

#### Create Room
```
POST /api/v1/rooms
Content-Type: application/json

{
  "id": "my-secret-room",
  "selfDestructSeconds": 3600,
  "mediaEnabled": true,
  "fileTransferEnabled": true
}
```

**Response 201:**
```json
{
  "success": true,
  "room": {
    "id": "my-secret-room",
    "peerCount": 0,
    "createdAt": 1704067200000,
    "expiresAt": 1704070800000,
    "settings": {
      "maxPeers": 2,
      "selfDestructSeconds": 3600,
      "requireAuth": false,
      "mediaEnabled": true,
      "fileTransferEnabled": true
    }
  }
}
```

#### Get Room Info
```
GET /api/v1/rooms/:id
```

**Response 200:**
```json
{
  "success": true,
  "room": {
    "id": "my-secret-room",
    "peerCount": 2,
    "createdAt": 1704067200000,
    "expiresAt": 1704070800000,
    "settings": { ... }
  }
}
```

#### Get Room Members
```
GET /api/v1/rooms/:id/members
```

**Response 200:**
```json
{
  "success": true,
  "members": [
    { "userId": "CW-ABC123", "online": true },
    { "userId": "CW-DEF456", "online": true }
  ]
}
```

#### Get Message History
```
GET /api/v1/rooms/:id/messages?limit=50
```

**Response 200:**
```json
{
  "success": true,
  "messages": [ ... ],
  "count": 50
}
```

#### Delete Room
```
DELETE /api/v1/rooms/:id
```

**Response 200:**
```json
{
  "success": true,
  "message": "Room deleted"
}
```

### Stats

#### Server Stats
```
GET /api/v1/stats
```

**Response 200:**
```json
{
  "success": true,
  "stats": {
    "nodeId": "cipherwave-node-1",
    "version": "2.0.0",
    "uptime": 1234.56,
    "rooms": 5,
    "peers": 12,
    "messages": 150,
    "memory": {
      "rss": 45678901,
      "heapTotal": 12345678,
      "heapUsed": 9876543,
      "external": 1234567
    },
    "nodeCount": 1
  }
}
```

#### List All Rooms
```
GET /api/v1/rooms
```

**Response 200:**
```json
{
  "success": true,
  "rooms": [
    { "id": "room-1", "peerCount": 2, "createdAt": 1704067200000 }
  ],
  "total": 1
}
```

### Users

#### Check Presence
```
GET /api/v1/users/:id/presence
```

**Response 200:**
```json
{
  "success": true,
  "userId": "CW-ABC123",
  "online": true,
  "roomId": "my-secret-room"
}
```

### Nodes (Distributed)

#### Register Node
```
POST /api/v1/nodes/register
Content-Type: application/json

{
  "nodeId": "node-2",
  "host": "192.168.1.2",
  "port": 8080
}
```

**Response 200:**
```json
{
  "success": true,
  "nodeId": "node-2"
}
```

#### List Nodes
```
GET /api/v1/nodes
```

**Response 200:**
```json
{
  "success": true,
  "nodes": [
    {
      "nodeId": "cipherwave-node-1",
      "host": "0.0.0.0",
      "port": 8080,
      "connectedAt": 1704067200000,
      "version": "2.0.0"
    }
  ]
}
```

## WebSocket Protocol

### Connection
```
ws://localhost:8080
```

### Messages

#### Join Room
```json
{
  "type": "join",
  "room": "my-room",
  "data": {
    "cipher": "aes256-gcm",
    "selfDestruct": 0
  }
}
```

#### Send Message
```json
{
  "type": "message",
  "payload": {
    "content": {
      "data": "encrypted-base64",
      "nonce": "nonce-base64",
      "cipher": "aes256-gcm"
    },
    "messageId": "uuid"
  }
}
```

#### WebRTC Signaling
```json
{
  "type": "offer",
  "payload": {
    "sdp": "...",
    "type": "offer"
  }
}
```

```json
{
  "type": "candidate",
  "payload": {
    "candidate": "...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### Server Messages

#### Init (after joining)
```json
{
  "type": "init",
  "initiator": true,
  "peers": 1
}
```

#### History (recent messages)
```json
{
  "type": "history",
  "messages": [ ... ]
}
```

#### Error
```json
{
  "type": "error",
  "error": "Room is full"
}
```
