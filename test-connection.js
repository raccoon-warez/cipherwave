const WebSocket = require('ws');

// Configuration
const SERVER_URL = 'ws://localhost:8080';
const TEST_ROOM = 'test-room';

console.log('Testing connection to CipherWave signaling server...');

// Create WebSocket connection
const ws = new WebSocket(SERVER_URL);

ws.on('open', function open() {
  console.log('Connected to server');
  
  // Join a test room
  const joinMessage = {
    type: 'join',
    room: TEST_ROOM
  };
  
  console.log('Sending join message for room:', TEST_ROOM);
  ws.send(JSON.stringify(joinMessage));
});

ws.on('message', function incoming(data) {
  console.log('Received message from server:', data.toString());
  
  try {
    const message = JSON.parse(data);
    
    if (message.type === 'init') {
      console.log('Successfully joined room as', message.initiator ? 'initiator' : 'non-initiator');
      
      // Test sending a message to the room
      const testMessage = {
        type: 'test',
        content: 'Hello from test client'
      };
      
      console.log('Sending test message');
      ws.send(JSON.stringify(testMessage));
    } else if (message.type === 'error') {
      console.log('Server error:', message.error);
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
  console.log('Connection closed');
});

// Close the connection after 10 seconds
setTimeout(() => {
  console.log('Closing connection');
  ws.close();
}, 10000);
