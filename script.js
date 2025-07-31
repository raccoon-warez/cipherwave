// CipherWave - Secure P2P Messenger
// script.js

// DOM Elements
const modeSelection = document.getElementById('mode-selection');
const nodePanel = document.getElementById('node-panel');
const connectionPanel = document.getElementById('connection-panel');
const chatPanel = document.getElementById('chat-panel');
const debugPanel = document.getElementById('debug-panel');
const hostNodeBtn = document.getElementById('host-node-btn');
const joinNetworkBtn = document.getElementById('join-network-btn');
const nodePortInput = document.getElementById('node-port');
const startNodeBtn = document.getElementById('start-node-btn');
const stopNodeBtn = document.getElementById('stop-node-btn');
const nodeStatus = document.getElementById('node-status');
const roomInput = document.getElementById('room-id');
const generateRoomBtn = document.getElementById('generate-room');
const cipherSelect = document.getElementById('cipher-select');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const connectionStatus = document.getElementById('connection-status');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatToggle = document.getElementById('chat-toggle');
const debugToggle = document.getElementById('debug-toggle');
const debugLogs = document.getElementById('debug-logs');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const runDebugBtn = document.getElementById('run-debug-btn');

// Application State
let peerConnection = null;
let dataChannel = null;
let isConnected = false;
let isInitiator = false;
let currentCipher = 'aes';
let encryptionKey = null;
let room = null;
let nodeServer = null;
let signalingSocket = null;
let pendingMessages = new Map(); // For message delivery confirmations
let messageCounter = 0;

// Configuration for WebRTC with fallback options
const configuration = {
    iceServers: [
        // STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voiparound.com' },
        { urls: 'stun:stun.voipbuster.com' },
        { urls: 'stun:stun.voipstunt.com' },
        { urls: 'stun:stun.xten.com' },
        
        // TURN servers (for better NAT traversal)
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        
        // Fallback TURN servers
        { urls: 'turn:freeturn.net:3478', username: 'free', credential: 'free' },
        { urls: 'turn:freeturn.net:5349', username: 'free', credential: 'free' },
        { urls: 'turns:freeturn.net:5349', username: 'free', credential: 'free' },
        
        // Additional public TURN servers for testing
        { urls: 'turn:turn.anyfirewall.com:443?transport=tcp', username: 'webrtc', credential: 'webrtc' },
        { urls: 'turn:turn.bistri.com:80', username: 'homeo', credential: 'homeo' }
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// Connection timeout values
const CONNECTION_TIMEOUT = 30000; // 30 seconds
const ICE_TIMEOUT = 15000; // 15 seconds

// Connection state tracking for debugging
let connectionStateLog = [];

// List of known signaling servers for automatic discovery
const knownServers = [
    'ws://localhost:8080',
    'ws://localhost:8081',
    'ws://localhost:8082'
];

// WebSocket signaling for peer connection
const signaling = {
    connect: function(serverUrl, roomId) {
        return new Promise((resolve, reject) => {
            signalingSocket = new WebSocket(serverUrl);
            signalingSocket.onopen = () => {
                signalingSocket.send(JSON.stringify({ type: 'join', room: roomId }));
                resolve();
            };
            signalingSocket.onerror = (err) => {
                console.error('Signaling socket error:', err);
                reject(err);
            };
        });
    },
    send: function(message) {
        if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
            signalingSocket.send(JSON.stringify({ ...message, room }));
        }
    },
    onMessage: function(callback) {
        if (signalingSocket) {
            signalingSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    callback(data);
                } catch (e) {
                    console.error('Signaling message parse error:', e);
                }
            };
        }
    },
    disconnect: function() {
        if (signalingSocket) {
            signalingSocket.close();
            signalingSocket = null;
        }
    }
};

