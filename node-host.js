// CipherWave Node Host
// node-host.js
// Run: node node-host.js [port]

const WebSocket = require('ws');

// Get port from command line arguments or default to 8080
const port = process.argv[2] || 8080;

// Create WebSocket server bound to all interfaces
const wss = new WebSocket.Server({ port, host: '0.0.0.0' });

// Store rooms and their participants
const rooms = {};

// Handle new connections
wss.on('connection', function connection(ws, req) {
    // Log client IP address for debugging
    const clientIp = req.socket.remoteAddress;
    console.log(`New client connected from IP: ${clientIp}`);
    
    let roomId = null;
    let initiator = false;

    // Handle incoming messages
    ws.on('message', function incoming(message) {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
            return;
        }

        // Handle room joining
        if (data.type === 'join') {
            roomId = data.room;
            if (!roomId) {
                ws.send(JSON.stringify({ type: 'error', error: 'Room ID required' }));
                return;
            }

            // Create room if it doesn't exist
            if (!rooms[roomId]) {
                rooms[roomId] = [];
                initiator = true;
            } else {
                initiator = false;
            }

            // Add client to room
            rooms[roomId].push(ws);
            
            // Notify client if they're the initiator
            ws.send(JSON.stringify({ type: 'init', initiator }));

            console.log(`Client ${clientIp} joined room: ${roomId} (initiator: ${initiator})`);
        } 
        // Relay signaling messages to other peers in the room
        else if (roomId && rooms[roomId]) {
            rooms[roomId].forEach(peer => {
                if (peer !== ws && peer.readyState === WebSocket.OPEN) {
                    peer.send(message);
                }
            });
        }
    });

    // Handle connection close
    ws.on('close', function() {
        console.log(`Client ${clientIp} disconnected`);
        if (roomId && rooms[roomId]) {
            // Remove client from room
            rooms[roomId] = rooms[roomId].filter(peer => peer !== ws);
            
            // Clean up empty rooms
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
                console.log(`Room ${roomId} deleted (empty)`);
            }
        }
    });

    // Handle errors
    ws.on('error', function(error) {
        console.error(`WebSocket error for client ${clientIp}:`, error);
    });
});

// Handle server errors
wss.on('error', function(error) {
    console.error('WebSocket server error:', error);
});

console.log(`CipherWave signaling node running on all interfaces, port ${port}`);
console.log('Accessible at ws://[your-ip]:' + port);
console.log('Press Ctrl+C to stop the node');
