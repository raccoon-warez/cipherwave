// Simple WebSocket signaling server for CipherWave
// Run: node server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0' });

const rooms = {};

wss.on('connection', function connection(ws, req) {
    // Log client IP address for debugging
    const clientIp = req.socket.remoteAddress;
    console.log(`New client connected from IP: ${clientIp}`);
    
    let roomId = null;
    let initiator = false;

    ws.on('message', function incoming(message) {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
            return;
        }
        if (data.type === 'join') {
            roomId = data.room;
            if (!roomId) {
                ws.send(JSON.stringify({ type: 'error', error: 'Room ID required' }));
                return;
            }
            
            // Check if room already has 2 clients
            if (rooms[roomId] && rooms[roomId].length >= 2) {
                ws.send(JSON.stringify({ type: 'error', error: 'Room is full' }));
                console.log(`Client ${clientIp} attempted to join full room: ${roomId}`);
                return;
            }
            
            if (!rooms[roomId]) {
                rooms[roomId] = [];
                initiator = true;
                console.log(`Creating new room: ${roomId}`);
            } else {
                initiator = false;
                console.log(`Joining existing room: ${roomId} with ${rooms[roomId].length} client(s)`);
            }
            
            rooms[roomId].push(ws);
            ws.send(JSON.stringify({ type: 'init', initiator }));
            
            console.log(`Client ${clientIp} joined room: ${roomId} (initiator: ${initiator})`);
            console.log(`Room ${roomId} now has ${rooms[roomId].length} client(s)`);
        } else if (roomId && rooms[roomId]) {
            // Relay signaling messages to other peers in the room
            rooms[roomId].forEach(peer => {
                if (peer !== ws && peer.readyState === WebSocket.OPEN) {
                    peer.send(message);
                }
            });
        }
    });

    ws.on('close', function() {
        console.log(`Client ${clientIp} disconnected`);
        if (roomId && rooms[roomId]) {
            rooms[roomId] = rooms[roomId].filter(peer => peer !== ws);
            console.log(`Room ${roomId} now has ${rooms[roomId].length} client(s)`);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
                console.log(`Room ${roomId} deleted (empty)`);
            }
        }
    });
    
    ws.on('error', function(error) {
        console.error(`WebSocket error for client ${clientIp}:`, error);
    });
});

console.log('CipherWave signaling server running on all interfaces, port 8080');
console.log('Accessible at ws://[your-ip]:8080');
console.log('Server started at:', new Date().toLocaleString());
