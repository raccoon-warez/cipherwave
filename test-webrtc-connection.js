// Simple WebRTC Connection Test
// This script tests the basic WebRTC connection functionality

async function testWebRTCSupport() {
    // Check if WebRTC is supported
    if (typeof RTCPeerConnection === 'undefined') {
        console.error('WebRTC is not supported in this browser');
        return false;
    }
    
    console.log('WebRTC is supported');
    
    // Create a simple peer connection
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    };
    
    try {
        const peerConnection = new RTCPeerConnection(configuration);
        console.log('RTCPeerConnection created successfully');
        
        // Create a data channel
        const dataChannel = peerConnection.createDataChannel('test');
        console.log('Data channel created successfully');
        
        // Close the connection
        dataChannel.close();
        peerConnection.close();
        console.log('Test connection closed');
        
        return true;
    } catch (error) {
        console.error('Error testing WebRTC:', error);
        return false;
    }
}

// Run the test
testWebRTCSupport().then(result => {
    if (result) {
        console.log('WebRTC test passed');
    } else {
        console.log('WebRTC test failed');
    }
});