// Node server management
const nodeManager = {
    start: function(port) {
        // In a browser environment, we can't actually start a server
        // This would require a separate Node.js process
        // For demo purposes, we'll simulate node hosting
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate starting a node
                updateNodeStatus('Node Running on port ' + port, 'status-running');
                startNodeBtn.disabled = true;
                stopNodeBtn.disabled = false;
                resolve();
            }, 1000);
        });
    },
    stop: function() {
        // Simulate stopping a node
        updateNodeStatus('Node Stopped', 'status-stopped');
        startNodeBtn.disabled = false;
        stopNodeBtn.disabled = true;
    }
};

// Automatic server discovery
async function discoverServer(roomId) {
    updateConnectionStatus('Discovering network...', 'status-disconnected');
    
    // Try each known server until one works
    for (const server of knownServers) {
        try {
            updateConnectionStatus(`Trying ${server}...`, 'status-disconnected');
            await signaling.connect(server, roomId);
            return server;
        } catch (err) {
            console.log(`Failed to connect to ${server}`);
            continue;
        }
    }
    
    throw new Error('No available signaling servers found');
}

// Generate a random room ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let roomId = '';
    for (let i = 0; i < 20; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
}

// Update node status display
function updateNodeStatus(text, className) {
    nodeStatus.textContent = text;
    nodeStatus.className = className;
}

// Update connection status display
function updateConnectionStatus(text, className) {
    connectionStatus.textContent = text;
    connectionStatus.className = className;
}

// Mode selection
hostNodeBtn.addEventListener('click', () => {
    modeSelection.classList.add('hidden');
    nodePanel.classList.remove('hidden');
});

joinNetworkBtn.addEventListener('click', () => {
    modeSelection.classList.add('hidden');
    connectionPanel.classList.remove('hidden');
});

// Node management
startNodeBtn.addEventListener('click', async () => {
    const port = nodePortInput.value || 8080;
    updateNodeStatus('Starting node...', 'status-stopped');
    try {
        await nodeManager.start(port);
    } catch (err) {
        updateNodeStatus('Failed to start node', 'status-stopped');
    }
});

stopNodeBtn.addEventListener('click', () => {
    nodeManager.stop();
});

// Generate room ID on button click
generateRoomBtn.addEventListener('click', () => {
    roomInput.value = generateRoomId();
});

// Update cipher selection
cipherSelect.addEventListener('change', () => {
    currentCipher = cipherSelect.value;
});

// Connect to room
connectBtn.addEventListener('click', async () => {
    room = roomInput.value.trim();
    if (!room) {
        alert('Please enter or generate a room ID');
        return;
    }

    // Set connection status
    updateConnectionStatus('Discovering network...', 'status-disconnected');

    // Discover and connect to signaling server
    let serverUrl;
    try {
        serverUrl = await discoverServer(room);
    } catch (err) {
        updateConnectionStatus('No available servers', 'status-disconnected');
        return;
    }

    // Initialize encryption
    await initializeEncryption();

    // Set up signaling message handler
    signaling.onMessage((msg) => {
        if (msg.type === 'init') {
            isInitiator = msg.initiator;
            // Start WebRTC connection after receiving init message
            startConnection();
        } else {
            handleSignalingMessage(msg);
        }
    });
});

// Log connection state for debugging
function logConnectionState(state) {
    const timestamp = new Date().toLocaleTimeString();
    connectionStateLog.push(`${timestamp}: ${state}`);
    console.log(`[Connection Log] ${timestamp}: ${state}`);
}

