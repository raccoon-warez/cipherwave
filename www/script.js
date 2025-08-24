// CipherWave - Secure P2P Messenger
// Enhanced script.js for Telegram-like UI

// DOM Elements for the new UI
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const roomIdInput = document.getElementById('room-id');
const generateRoomBtn = document.getElementById('generate-room');
// const cipherSelect = document.getElementById('cipher-select'); // Removed - using default AES
const connectBtn = document.getElementById('connect-btn');
const closeModal = document.getElementById('close-modal');
const peerStatus = document.getElementById('peer-status');
const nicknameInput = document.getElementById('nickname');
const connectionIndicator = document.getElementById('connection-indicator');

// Application State
let peerConnection = null;
let dataChannel = null;
let isConnected = false;
let isInitiator = false;
let currentCipher = 'aes';
let encryptionKey = null;
let room = null;
let signalingSocket = null;
let pendingMessages = new Map();
let messageCounter = 0;

// Optimized WebRTC configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { 
            urls: 'turn:openrelay.metered.ca:80', 
            username: 'openrelayproject', 
            credential: 'openrelayproject' 
        },
        { 
            urls: 'turn:openrelay.metered.ca:443?transport=tcp', 
            username: 'openrelayproject', 
            credential: 'openrelayproject' 
        }
    ],
    iceCandidatePoolSize: 2,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// Connection timeout values
const CONNECTION_TIMEOUT = 15000;

// Update connection status indicator
function updateConnectionStatus(status, text) {
    if (connectionIndicator) {
        connectionIndicator.className = `connection-indicator ${status}`;
        const statusText = connectionIndicator.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = text;
        }
    }
    if (peerStatus) {
        peerStatus.textContent = text;
    }
}
const ICE_TIMEOUT = 8000;
const ICE_GATHERING_TIMEOUT = 5000;

// List of known signaling servers
const knownServers = [
    'ws://localhost:52178',
    'ws://localhost:8081',
    'ws://localhost:8082'
];

// WebSocket signaling
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
            // For WebRTC signaling messages (offer, answer, ice-candidate), wrap them in a 'signal' type
            if (['offer', 'answer', 'ice-candidate'].includes(message.type)) {
                const wrappedMessage = {
                    type: 'signal',
                    room: room,
                    signal: message
                };
                console.log('📤 Sending wrapped WebRTC signal:', wrappedMessage);
                signalingSocket.send(JSON.stringify(wrappedMessage));
            } else {
                // For other messages (join, key, etc.), send directly
                const directMessage = { ...message, room: room };
                console.log('📤 Sending direct message:', directMessage);
                signalingSocket.send(JSON.stringify(directMessage));
            }
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

// Generate a random room ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let roomId = '';
    for (let i = 0; i < 20; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
}


// Generate room ID on button click
if (generateRoomBtn && roomIdInput) {
    generateRoomBtn.addEventListener('click', () => {
        roomIdInput.value = generateRoomId();
    });
}

// Default cipher (removed selection UI for simplicity)
currentCipher = 'aes';
console.log('🔐 Using default encryption cipher:', currentCipher);

// Check environment and display helpful message
if (typeof window === 'undefined') {
    console.log('\n🌐 CipherWave is a web application that runs in your browser.');
    console.log('📋 To use CipherWave:');
    console.log('   1. Make sure the development server is running (npm run dev)');
    console.log('   2. Open your web browser');
    console.log('   3. Navigate to: http://localhost:3000/');
    console.log('   4. Create or join a network to start chatting!');
    console.log('\n✨ The application provides a secure P2P messaging experience.');
} else if (typeof RTCPeerConnection === 'undefined') {
    console.warn('⚠️ WebRTC not supported in this browser. Please use Chrome, Firefox, Safari, or Edge.');
}

