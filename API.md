# CipherWave API Documentation

## Overview

CipherWave provides both HTTP REST API endpoints and WebSocket connections for real-time P2P messaging with end-to-end encryption.

## Base URL

```
Production: https://api.cipherwave.com
Development: http://localhost:8081
```

## Authentication

CipherWave uses JWT tokens for API authentication (when enabled).

### Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## WebSocket Connection

### Connection URL
```
wss://api.cipherwave.com/ws
ws://localhost:8081 (development)
```

### Connection Protocol

1. **Connect to WebSocket**
2. **Join Room** - Send room join message
3. **Exchange Signaling** - WebRTC offer/answer/candidates
4. **P2P Communication** - Direct encrypted messaging

## REST API Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2025-08-03T17:56:45.337Z",
  "uptime": 1234567,
  "version": "1.0.0",
  "metrics": {
    "cpu": 15.2,
    "memory": 45.8,
    "connections": 127,
    "errorRate": 0.1,
    "responseTime": 12
  }
}
```

### Server Metrics

```http
GET /metrics
```

**Response:** Prometheus-formatted metrics

```
# HELP cipherwave_cpu_usage_percent CPU usage percentage
# TYPE cipherwave_cpu_usage_percent gauge
cipherwave_cpu_usage_percent 15.2

# HELP cipherwave_active_connections Number of active connections
# TYPE cipherwave_active_connections gauge
cipherwave_active_connections 127

# HELP cipherwave_messages_total Total messages processed
# TYPE cipherwave_messages_total counter
cipherwave_messages_total 5432
```

### Server Information

```http
GET /api/info
```

**Response:**
```json
{
  "server": {
    "name": "CipherWave Signaling Server",
    "version": "1.0.0",
    "nodeVersion": "v18.19.4",
    "platform": "linux",
    "uptime": 3600000,
    "environment": "production"
  },
  "features": {
    "encryption": ["Ed25519", "X25519", "ChaCha20-Poly1305"],
    "webrtc": true,
    "clustering": true,
    "rateLimit": true,
    "ddosProtection": true
  },
  "limits": {
    "maxRoomSize": 2,
    "maxConnections": 1000,
    "maxMessageSize": 65536,
    "rateLimit": "100 requests/minute"
  }
}
```

### Room Statistics

```http
GET /api/rooms/stats
```

**Response:**
```json
{
  "totalRooms": 45,
  "activeRooms": 23,
  "totalConnections": 127,
  "averageRoomSize": 1.8,
  "popularRooms": [
    {
      "roomId": "room123",
      "connections": 2,
      "created": "2025-08-03T10:30:00Z"
    }
  ]
}
```

## WebSocket API

### Message Format

All WebSocket messages use JSON format:

```json
{
  "type": "message_type",
  "room": "room_id",
  "data": {},
  "timestamp": 1234567890
}
```

### Join Room

**Client → Server:**
```json
{
  "type": "join",
  "room": "room_id_here"
}
```

**Server → Client:**
```json
{
  "type": "joined",
  "room": "room_id_here",
  "clientId": "client_uuid",
  "roomInfo": {
    "connections": 1,
    "maxSize": 2
  }
}
```

### Room Full

**Server → Client:**
```json
{
  "type": "room_full",
  "room": "room_id_here",
  "message": "Room has reached maximum capacity"
}
```

### Peer Joined

**Server → Client:**
```json
{
  "type": "peer_joined",
  "room": "room_id_here",
  "peerId": "peer_uuid"
}
```

### Peer Left

**Server → Client:**
```json
{
  "type": "peer_left",
  "room": "room_id_here", 
  "peerId": "peer_uuid"
}
```

## WebRTC Signaling

### Initialization

**Server → Client:**
```json
{
  "type": "init",
  "room": "room_id_here",
  "initiator": true
}
```

### Offer

**Client → Server:**
```json
{
  "type": "offer",
  "room": "room_id_here",
  "offer": {
    "type": "offer",
    "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

**Server → Peer:**
```json
{
  "type": "offer",
  "room": "room_id_here",
  "offer": {
    "type": "offer", 
    "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

### Answer

**Client → Server:**
```json
{
  "type": "answer",
  "room": "room_id_here",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

### ICE Candidates

**Client → Server:**
```json
{
  "type": "ice-candidate",
  "room": "room_id_here", 
  "candidate": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "type": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Additional error context"
    }
  },
  "timestamp": "2025-08-03T17:56:45.337Z"
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `ROOM_NOT_FOUND` | Room does not exist | 404 |
| `ROOM_FULL` | Room has reached capacity | 409 |
| `INVALID_MESSAGE` | Malformed message format | 400 |
| `RATE_LIMITED` | Too many requests | 429 |
| `UNAUTHORIZED` | Invalid or missing auth | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `SERVER_ERROR` | Internal server error | 500 |
| `CONNECTION_FAILED` | WebSocket connection failed | - |
| `SIGNALING_ERROR` | WebRTC signaling error | - |

### WebSocket Error Examples

**Rate Limited:**
```json
{
  "type": "error",
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again later.",
    "details": {
      "limit": 100,
      "window": "60s",
      "retryAfter": 30
    }
  }
}
```

**Room Full:**
```json
{
  "type": "error",
  "error": {
    "code": "ROOM_FULL", 
    "message": "Cannot join room: maximum capacity reached",
    "details": {
      "roomId": "room123",
      "maxSize": 2,
      "currentSize": 2
    }
  }
}
```

## Security Features

### Rate Limiting

- **WebSocket connections:** 5 per second per IP
- **HTTP requests:** 100 per minute per IP  
- **Message sending:** 50 per minute per connection

### DDoS Protection

- Connection limits per IP
- Request pattern analysis
- Automatic IP blocking for suspicious activity
- Exponential backoff for repeated violations

### Input Validation

- Message size limits (64KB)
- Room ID format validation
- JSON schema validation
- XSS prevention

### Encryption

- **Key Exchange:** Ed25519 + X25519 ECDH
- **Message Encryption:** ChaCha20-Poly1305 AEAD
- **Perfect Forward Secrecy:** Ephemeral keys per session
- **Authentication:** HMAC message authentication

## Client SDK Examples

### JavaScript Client

```javascript
class CipherWaveClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.room = null;
        this.callbacks = new Map();
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(this.serverUrl);
            
            this.socket.onopen = () => resolve();
            this.socket.onerror = reject;
            this.socket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };
        });
    }
    
    joinRoom(roomId) {
        this.room = roomId;
        this.send({
            type: 'join',
            room: roomId
        });
    }
    
    send(message) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }
    
    on(event, callback) {
        this.callbacks.set(event, callback);
    }
    
    handleMessage(message) {
        const callback = this.callbacks.get(message.type);
        if (callback) {
            callback(message);
        }
    }
}