// Start WebRTC connection
function startConnection() {
    try {
        // Update connection status
        updateConnectionStatus('Establishing peer connection...', 'status-disconnected');
        logConnectionState('Starting WebRTC connection setup');
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(configuration);
        logConnectionState('RTCPeerConnection created');
        
        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
            if (peerConnection.connectionState !== 'connected' && 
                peerConnection.connectionState !== 'completed') {
                logConnectionState('Connection timeout - no connection established');
                updateConnectionStatus('Connection timeout', 'status-disconnected');
                
                // Try to restart ICE if connection is still trying
                if (peerConnection.iceConnectionState === 'checking' || 
                    peerConnection.iceConnectionState === 'disconnected') {
                    logConnectionState('Attempting ICE restart after timeout');
                    peerConnection.restartIce();
                }
            }
        }, CONNECTION_TIMEOUT);
        
        // Log connection state changes
        peerConnection.onconnectionstatechange = () => {
            logConnectionState(`Connection state: ${peerConnection.connectionState}`);
            updateConnectionStatus(`Connection: ${peerConnection.connectionState}`, 'status-disconnected');
            
            // Clear timeout if connection is established
            if (peerConnection.connectionState === 'connected' || 
                peerConnection.connectionState === 'completed') {
                clearTimeout(connectionTimeout);
            }
            
            // Handle connection failure
            if (peerConnection.connectionState === 'failed') {
                logConnectionState('Connection failed, attempting to restart ICE');
                peerConnection.restartIce();
            }
        };
        
        peerConnection.onsignalingstatechange = () => {
            logConnectionState(`Signaling state: ${peerConnection.signalingState}`);
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            logConnectionState(`ICE connection state: ${peerConnection.iceConnectionState}`);
            
            // Handle ICE connection failure
            if (peerConnection.iceConnectionState === 'failed') {
                logConnectionState('ICE connection failed, attempting to restart ICE');
                peerConnection.restartIce();
            }
            
            // Handle ICE disconnection
            if (peerConnection.iceConnectionState === 'disconnected') {
                logConnectionState('ICE connection disconnected, monitoring for reconnection');
            }
        };
        
        peerConnection.onicegatheringstatechange = () => {
            logConnectionState(`ICE gathering state: ${peerConnection.iceGatheringState}`);
            
            // Set ICE gathering timeout
            if (peerConnection.iceGatheringState === 'gathering') {
                setTimeout(() => {
                    if (peerConnection.iceGatheringState === 'gathering') {
                        logConnectionState('ICE gathering timeout - forcing completion');
                        // Force completion by creating a null candidate
                        peerConnection.onicecandidate({ candidate: null });
                    }
                }, ICE_TIMEOUT);
            }
        };
        
        // Handle ICE candidates with better error handling
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                logConnectionState(`ICE candidate gathered: ${event.candidate.type} (${event.candidate.protocol})`);
                signaling.send({
                    type: 'candidate',
                    candidate: event.candidate
                });
            } else {
                logConnectionState('ICE candidate gathering complete');
            }
        };
        
        // Handle ICE candidate errors with fallback
        peerConnection.onicecandidateerror = event => {
            logConnectionState(`ICE candidate error: ${event.errorCode} - ${event.errorText} (${event.url})`);
            console.error('ICE candidate error:', event);
            
            // Try to continue with available candidates
            if (peerConnection.iceGatheringState === 'complete') {
                logConnectionState('ICE gathering completed despite errors');
            }
        };
        
        // Handle data channel
        if (isInitiator) {
            logConnectionState('Creating data channel (initiator)');
            // Create data channel for initiator with better configuration
            dataChannel = peerConnection.createDataChannel('messaging', {
                ordered: true,
                maxRetransmits: 3
            });
            setupDataChannel(dataChannel);
            
            // Create offer with better configuration
            logConnectionState('Creating offer');
            peerConnection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            })
                .then(offer => {
                    logConnectionState('Offer created, setting local description');
                    return peerConnection.setLocalDescription(offer);
                })
                .then(() => {
                    logConnectionState('Local description set, sending offer');
                    signaling.send({
                        type: 'offer',
                        offer: peerConnection.localDescription
                    });
                })
                .catch(error => {
                    logConnectionState(`Error creating offer: ${error.message}`);
                    console.error('Error creating offer:', error);
                    updateConnectionStatus('Connection failed', 'status-disconnected');
                });
        } else {
            logConnectionState('Waiting for data channel (non-initiator)');
            // Handle incoming data channel for non-initiator with better configuration
            peerConnection.ondatachannel = event => {
                logConnectionState('Data channel received');
                dataChannel = event.channel;
                dataChannel.binaryType = 'arraybuffer';
                setupDataChannel(dataChannel);
            };
        }
        
    } catch (error) {
        logConnectionState(`Error starting connection: ${error.message}`);
        console.error('Error starting connection:', error);
        updateConnectionStatus('Connection failed', 'status-disconnected');
    }
}

