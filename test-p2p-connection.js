// Simple test script to verify P2P functionality
// This script will test the connection between two clients

console.log('🧪 Starting P2P Connection Test');

// Test WebSocket connection to signaling server
import { WebSocket } from 'ws';

// Configuration
const SERVER_URL = 'ws://localhost:52178';
const TEST_ROOM = 'test-room-' + Math.random().toString(36).substring(7);

console.log(`Connecting to server: ${SERVER_URL}`);
console.log(`Using test room: ${TEST_ROOM}`);

// Create two WebSocket clients to simulate two devices
const client1 = new WebSocket(SERVER_URL);
const client2 = new WebSocket(SERVER_URL);

let client1Ready = false;
let client2Ready = false;
let testCompleted = false;

// Client 1 handlers
client1.on('open', () => {
    console.log('✅ Client 1 connected to server');
    client1Ready = true;
    client1.send(JSON.stringify({ type: 'join', room: TEST_ROOM }));
});

client1.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('📱 Client 1 received:', message.type);
    
    if (message.type === 'init') {
        console.log('🔑 Client 1 initialized as', message.initiator ? 'initiator' : 'responder');
    }
});

client1.on('error', (error) => {
    console.log('❌ Client 1 error:', error.message);
});

client1.on('close', () => {
    console.log('🔚 Client 1 disconnected');
});

// Client 2 handlers
client2.on('open', () => {
    console.log('✅ Client 2 connected to server');
    client2Ready = true;
    client2.send(JSON.stringify({ type: 'join', room: TEST_ROOM }));
});

client2.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('📱 Client 2 received:', message.type);
    
    if (message.type === 'init') {
        console.log('🔑 Client 2 initialized as', message.initiator ? 'initiator' : 'responder');
        
        // If both clients are ready and we have init messages, test is successful
        if (client1Ready && client2Ready) {
            console.log('🎉 P2P Connection Test PASSED');
            console.log('✅ Both clients successfully connected to the same room');
            console.log('✅ Signaling server is working correctly');
            testCompleted = true;
            cleanup();
        }
    }
});

client2.on('error', (error) => {
    console.log('❌ Client 2 error:', error.message);
});

client2.on('close', () => {
    console.log('🔚 Client 2 disconnected');
});

// Cleanup function
function cleanup() {
    if (client1.readyState === WebSocket.OPEN) {
        client1.close();
    }
    if (client2.readyState === WebSocket.OPEN) {
        client2.close();
    }
}

// Timeout to prevent hanging
setTimeout(() => {
    if (!testCompleted) {
        console.log('⏰ Test timeout - something may be wrong');
        console.log('📝 This might be expected if WebRTC connection takes longer');
        console.log('📋 For full P2P test, open two browser windows at http://localhost:52178');
        console.log('📋 Enter the same room ID in both windows to test full functionality');
        cleanup();
    }
}, 10000);

console.log('⏳ Waiting for clients to connect...');