// Connect to room
if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
        // Check browser compatibility first
        if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
            const errorMsg = 'This application requires a modern web browser with WebRTC support. Please open http://localhost:3000/ in Chrome, Firefox, Safari, or Edge.';
            alert(errorMsg);
            displayMessage('❌ ' + errorMsg, 'system');
            return;
        }
        
        room = roomIdInput.value.trim();
        if (!room) {
            alert('Please enter or generate a room ID');
            return;
        }

        // Set connection status
        updateConnectionStatus('connecting', 'Connecting...');

        // Connect to signaling server
        let serverUrl;
        try {
            for (const server of knownServers) {
                try {
                    await signaling.connect(server, room);
                    serverUrl = server;
                    break;
                } catch (err) {
                    console.log(`Failed to connect to ${server}: ${err.message}`);
                    continue;
                }
            }
            
            if (!serverUrl) {
                throw new Error('No available signaling servers');
            }
        } catch (err) {
            updateConnectionStatus('disconnected', 'Connection failed');
            return;
        }

        // Initialize encryption
        await initializeEncryption();

        // Set up signaling message handler
        signaling.onMessage((msg) => {
            console.log('Received signaling message:', msg.type);
            
            if (msg.type === 'init') {
                isInitiator = msg.initiator;
                console.log('Connection initialized:', isInitiator ? 'Creating network' : 'Joining network');
                updateConnectionStatus('connecting', isInitiator ? 'Creating network...' : 'Joining network...');
                
                // Start WebRTC connection after receiving init message
                startConnection();
            } else if (msg.type === 'key') {
                // Handle key exchange message
                handleKeyExchange(msg);
            } else if (msg.type === 'signal') {
                // Handle wrapped WebRTC signaling messages
                console.log('📞 Received WebRTC signal:', msg.signal?.type);
                if (msg.signal) {
                    handleSignalingMessage(msg.signal);
                }
            } else if (msg.type === 'error') {
                console.error('Server error:', msg.error);
                updateConnectionStatus('disconnected', 'Error: ' + msg.error);
                alert('Connection error: ' + msg.error);
            } else {
                // Handle any other direct signaling messages for backward compatibility
                console.log('🔄 Handling direct signaling message:', msg.type);
                handleSignalingMessage(msg);
            }
        });
    });
}

// Close modal
if (closeModal) {
    closeModal.addEventListener('click', () => {
        const modal = document.getElementById('connection-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
    });
}

// Log connection state for debugging
function logConnectionState(state) {
    console.log(`[Connection Log] ${new Date().toLocaleTimeString()}: ${state}`);
}

// WebRTC connection function
function startConnection() {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
        const errorMsg = 'WebRTC is not available. Please open this application in a web browser at http://localhost:3000/';
        console.error('❌ ' + errorMsg);
        updateConnectionStatus('error', 'WebRTC not available');
        displayMessage('❌ ' + errorMsg, 'system');
        return;
    }
    
    try {
        // Update connection status
        updateConnectionStatus('connecting', 'Establishing connection...');
        logConnectionState('Starting WebRTC connection setup');
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(configuration);
        logConnectionState('RTCPeerConnection created');
        
        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
            if (peerConnection.connectionState !== 'connected' && 
                peerConnection.connectionState !== 'completed') {
                logConnectionState('Connection timeout');
                updateConnectionStatus('disconnected', 'Connection timeout');
            }
        }, CONNECTION_TIMEOUT);
        
        // Log connection state changes
        peerConnection.onconnectionstatechange = () => {
            logConnectionState(`Connection state: ${peerConnection.connectionState}`);
            
            if (peerConnection.connectionState === 'connected') {
                logConnectionState('🎉 WebRTC connection established!');
                clearTimeout(connectionTimeout);
                updateConnectionStatus('connected', '🟢 Connected - Ready to chat!');
            } else if (peerConnection.connectionState === 'failed') {
                logConnectionState('❌ WebRTC connection failed');
                updateConnectionStatus('disconnected', '❌ Connection failed');
                displayMessage('❌ Connection failed. Please try again.', 'system');
            } else if (peerConnection.connectionState === 'disconnected') {
                logConnectionState('📡 WebRTC connection disconnected');
                updateConnectionStatus('disconnected', '📡 Disconnected');
                displayMessage('📡 Connection lost', 'system');
            }
        };
        
        peerConnection.onsignalingstatechange = () => {
            logConnectionState(`Signaling state: ${peerConnection.signalingState}`);
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            logConnectionState(`ICE connection state: ${peerConnection.iceConnectionState}`);
            
            if (peerConnection.iceConnectionState === 'connected' || 
                peerConnection.iceConnectionState === 'completed') {
                updateConnectionStatus('connected', 'Connected');
            } else if (peerConnection.iceConnectionState === 'disconnected' || 
                      peerConnection.iceConnectionState === 'failed') {
                updateConnectionStatus('disconnected', 'Disconnected');
            }
        };
        
        peerConnection.onicegatheringstatechange = () => {
            logConnectionState(`ICE gathering state: ${peerConnection.iceGatheringState}`);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                logConnectionState(`ICE candidate gathered: ${event.candidate.type}`);
                signaling.send({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            } else {
                logConnectionState('ICE candidate gathering complete');
            }
        };
        
        // Handle data channel
        if (isInitiator) {
            logConnectionState('Creating data channel (initiator)');
            dataChannel = peerConnection.createDataChannel('messaging', {
                ordered: true,
                maxRetransmits: 3
            });
            setupDataChannel(dataChannel);
            
            // Create offer
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
                    updateConnectionStatus('disconnected', 'Connection failed');
                });
        } else {
            logConnectionState('Waiting for data channel (non-initiator)');
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
        updateConnectionStatus('disconnected', 'Connection failed');
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
        case 'ice-candidate':
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
    }
}