// Handle signaling messages
function handleSignalingMessage(message) {
    if (!peerConnection) {
        logConnectionState('Received signaling message but no peer connection exists');
        return;
    }
    
    logConnectionState(`Received signaling message: ${message.type}`);
    
    switch (message.type) {
        case 'offer':
            logConnectionState('Processing offer');
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer))
                .then(() => {
                    logConnectionState('Remote offer set, creating answer');
                    return peerConnection.createAnswer();
                })
                .then(answer => {
                    logConnectionState('Answer created, setting local description');
                    return peerConnection.setLocalDescription(answer);
                })
                .then(() => {
                    logConnectionState('Local answer set, sending answer');
                    signaling.send({
                        type: 'answer',
                        answer: peerConnection.localDescription
                    });
                })
                .catch(error => {
                    logConnectionState(`Error handling offer: ${error.message}`);
                    console.error('Error handling offer:', error);
                });
            break;
            
        case 'answer':
            logConnectionState('Processing answer');
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
                .then(() => {
                    logConnectionState('Remote answer set successfully');
                })
                .catch(error => {
                    logConnectionState(`Error handling answer: ${error.message}`);
                    console.error('Error handling answer:', error);
                });
            break;
            
        case 'candidate':
            logConnectionState(`Adding ICE candidate: ${message.candidate.type}`);
            peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
                .then(() => {
                    logConnectionState('ICE candidate added successfully');
                })
                .catch(error => {
                    logConnectionState(`Error adding ICE candidate: ${error.message}`);
                    console.error('Error adding ICE candidate:', error);
                });
            break;
            
        default:
            logConnectionState(`Unknown signaling message type: ${message.type}`);
    }
}

// Setup data channel
function setupDataChannel(channel) {
    channel.onopen = () => {
        isConnected = true;
        updateConnectionStatus('Connected', 'status-connected');
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        
        // Show chat panel
        connectionPanel.classList.add('hidden');
        chatPanel.classList.remove('hidden');
    };
    
    channel.onclose = () => {
        isConnected = false;
        updateConnectionStatus('Disconnected', 'status-disconnected');
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        
        // Show connection panel
        chatPanel.classList.add('hidden');
        connectionPanel.classList.remove('hidden');
    };
    
    channel.onmessage = event => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                // Decrypt message
                const decryptedMessage = decryptMessage(data.content, currentCipher);
                displayMessage(decryptedMessage, 'received');
            } else if (data.type === 'delivery-confirmation') {
                // Handle message delivery confirmation
                const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
                if (messageElement) {
                    const statusElement = messageElement.querySelector('.message-status');
                    if (statusElement) {
                        statusElement.textContent = '✓✓';
                        statusElement.className = 'message-status delivered';
                    }
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };
}

// Disconnect from room
disconnectBtn.addEventListener('click', () => {
    if (dataChannel) {
        dataChannel.close();
    }
    if (peerConnection) {
        peerConnection.close();
    }

    signaling.disconnect();

    isConnected = false;
    updateConnectionStatus('Disconnected', 'status-disconnected');
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;

    // Show connection panel
    chatPanel.classList.add('hidden');
    connectionPanel.classList.remove('hidden');

    // Clear messages
    messagesContainer.innerHTML = '';
    
    // Clear pending messages
    pendingMessages.clear();
});

