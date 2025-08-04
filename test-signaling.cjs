// Test signaling server functionality
const WebSocket = require('ws');

console.log('🧪 Testing Signaling Server');

const SERVER_URL = 'ws://localhost:52178';
const TEST_ROOM = 'test-room-' + Math.random().toString(36).substring(7);

console.log(`Connecting to: ${SERVER_URL}`);
console.log(`Using room: ${TEST_ROOM}`);

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    console.log('✅ Connected to signaling server');
    
    // Wait a bit before sending the join message to avoid rate limiting
    setTimeout(() => {
        // Join a test room
        const joinMessage = {
            type: 'join',
            room: TEST_ROOM
        };
        
        console.log('📤 Sending join message:', JSON.stringify(joinMessage));
        console.log('📤 Message type:', typeof joinMessage);
        console.log('📤 Message keys:', Object.keys(joinMessage));
        console.log('📤 Type property:', joinMessage.type);
        console.log('📤 Type type:', typeof joinMessage.type);
        console.log('📤 Room property:', joinMessage.room);
        console.log('📤 Room type:', typeof joinMessage.room);
        
        ws.send(JSON.stringify(joinMessage));
    }, 300);
});

ws.on('message', (data) => {
    console.log('📥 Raw message data:', data.toString());
    try {
        const message = JSON.parse(data);
        console.log('📥 Parsed message:', message);
        
        if (message.type === 'init') {
            console.log('🎉 Signaling test PASSED');
            console.log('✅ Successfully joined room and received init message');
            console.log('🔑 Initialized as', message.initiator ? 'initiator' : 'responder');
            ws.close();
        } else if (message.type === 'error') {
            console.log('❌ Server error:', message.error);
            if (message.error === 'Invalid message structure') {
                console.log('📝 This might be due to message validation issues');
            }
            ws.close();
        }
    } catch (error) {
        console.log('❌ Error parsing message:', error.message);
        console.log(' Raw data:', data.toString());
    }
});

ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
    console.log('🔚 Connection closed');
});

// Timeout to prevent hanging
setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
        console.log('⏰ Test timeout');
        ws.close();
    }
}, 10000);
