// This is a simplified test to check if the signaling server works correctly
// with multiple clients trying to connect to the same room

const WebSocket = require('ws');

// Configuration
const SERVER_URL = 'ws://localhost:8080';
const TEST_ROOM = 'webrtc-test-room';

console.log('Testing WebRTC signaling with two clients...');

// Create first client (initiator)
const client1 = new WebSocket(SERVER_URL);

client1.on('open', function open() {
  console.log('Client 1: Connected to server');
  
  // Join the test room
  const joinMessage = {
    type: 'join',
    room: TEST_ROOM
  };
  
  console.log('Client 1: Sending join message for room:', TEST_ROOM);
  client1.send(JSON.stringify(joinMessage));
});

client1.on('message', function incoming(data) {
  console.log('Client 1: Received message from server:', data.toString());
  
  try {
    const message = JSON.parse(data);
    
    if (message.type === 'init') {
      console.log('Client 1: Successfully joined room as', message.initiator ? 'initiator' : 'non-initiator');
      
      if (message.initiator) {
        // Send offer message (simulating WebRTC offer)
        const offerMessage = {
          type: 'offer',
          offer: {
            type: 'offer',
            sdp: 'test-offer-sdp'
          }
        };
        
        console.log('Client 1: Sending offer message');
        client1.send(JSON.stringify(offerMessage));
      }
    } else if (message.type === 'offer') {
      // Send answer message (simulating WebRTC answer)
      const answerMessage = {
        type: 'answer',
        answer: {
          type: 'answer',
          sdp: 'test-answer-sdp'
        }
      };
      
      console.log('Client 1: Received offer, sending answer');
      client1.send(JSON.stringify(answerMessage));
    } else if (message.type === 'answer') {
      console.log('Client 1: Received answer from client 2');
    } else if (message.type === 'error') {
      console.log('Client 1: Server error:', message.error);
    } else {
      console.log('Client 1: Received other message type:', message.type);
    }
  } catch (e) {
    console.error('Client 1: Error parsing message:', e);
  }
});

client1.on('error', function error(err) {
  console.error('Client 1: WebSocket error:', err);
});

client1.on('close', function close() {
  console.log('Client 1: Connection closed');
});

// Create second client (non-initiator) after a short delay
setTimeout(() => {
  const client2 = new WebSocket(SERVER_URL);
  
  client2.on('open', function open() {
    console.log('Client 2: Connected to server');
    
    // Join the same test room
    const joinMessage = {
      type: 'join',
      room: TEST_ROOM
    };
    
    console.log('Client 2: Sending join message for room:', TEST_ROOM);
    client2.send(JSON.stringify(joinMessage));
  });
  
  client2.on('message', function incoming(data) {
    console.log('Client 2: Received message from server:', data.toString());
    
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'init') {
        console.log('Client 2: Successfully joined room as', message.initiator ? 'initiator' : 'non-initiator');
        
        if (!message.initiator) {
          // Wait for offer from client 1, then send answer
          console.log('Client 2: Waiting for offer from client 1...');
        }
      } else if (message.type === 'offer') {
        // Send answer message (simulating WebRTC answer)
        const answerMessage = {
          type: 'answer',
          answer: {
            type: 'answer',
            sdp: 'test-answer-sdp'
          }
        };
        
        console.log('Client 2: Received offer, sending answer');
        client2.send(JSON.stringify(answerMessage));
      } else if (message.type === 'answer') {
        console.log('Client 2: Received answer confirmation');
      } else if (message.type === 'error') {
        console.log('Client 2: Server error:', message.error);
      } else {
        console.log('Client 2: Received other message type:', message.type);
      }
    } catch (e) {
      console.error('Client 2: Error parsing message:', e);
    }
  });
  
  client2.on('error', function error(err) {
    console.error('Client 2: WebSocket error:', err);
  });
  
  client2.on('close', function close() {
    console.log('Client 2: Connection closed');
  });
  
  // Close both connections after 15 seconds
  setTimeout(() => {
    console.log('Closing connections');
    client1.close();
    client2.close();
  }, 15000);
}, 2000);
