// CipherWave Connection Debugger
// Run this script in the browser console to get detailed connection information

function debugConnection() {
    console.log("=== CipherWave Connection Debugger ===");
    
    // Check if required APIs are available
    console.log("WebRTC Support:", !!window.RTCPeerConnection);
    console.log("WebSocket Support:", !!window.WebSocket);
    console.log("Crypto Support:", !!window.crypto);
    
    // Check network connectivity
    console.log("Online Status:", navigator.onLine);
    
    // Check signaling server connection
    if (typeof signalingSocket !== 'undefined' && signalingSocket) {
        console.log("Signaling Server Status:", signalingSocket.readyState);
        console.log("Signaling Server URL:", signalingSocket.url);
    } else {
        console.log("Signaling Server: Not connected");
    }
    
    // Check WebRTC connection
    if (typeof peerConnection !== 'undefined' && peerConnection) {
        console.log("Peer Connection State:", peerConnection.connectionState);
        console.log("Signaling State:", peerConnection.signalingState);
        console.log("ICE Connection State:", peerConnection.iceConnectionState);
        console.log("ICE Gathering State:", peerConnection.iceGatheringState);
        
        // List ICE candidates
        console.log("Local Description:", peerConnection.localDescription);
        console.log("Remote Description:", peerConnection.remoteDescription);
    } else {
        console.log("Peer Connection: Not established");
    }
    
    // Check data channel
    if (typeof dataChannel !== 'undefined' && dataChannel) {
        console.log("Data Channel State:", dataChannel.readyState);
        console.log("Data Channel Label:", dataChannel.label);
    } else {
        console.log("Data Channel: Not established");
    }
    
    // Display connection log
    if (typeof connectionStateLog !== 'undefined' && connectionStateLog) {
        console.log("=== Connection Log ===");
        connectionStateLog.forEach(entry => console.log(entry));
    }
    
    console.log("=== End Debug Info ===");
}

// Run debug when called
debugConnection();

// Also expose as a global function for manual debugging
window.debugCipherWave = debugConnection;
