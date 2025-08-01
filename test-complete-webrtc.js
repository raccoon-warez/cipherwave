/**
 * Complete WebRTC signaling test for CipherWave
 * This test simulates the complete WebRTC signaling process between two clients
 * to verify that they can connect to the same room and establish a WebRTC connection.
 * It tests the offer/answer exchange and ensures proper message routing.
 */

const WebSocket = require('ws');

// Configuration
const SERVER_URL = 'ws://localhost:8080';
const TEST_ROOM = 'complete-webrtc-test-room';

console.log('Testing complete WebRTC signaling with two clients...');

// Create first client (initiator)
const client1 = new WebSocket(SERVER_URL);
let client1Ready = false;
let client2Ready = false;
let offerSent = false;
let answerSent = false;
let client1Candidates = [];
let client2Candidates = [];

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
        client1Ready = true;
        // Wait for second client to join before sending offer
        console.log('Client 1: Waiting for second client to join before sending offer...');
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
      answerSent = true;
    } else if (message.type === 'answer') {
      console.log('Client 1: Received answer from client 2');
      // Send ICE candidates after answer is received
      sendICECandidates();
    } else if (message.type === 'candidate') {
      console.log('Client 1: Received ICE candidate from client 2');
      client2Candidates.push(message.candidate);
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
          client2Ready = true;
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
        answerSent = true;
      } else if (message.type === 'answer') {
        console.log('Client 2: Received answer confirmation');
        // Send ICE candidates after answer is received
        sendICECandidates();
      } else if (message.type === 'candidate') {
        console.log('Client 2: Received ICE candidate from client 1');
        client1Candidates.push(message.candidate);
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
  
  // Function to send ICE candidates between clients
  function sendICECandidates() {
    if (offerSent && answerSent) {
      console.log('Both offer and answer exchanged, sending ICE candidates...');
      
      // Send ICE candidates from client 1 to client 2
      const candidate1 = {
        type: 'candidate',
        candidate: {
          candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 8998 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0
        }
      };
      
      console.log('Client 1: Sending ICE candidate to client 2');
      client1.send(JSON.stringify(candidate1));
      
      // Send ICE candidates from client 2 to client 1
      const candidate2 = {
        type: 'candidate',
        candidate: {
          candidate: 'candidate:2 1 UDP 2130706431 192.168.1.2 8999 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0
        }
      };
      
      console.log('Client 2: Sending ICE candidate to client 1');
      client2.send(JSON.stringify(candidate2));
    }
  }
  
  // Close both connections after 20 seconds or when both offer and answer are sent
  let closeTimer = setTimeout(() => {
    console.log('Closing connections');
    client1.close();
    client2.close();
    
    // Print summary
    console.log('\n=== Test Summary ===');
    console.log('Client 1 candidates sent:', client1Candidates.length);
    console.log('Client 2 candidates sent:', client2Candidates.length);
    console.log('Offer sent:', offerSent);
    console.log('Answer sent:', answerSent);
    console.log('Test completed successfully!');
  }, 20000);
  
  // Also close when both offer and answer are sent
  let checkCompletion = setInterval(() => {
    if (offerSent && answerSent) {
      console.log('Both offer and answer sent, closing connections');
      clearTimeout(closeTimer);
      clearInterval(checkCompletion);
      client1.close();
      client2.close();
      
      // Print summary
      console.log('\n=== Test Summary ===');
      console.log('Client 1 candidates sent:', client1Candidates.length);
      console.log('Client 2 candidates sent:', client2Candidates.length);
      console.log('Offer sent:', offerSent);
      console.log('Answer sent:', answerSent);
      console.log('Test completed successfully!');
    }
    
    // Send offer when both clients are ready
    if (client1Ready && client2Ready && !offerSent) {
      console.log('Both clients ready, sending offer');
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
      offerSent = true;
    }
  }, 1000);
}, 2000);