// Setup data channel
function setupDataChannel(channel) {
    channel.onopen = () => {
        isConnected = true;
        logConnectionState('Data channel opened - connection established');
        updateConnectionStatus('connected', '🟢 Connected - Ready to chat!');
        
        // Show success message
        if (isInitiator) {
            displayMessage('🎉 Network created successfully! You can now share messages securely.', 'system');
        } else {
            displayMessage('🎉 Successfully joined the network! You can now chat securely.', 'system');
        }
        
        // Close connection modal
        const modal = document.getElementById('connection-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
        
        // Focus message input
        if (messageInput) {
            messageInput.focus();
        }
        
        console.log('✅ Data channel is now open and ready for messaging!');
    };
    
    channel.onclose = () => {
        isConnected = false;
        updateConnectionStatus('disconnected', '🔴 Disconnected');
        displayMessage('📡 Connection closed', 'system');
        logConnectionState('Data channel closed');
    };
    
    channel.onerror = (error) => {
        logConnectionState(`Data channel error: ${error.message}`);
        console.error('Data channel error:', error);
        updateConnectionStatus('disconnected', '❌ Connection error');
        displayMessage('❌ Connection error occurred', 'system');
    };
    
    channel.onmessage = event => {
        try {
            console.log('📨 Received message:', event.data);
            const data = JSON.parse(event.data);
            
            if (data.type === 'message') {
                let messageText = data.content;
                
                // Try to decrypt if encryption is enabled and key is available
                if (data.encrypted && encryptionKey) {
                    try {
                        messageText = decryptMessage(data.content, currentCipher);
                    } catch (decryptError) {
                        console.warn('Decryption failed:', decryptError);
                        messageText = '[🔒 Encrypted message - decryption failed]';
                    }
                } else if (!data.encrypted) {
                    // Message is not encrypted, use as-is
                    messageText = data.content;
                } else {
                    // Message is encrypted but no key available
                    console.warn('Received encrypted message but no encryption key available');
                    messageText = '[🔒 Encrypted message - key not available]';
                }
                
                displayMessage(messageText, 'received', data.messageId);
            } else {
                console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            displayMessage('[❌ Error processing message]', 'received');
        }
    };
}

// Disconnect from room
function disconnect() {
    if (dataChannel) {
        dataChannel.close();
    }
    if (peerConnection) {
        peerConnection.close();
    }

    signaling.disconnect();

    isConnected = false;
    updateConnectionStatus('disconnected', 'Disconnected');
}

// Send message
if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
}

if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) {
        return;
    }
    
    console.log('🚀 Attempting to send message:', message);
    console.log('Connection status:', isConnected);
    console.log('Data channel:', dataChannel);
    console.log('Data channel state:', dataChannel?.readyState);
    
    if (!isConnected || !dataChannel || dataChannel.readyState !== 'open') {
        console.warn('Cannot send message - not connected');
        displayMessage('⚠️ Not connected. Please establish connection first.', 'system');
        return;
    }
    
    try {
        const messageId = ++messageCounter;
        let messageData;
        
        // Try to encrypt if encryption is available, otherwise send plain text for testing
        if (encryptionKey) {
            try {
                const encryptedMessage = encryptMessage(message, currentCipher);
                messageData = {
                    type: 'message',
                    content: encryptedMessage,
                    timestamp: Date.now(),
                    messageId: messageId,
                    encrypted: true
                };
            } catch (encryptError) {
                console.warn('Encryption failed, sending plain text:', encryptError);
                messageData = {
                    type: 'message',
                    content: message,
                    timestamp: Date.now(),
                    messageId: messageId,
                    encrypted: false
                };
            }
        } else {
            // No encryption key available, send plain text
            console.log('No encryption key, sending plain text message');
            messageData = {
                type: 'message',
                content: message,
                timestamp: Date.now(),
                messageId: messageId,
                encrypted: false
            };
        }
        
        console.log('📤 Sending message data:', messageData);
        dataChannel.send(JSON.stringify(messageData));
        
        // Display sent message
        displayMessage(message, 'sent', messageId);
        messageInput.value = '';
        
        // Auto-resize textarea
        messageInput.style.height = 'auto';
        
    } catch (error) {
        console.error('Error sending message:', error);
        displayMessage(`❌ Failed to send message: ${error.message}`, 'system');
    }
}