// Send message
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected || !dataChannel) return;
    
    try {
        // Encrypt message
        const encryptedMessage = encryptMessage(message, currentCipher);
        
        // Create message ID for tracking
        const messageId = ++messageCounter;
        
        // Send via data channel
        const messageData = {
            type: 'message',
            content: encryptedMessage,
            timestamp: Date.now(),
            messageId: messageId
        };
        
        dataChannel.send(JSON.stringify(messageData));
        displayMessage(message, 'sent', messageId);
        messageInput.value = '';
        
        // Track pending message for delivery confirmation
        pendingMessages.set(messageId, {
            content: message,
            timestamp: Date.now()
        });
        
        // Set timeout for delivery confirmation
        setTimeout(() => {
            if (pendingMessages.has(messageId)) {
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageElement) {
                    const statusElement = messageElement.querySelector('.message-status');
                    if (statusElement && statusElement.textContent === '✓') {
                        statusElement.textContent = '⚠';
                        statusElement.className = 'message-status not-delivered';
                    }
                }
                pendingMessages.delete(messageId);
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

// Display message in UI
function displayMessage(message, type, messageId = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    if (messageId) {
        messageElement.setAttribute('data-message-id', messageId);
    }
    
    const messageContent = document.createElement('div');
    messageContent.textContent = message;
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    messageInfo.textContent = new Date().toLocaleTimeString();
    
    // Add delivery status indicator for sent messages
    if (type === 'sent') {
        const statusElement = document.createElement('span');
        statusElement.className = 'message-status';
        statusElement.textContent = '✓';
        messageInfo.appendChild(statusElement);
    }
    
    messageElement.appendChild(messageContent);
    messageElement.appendChild(messageInfo);
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Initialize encryption based on selected cipher
async function initializeEncryption() {
    switch (currentCipher) {
        case 'aes':
            // Generate a random key for AES
            encryptionKey = CryptoJS.lib.WordArray.random(256/8);
            break;
        case 'rsa':
            // In a real implementation, we would generate RSA keys
            // For demo, we'll use a placeholder
            encryptionKey = 'rsa-key-placeholder';
            break;
        case 'chacha20':
            // Generate a random key for ChaCha20
            encryptionKey = CryptoJS.lib.WordArray.random(256/8);
            break;
    }
    
    // For demo purposes, we'll share the key through the signaling channel
    // In a real implementation, this would be done through a secure key exchange
    if (isInitiator) {
        setTimeout(() => {
            signaling.send({
                type: 'key',
                cipher: currentCipher,
                key: encryptionKey.toString()
            });
        }, 2000);
    }
}

// Encrypt message based on selected cipher
function encryptMessage(message, cipher) {
    switch (cipher) {
        case 'aes':
            return CryptoJS.AES.encrypt(message, encryptionKey).toString();
        case 'rsa':
            // In a real implementation, we would use RSA encryption
            // For demo, we'll just base64 encode
            return btoa(message);
        case 'chacha20':
            // ChaCha20 implementation would go here
            // For demo, we'll use AES as a substitute
            return CryptoJS.AES.encrypt(message, encryptionKey).toString();
        default:
            return message;
    }
}

// Decrypt message based on selected cipher
function decryptMessage(encryptedMessage, cipher) {
    try {
        switch (cipher) {
            case 'aes':
                const decrypted = CryptoJS.AES.decrypt(encryptedMessage, encryptionKey);
                return decrypted.toString(CryptoJS.enc.Utf8);
            case 'rsa':
                // In a real implementation, we would use RSA decryption
                // For demo, we'll just base64 decode
                return atob(encryptedMessage);
            case 'chacha20':
                // ChaCha20 implementation would go here
                // For demo, we'll use AES as a substitute
                const chachaDecrypted = CryptoJS.AES.decrypt(encryptedMessage, encryptionKey);
                return chachaDecrypted.toString(CryptoJS.enc.Utf8);
            default:
                return encryptedMessage;
        }
    } catch (error) {
        console.error('Decryption error:', error);
        return '[Decryption Error]';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Set initial states
    updateNodeStatus('Node Stopped', 'status-stopped');
    updateConnectionStatus('Disconnected', 'status-disconnected');
    
    // Generate a room ID by default
    roomInput.value = generateRoomId();
    
    // Show debug panel
    debugPanel.classList.remove('hidden');
});

// Expandable panel functionality
chatToggle.addEventListener('click', () => {
    const content = document.querySelector('#messages');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        chatToggle.textContent = '▼';
    } else {
        content.style.display = 'none';
        chatToggle.textContent = '▶';
    }
});

debugToggle.addEventListener('click', () => {
    const content = document.querySelector('#debug-content');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        debugToggle.textContent = '▼';
    } else {
        content.style.display = 'none';
        debugToggle.textContent = '▶';
    }
});

// Debug panel functionality
clearLogsBtn.addEventListener('click', () => {
    debugLogs.innerHTML = '';
    connectionStateLog = [];
});

runDebugBtn.addEventListener('click', () => {
    // Run the debug connection function
    debugConnection();
});

// Enhanced debug connection function
function debugConnection() {
    const logEntry = document.createElement('div');
    logEntry.className = 'debug-log-entry';
    
    let debugInfo = `=== CipherWave Debug Report ===\n`;
    debugInfo += `Time: ${new Date().toLocaleString()}\n\n`;
    
    // Check if required APIs are available
    debugInfo += `WebRTC Support: ${!!window.RTCPeerConnection}\n`;
    debugInfo += `WebSocket Support: ${!!window.WebSocket}\n`;
    debugInfo += `Crypto Support: ${!!window.crypto}\n\n`;
    
    // Check network connectivity
    debugInfo += `Online Status: ${navigator.onLine}\n\n`;
    
    // Check signaling server connection
    if (typeof signalingSocket !== 'undefined' && signalingSocket) {
        debugInfo += `Signaling Server Status: ${signalingSocket.readyState}\n`;
        debugInfo += `Signaling Server URL: ${signalingSocket.url || 'N/A'}\n\n`;
    } else {
        debugInfo += `Signaling Server: Not connected\n\n`;
    }
    
    // Check WebRTC connection
    if (typeof peerConnection !== 'undefined' && peerConnection) {
        debugInfo += `Peer Connection State: ${peerConnection.connectionState}\n`;
        debugInfo += `Signaling State: ${peerConnection.signalingState}\n`;
        debugInfo += `ICE Connection State: ${peerConnection.iceConnectionState}\n`;
        debugInfo += `ICE Gathering State: ${peerConnection.iceGatheringState}\n\n`;
    } else {
        debugInfo += `Peer Connection: Not established\n\n`;
    }
    
    // Check data channel
    if (typeof dataChannel !== 'undefined' && dataChannel) {
        debugInfo += `Data Channel State: ${dataChannel.readyState}\n`;
        debugInfo += `Data Channel Label: ${dataChannel.label}\n\n`;
    } else {
        debugInfo += `Data Channel: Not established\n\n`;
    }
    
    // Display connection log
    if (typeof connectionStateLog !== 'undefined' && connectionStateLog && connectionStateLog.length > 0) {
        debugInfo += `=== Recent Connection Events ===\n`;
        // Show last 10 log entries
        const recentLogs = connectionStateLog.slice(-10);
        debugInfo += recentLogs.join('\n');
    } else {
        debugInfo += `=== No Connection Events ===\n`;
    }
    
    debugInfo += `\n=== End Debug Report ===`;
    
    logEntry.textContent = debugInfo;
    debugLogs.appendChild(logEntry);
    
    // Scroll to bottom
    debugLogs.scrollTop = debugLogs.scrollHeight;
}

// Override the logConnectionState function to also update the debug panel
const originalLogConnectionState = logConnectionState;
logConnectionState = function(state) {
    originalLogConnectionState(state);
    
    // Update debug panel in real-time
    const logEntry = document.createElement('div');
    logEntry.className = 'debug-log-entry';
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${state}`;
    debugLogs.appendChild(logEntry);
    
    // Scroll to bottom
    debugLogs.scrollTop = debugLogs.scrollHeight;
};
