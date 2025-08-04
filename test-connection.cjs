// Test signaling server functionality
const WebSocket = require('ws');

console.log('🧪 Testing Signaling Server');

const SERVER_URL = 'ws://localhost:52178';
const TEST_ROOM = 'test-room-' + Math.random().toString(36).substring(7);

console.log(`Connecting to: ${SERVER_URL}`);
console.log(`Using room: ${TEST_ROOM}`);

const ws = new WebSocket(SERVER_URL);

ws.on('open', function open() {
  console.log('✅ Connected to server');
  
  // Add a delay to avoid rate limiting
  setTimeout(() => {
    // Create message using a plain object literal
    const joinMessage = {
      type: 'join',
      room: TEST_ROOM
    };
    
    console.log('Sending join message for room:', TEST_ROOM);
    console.log('Message object:', joinMessage);
    console.log('Message keys:', Object.keys(joinMessage));
    console.log('Has __proto__:', '__proto__' in joinMessage);
    console.log('Has constructor:', 'constructor' in joinMessage);
    console.log('Has prototype:', 'prototype' in joinMessage);
    console.log('Stringified message:', JSON.stringify(joinMessage));
    
    // Test the validation logic locally
    function isValidMessage(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
      if (!data.type || typeof data.type !== 'string') return false;
      if (data.type.length > 50) return false; // Limit type length
      
      // Check for suspicious properties
      const dangerousProps = ['__proto__', 'constructor', 'prototype'];
      for (const prop of dangerousProps) {
        if (prop in data) {
          console.log(`❌ Dangerous property found: ${prop}`);
          return false;
        }
      }
      
      // Limit total properties
      if (Object.keys(data).length > 20) return false;
      
      console.log('✅ Message validation passed locally');
      return true;
    }
    
    console.log('Local validation result:', isValidMessage(joinMessage));
    
    ws.send(JSON.stringify(joinMessage));
  }, 500);
});

ws.on('message', function incoming(data) {
  console.log('Received message from server:', data.toString());
  
  try {
    const message = JSON.parse(data);
    
    if (message.type === 'init') {
      console.log('🎉 Successfully joined room as', message.initiator ? 'initiator' : 'non-initiator');
      
      // Test sending a message to the room
      const testMessage = {
        type: 'test',
        content: 'Hello from test client'
      };
      
      console.log('Sending test message');
      ws.send(JSON.stringify(testMessage));
    } else if (message.type === 'error') {
      console.log('❌ Server error:', message.error);
    } else {
      console.log('Received other message type:', message.type);
    }
  } catch (e) {
    console.error('Error parsing message:', e);
  }
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('🔚 Connection closed');
});

// Close the connection after 10 seconds
setTimeout(() => {
  console.log('⏰ Closing connection');
  ws.close();
}, 10000);
