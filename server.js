// CipherWave Signaling Server with Static File Serving
// Run: npm start
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuration
const PORT = process.env.PORT || 52178;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_ROOM_SIZE = 2; // Maximum clients per room
const MAX_MESSAGE_SIZE = 64 * 1024; // 64KB max message size
const WWW_DIR = path.join(__dirname, 'www');

// Create HTTP server
const server = http.createServer((req, res) => {
    // Parse the request URL
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // Serve index.html for root path
    if (pathname === '/') {
        pathname = '/index.html';
    }
    
    // Construct the file path
    const filePath = path.join(WWW_DIR, pathname);
    
    // Check if the file exists and is within the www directory
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File not found
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        
        // Check if the file is within the www directory (security check)
        if (!filePath.startsWith(WWW_DIR)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('403 Forbidden');
            return;
        }
        
        // Determine content type based on file extension
        const ext = path.extname(filePath);
        let contentType = 'text/plain';
        
        switch (ext) {
            case '.html':
                contentType = 'text/html';
                break;
            case '.css':
                contentType = 'text/css';
                break;
            case '.js':
                contentType = 'text/javascript';
                break;
            case '.json':
                contentType = 'application/json';
                break;
            case '.png':
                contentType = 'image/png';
                break;
            case '.jpg':
            case '.jpeg':
                contentType = 'image/jpeg';
                break;
            case '.gif':
                contentType = 'image/gif';
                break;
            case '.svg':
                contentType = 'image/svg+xml';
                break;
            default:
                contentType = 'application/octet-stream';
        }
        
        // Read and serve the file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
                return;
            }
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
});

// Create WebSocket server on the same HTTP server
const wss = new WebSocket.Server({ 
    server: server,
    clientTracking: true,
    maxPayload: MAX_MESSAGE_SIZE
});

// Store rooms and their participants
const rooms = new Map();

// Logging function with timestamp
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// Validate room ID format
function isValidRoomId(roomId) {
    return typeof roomId === 'string' && roomId.length > 0 && roomId.length <= 50;
}

// Validate message structure
function isValidMessage(data) {
    return data && typeof data === 'object' && data.type && typeof data.type === 'string';
}

// Handle new connections
wss.on('connection', function connection(ws, req) {
    // Get client IP address
    const clientIp = req.socket.remoteAddress;
    log(`New client connected from IP: ${clientIp}`);
    
    // Set connection properties
    ws.clientIp = clientIp;
    ws.roomId = null;
    ws.isInitiator = false;
    
    // Set up ping/pong for connection health
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', function incoming(message) {
        // Check message size
        if (message.length > MAX_MESSAGE_SIZE) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Message too large' 
            }));
            return;
        }
        
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Invalid JSON format' 
            }));
            return;
        }
        
        // Validate message structure
        if (!isValidMessage(data)) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Invalid message structure' 
            }));
            return;
        }
        
        // Handle room joining
        if (data.type === 'join') {
            const roomId = data.room;
            
            // Validate room ID
            if (!isValidRoomId(roomId)) {
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Invalid room ID' 
                }));
                return;
            }
            
            // Check if room already has maximum clients
            const room = rooms.get(roomId);
            if (room && room.size >= MAX_ROOM_SIZE) {
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Room is full' 
                }));
                log(`Client ${clientIp} attempted to join full room: ${roomId}`);
                return;
            }
            
            // Create room if it doesn't exist
            if (!room) {
                rooms.set(roomId, new Set([ws]));
                ws.isInitiator = true;
                log(`Creating new room: ${roomId}`);
            } else {
                room.add(ws);
                ws.isInitiator = false;
                log(`Joining existing room: ${roomId} with ${room.size} client(s)`);
            }
            
            ws.roomId = roomId;
            ws.send(JSON.stringify({ 
                type: 'init', 
                initiator: ws.isInitiator 
            }));
            
            log(`Client ${clientIp} joined room: ${roomId} (initiator: ${ws.isInitiator})`);
            log(`Room ${roomId} now has ${rooms.get(roomId).size} client(s)`);
        } 
        // Relay signaling messages to other peers in the room
        else if (ws.roomId) {
            const room = rooms.get(ws.roomId);
            if (room) {
                room.forEach(peer => {
                    if (peer !== ws && peer.readyState === WebSocket.OPEN) {
                        peer.send(message);
                    }
                });
            }
        }
    });

    // Handle connection close
    ws.on('close', function() {
        log(`Client ${clientIp} disconnected`);
        
        // Remove client from room
        if (ws.roomId) {
            const room = rooms.get(ws.roomId);
            if (room) {
                room.delete(ws);
                log(`Room ${ws.roomId} now has ${room.size} client(s)`);
                
                // Clean up empty rooms
                if (room.size === 0) {
                    rooms.delete(ws.roomId);
                    log(`Room ${ws.roomId} deleted (empty)`);
                }
            }
        }
    });
    
    // Handle errors
    ws.on('error', function(error) {
        log(`WebSocket error for client ${clientIp}: ${error.message}`, 'ERROR');
    });
});

// Implement heartbeat to detect broken connections
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping(() => {});
    });
}, 30000);

// Handle server errors
wss.on('error', function(error) {
    log(`WebSocket server error: ${error.message}`, 'ERROR');
});

// Start the HTTP server
server.listen(PORT, HOST, () => {
    log(`CipherWave server running on ${HOST}:${PORT}`);
    log(`HTTP server accessible at http://${HOST}:${PORT}`);
    log(`WebSocket server accessible at ws://${HOST}:${PORT}`);
    log(`Server started at: ${new Date().toLocaleString()}`);
    log(`Maximum room size: ${MAX_ROOM_SIZE} clients`);
    log(`Maximum message size: ${MAX_MESSAGE_SIZE} bytes`);
});

// Handle server shutdown
process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down gracefully');
    clearInterval(heartbeatInterval);
    
    wss.clients.forEach(ws => {
        ws.close();
    });
    
    server.close(() => {
        log('Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    log(`Uncaught exception: ${err.message}`, 'ERROR');
    console.error(err.stack);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled rejection at: ${promise}, reason: ${reason}`, 'ERROR');
    process.exit(1);
});