// Display message in UI
function displayMessage(message, type, messageId = null) {
    if (!messagesContainer) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    if (messageId) {
        messageElement.setAttribute('data-message-id', messageId);
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message;
    
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = timeString;
    
    messageElement.appendChild(messageContent);
    messageElement.appendChild(messageTime);
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
            encryptionKey = 'rsa-key-placeholder';
            break;
        case 'chacha20':
            encryptionKey = CryptoJS.lib.WordArray.random(256/8);
            break;
    }
    
    // Share the key through the signaling channel (for demo purposes)
    if (isInitiator) {
        // Send key immediately after initialization
        signaling.send({
            type: 'key',
            cipher: currentCipher,
            key: encryptionKey.toString()
        });
        
        // Also send key again after WebRTC connection is established to ensure receipt
        setTimeout(() => {
            signaling.send({
                type: 'key',
                cipher: currentCipher,
                key: encryptionKey.toString()
            });
        }, 3000);
    }
}

// Handle incoming key exchange messages
function handleKeyExchange(message) {
    if (message.type === 'key') {
        // Set the encryption key received from the initiator
        encryptionKey = CryptoJS.enc.Hex.parse(message.key);
        logConnectionState(`Encryption key received for ${message.cipher}`);
    }
}

// Encrypt message based on selected cipher
function encryptMessage(message, cipher) {
    switch (cipher) {
        case 'aes':
            return CryptoJS.AES.encrypt(message, encryptionKey).toString();
        case 'rsa':
            return btoa(message);
        case 'chacha20':
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
                return atob(encryptedMessage);
            case 'chacha20':
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
    // Generate a room ID by default
    if (roomIdInput) {
        roomIdInput.value = generateRoomId();
    }
    
    // Set initial connection status
    updateConnectionStatus('disconnected', 'Disconnected');
});