// Usage
const client = new CipherWaveClient('wss://api.cipherwave.com/ws');

client.on('joined', (message) => {
    console.log('Joined room:', message.room);
});

client.on('peer_joined', (message) => {
    console.log('Peer joined:', message.peerId);
});

await client.connect();
client.joinRoom('my-secure-room');
```

### Python Client Example

```python
import asyncio
import websockets
import json

class CipherWaveClient:
    def __init__(self, server_url):
        self.server_url = server_url
        self.websocket = None
        self.callbacks = {}
    
    async def connect(self):
        self.websocket = await websockets.connect(self.server_url)
        
        async for message in self.websocket:
            data = json.loads(message)
            await self.handle_message(data)
    
    async def join_room(self, room_id):
        await self.send({
            'type': 'join',
            'room': room_id
        })
    
    async def send(self, message):
        if self.websocket:
            await self.websocket.send(json.dumps(message))
    
    def on(self, event, callback):
        self.callbacks[event] = callback
    
    async def handle_message(self, message):
        callback = self.callbacks.get(message['type'])
        if callback:
            await callback(message)

# Usage
async def main():
    client = CipherWaveClient('wss://api.cipherwave.com/ws')
    
    client.on('joined', lambda msg: print(f"Joined room: {msg['room']}"))
    client.on('peer_joined', lambda msg: print(f"Peer joined: {msg['peerId']}"))
    
    await client.connect()

asyncio.run(main())
```

## Testing

### WebSocket Testing with wscat

```bash
# Install wscat
npm install -g wscat

# Connect to server
wscat -c ws://localhost:8081

# Send join message
{"type":"join","room":"test-room"}

# Expected response
{"type":"joined","room":"test-room","clientId":"abc123"}
```

### HTTP API Testing with curl

```bash
# Health check
curl http://localhost:8081/health

# Server info
curl http://localhost:8081/api/info

# Metrics
curl http://localhost:8081/metrics
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Create test config (artillery.yml)
config:
  target: 'ws://localhost:8081'
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "WebSocket connection test"
    weight: 100
    engine: ws

# Run load test
artillery run artillery.yml
```

## Best Practices

### Client Implementation

1. **Connection Management**
   - Implement exponential backoff for reconnections
   - Handle connection state properly
   - Close connections gracefully

2. **Error Handling**
   - Handle all error message types
   - Implement retry logic for transient errors
   - Show user-friendly error messages

3. **Security**
   - Validate all received messages
   - Implement proper key exchange
   - Use secure random generation
   - Clear sensitive data from memory

### Performance Optimization

1. **Message Batching**
   - Batch small messages when possible
   - Use compression for large payloads
   - Implement message queuing

2. **Connection Pooling**
   - Reuse connections when possible
   - Implement connection pooling
   - Monitor connection health

3. **Caching**
   - Cache frequently accessed data
   - Implement client-side caching
   - Use appropriate cache headers

This API documentation provides comprehensive guidance for integrating with CipherWave's secure messaging infrastructure.