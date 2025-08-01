const WebSocket = require('ws');

/**
 * Test WebSocket client for CipherWave
 * This client connects to the test app WebSocket server to verify
 * that the WebSocket proxy is working correctly.
 */

// Connect to the test app WebSocket server
const ws = new WebSocket('ws://localhost:3000');

ws.on('open', function open() {
  console.log('Connected to test app WebSocket server');
  
  // Send a test message
  ws.send(JSON.stringify({ type: 'test', message: 'Hello from test client' }));
});

ws.on('message', function incoming(data) {
  console.log('Received message from server:', data.toString());
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('WebSocket connection closed');
});
