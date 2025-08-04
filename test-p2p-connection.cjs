// Test P2P connection functionality with proper signaling messages
const WebSocket = require('ws');

console.log('🧪 Testing P2P Connection with WebRTC Signaling');

const SERVER_URL = 'ws://localhost:52178';
const TEST_ROOM = 'test-p2p-room-' + Math.random().toString(36).substring(7);

console.log(`Connecting to: ${SERVER_URL}`);
console.log(`Using room: ${TEST_ROOM}`);

let client1, client2;
let client1Connected = false;
let client2Connected = false;
let client1Joined = false;
let client2Joined = false;
let client1Initiator = false;
let client2Initiator = false;

// Create first client
client1 = new WebSocket(SERVER_URL);

client1.on('open', function open() {
  console.log('✅ Client 1 connected to server');
  client1Connected = true;
  
  // Join room after a delay
  setTimeout(() => {
    const joinMessage = {
      type: 'join',
      room: TEST_ROOM
    };
    
    console.log('Client 1 sending join message for room:', TEST_ROOM);
    client1.send(JSON.stringify(joinMessage));
  }, 100);
});

client1.on('message', function incoming(data) {
  try {
    const message = JSON.parse(data);
    console.log('Client 1 received:', message.type);
    
    if (message.type === 'init') {
      console.log('🎉 Client 1 joined room as', message.initiator ? 'initiator' : 'non-initiator');
      client1Joined = true;
      client1Initiator = message.initiator;
      
      // If both clients are connected, create second client
      if (client2Connected) {
        testSignaling();
      }
    } else if (message.type === 'offer') {
      console.log('🎉 Client 1 received WebRTC offer from Client 2');
      // In a real implementation, we would handle the offer here
    } else if (message.type === 'answer') {
      console.log('🎉 Client 1 received WebRTC answer from Client 2');
      // In a real implementation, we would handle the answer here
    } else if (message.type === 'ice-candidate') {
      console.log('🎉 Client 1 received ICE candidate from Client 2');
      // In a real implementation, we would handle the ICE candidate here
    } else if (message.type === 'signal') {
      console.log('🎉 Client 1 received signal message from Client 2:', message.data);
    } else if (message.type === 'error') {
      console.log('❌ Client 1 error:', message.error);
    } else if (message.type === 'peer-disconnected') {
      console.log('⚠️ Client 1: Peer disconnected');
    }
  } catch (e) {
    console.error('Client 1 error parsing message:', e);
  }
});

client1.on('error', function error(err) {
  console.error('Client 1 WebSocket error:', err);
});

client1.on('close', function close() {
  console.log('🔚 Client 1 connection closed');
});

// Create second client after a delay
setTimeout(() => {
  client2 = new WebSocket(SERVER_URL);
  
  client2.on('open', function open() {
    console.log('✅ Client 2 connected to server');
    client2Connected = true;
    
    // Join room after a delay
    setTimeout(() => {
      const joinMessage = {
        type: 'join',
        room: TEST_ROOM
      };
      
      console.log('Client 2 sending join message for room:', TEST_ROOM);
      client2.send(JSON.stringify(joinMessage));
    }, 100);
  });
  
  client2.on('message', function incoming(data) {
    try {
      const message = JSON.parse(data);
      console.log('Client 2 received:', message.type);
      
      if (message.type === 'init') {
        console.log('🎉 Client 2 joined room as', message.initiator ? 'initiator' : 'non-initiator');
        client2Joined = true;
        client2Initiator = message.initiator;
        
        // If both clients are connected, test signaling
        if (client1Joined) {
          testSignaling();
        }
      } else if (message.type === 'offer') {
        console.log('🎉 Client 2 received WebRTC offer from Client 1');
        // In a real implementation, we would handle the offer here
      } else if (message.type === 'answer') {
        console.log('🎉 Client 2 received WebRTC answer from Client 1');
        // In a real implementation, we would handle the answer here
      } else if (message.type === 'ice-candidate') {
        console.log('🎉 Client 2 received ICE candidate from Client 1');
        // In a real implementation, we would handle the ICE candidate here
      } else if (message.type === 'signal') {
        console.log('🎉 Client 2 received signal message from Client 1:', message.data);
      } else if (message.type === 'error') {
        console.log('❌ Client 2 error:', message.error);
      } else if (message.type === 'peer-disconnected') {
        console.log('⚠️ Client 2: Peer disconnected');
      }
    } catch (e) {
      console.error('Client 2 error parsing message:', e);
    }
  });
  
  client2.on('error', function error(err) {
    console.error('Client 2 WebSocket error:', err);
  });
  
  client2.on('close', function close() {
    console.log('🔚 Client 2 connection closed');
  });
}, 1000);

// Test signaling between clients
function testSignaling() {
  console.log('🔄 Testing signaling between clients');
  
  // Send signal message from client 1 to client 2
  setTimeout(() => {
    const signalMessage = {
      type: 'signal',
      data: 'Hello from Client 1'
    };
    
    console.log('Client 1 sending signal message to Client 2');
    client1.send(JSON.stringify(signalMessage));
  }, 500);
  
  // Send signal message from client 2 to client 1
  setTimeout(() => {
    const signalMessage = {
      type: 'signal',
      data: 'Hello from Client 2'
    };
    
    console.log('Client 2 sending signal message to Client 1');
    client2.send(JSON.stringify(signalMessage));
  }, 1000);
  
  // Test WebRTC signaling messages
  setTimeout(() => {
    // Send offer from initiator to non-initiator
    const initiator = client1Initiator ? client1 : client2;
    const nonInitiator = client1Initiator ? client2 : client1;
    
    const offerMessage = {
      type: 'offer',
      offer: {
        type: 'offer',
        sdp: 'test-offer-sdp'
      }
    };
    
    console.log('Sending WebRTC offer from initiator to non-initiator');
    initiator.send(JSON.stringify(offerMessage));
  }, 1500);
  
  setTimeout(() => {
    // Send answer from non-initiator to initiator
    const initiator = client1Initiator ? client1 : client2;
    const nonInitiator = client1Initiator ? client2 : client1;
    
    const answerMessage = {
      type: 'answer',
      answer: {
        type: 'answer',
        sdp: 'test-answer-sdp'
      }
    };
    
    console.log('Sending WebRTC answer from non-initiator to initiator');
    nonInitiator.send(JSON.stringify(answerMessage));
  }, 2000);
  
  setTimeout(() => {
    // Send ICE candidate
    const iceMessage = {
      type: 'ice-candidate',
      candidate: {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 8999 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0
      }
    };
    
    console.log('Sending ICE candidate from Client 1 to Client 2');
    client1.send(JSON.stringify(iceMessage));
  }, 2500);
  
  setTimeout(() => {
    // Send another ICE candidate
    const iceMessage = {
      type: 'ice-candidate',
      candidate: {
        candidate: 'candidate:2 1 UDP 2130706431 192.168.1.2 8999 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0
      }
    };
    
    console.log('Sending ICE candidate from Client 2 to Client 1');
    client2.send(JSON.stringify(iceMessage));
  }, 3000);
}

// Close connections after 10 seconds
setTimeout(() => {
  console.log('⏰ Closing connections');
  if (client1 && client1.readyState === WebSocket.OPEN) {
    client1.close();
  }
  if (client2 && client2.readyState === WebSocket.OPEN) {
    client2.close();
  }
}, 10000);
