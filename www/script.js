// CipherWave - Secure P2P Messenger
// Enhanced script.js for Telegram-like UI

// DOM Elements for the new UI
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const roomIdInput = document.getElementById('room-id');
const generateRoomBtn = document.getElementById('generate-room');
const cipherSelect = document.getElementById('cipher-select');
const connectBtn = document.getElementById('connect-btn');
const closeModal = document.getElementById('close-modal');
const peerStatus = document.getElementById('peer-status');
const nicknameInput = document.getElementById('nickname');

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

// Generate a random room ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let roomId = '';
    for (let i = 0; i < 20; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
}

// Update connection status display
function updateConnectionStatus(text, color = 'black') {
    if (peerStatus) {
        peerStatus.textContent = text;
        peerStatus.style.color = color;
    }
}

// Generate room ID on button click
if (generateRoomBtn && roomIdInput) {
    generateRoomBtn.addEventListener('click', () => {
        roomIdInput.value = generateRoomId();
    });
}

// Update cipher selection
if (cipherSelect) {
    cipherSelect.addEventListener('change', () => {
        currentCipher = cipherSelect.value;
    });
}

// Connect to room
if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
        room = roomIdInput.value.trim();
        if (!room) {
            alert('Please enter or generate a room ID');
            return;
        }

        // Set connection status
        updateConnectionStatus('Connecting...', '#FF9800');

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
            updateConnectionStatus('Connection failed', '#F44336');
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
            } else if (msg.type === 'key') {
                // Handle key exchange message
                handleKeyExchange(msg);
            } else {
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
    try {
        // Update connection status
        updateConnectionStatus('Establishing connection...', '#FF9800');
        logConnectionState('Starting WebRTC connection setup');
        
        // Create peer connection
        peerConnection = new RTCPeerConnection(configuration);
        logConnectionState('RTCPeerConnection created');
        
        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
            if (peerConnection.connectionState !== 'connected' && 
                peerConnection.connectionState !== 'completed') {
                logConnectionState('Connection timeout');
                updateConnectionStatus('Connection timeout', '#F44336');
            }
        }, CONNECTION_TIMEOUT);
        
        // Log connection state changes
        peerConnection.onconnectionstatechange = () => {
            logConnectionState(`Connection state: ${peerConnection.connectionState}`);
            
            // Clear timeout if connection is established
            if (peerConnection.connectionState === 'connected' || 
                peerConnection.connectionState === 'completed') {
                clearTimeout(connectionTimeout);
            }
        };
        
        peerConnection.onsignalingstatechange = () => {
            logConnectionState(`Signaling state: ${peerConnection.signalingState}`);
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            logConnectionState(`ICE connection state: ${peerConnection.iceConnectionState}`);
            
            if (peerConnection.iceConnectionState === 'connected' || 
                peerConnection.iceConnectionState === 'completed') {
                updateConnectionStatus('Online', '#4CAF50');
            } else if (peerConnection.iceConnectionState === 'disconnected' || 
                      peerConnection.iceConnectionState === 'failed') {
                updateConnectionStatus('Offline', '#F44336');
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
                    type: 'candidate',
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
                    updateConnectionStatus('Connection failed', '#F44336');
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
        updateConnectionStatus('Connection failed', '#F44336');
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
    }
}

// Setup data channel
function setupDataChannel(channel) {
    channel.onopen = () => {
        isConnected = true;
        updateConnectionStatus('Online', '#4CAF50');
        
        // Close connection modal
        const modal = document.getElementById('connection-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
    };
    
    channel.onclose = () => {
        isConnected = false;
        updateConnectionStatus('Offline', '#F44336');
    };
    
    channel.onerror = (error) => {
        logConnectionState(`Data channel error: ${error.message}`);
        console.error('Data channel error:', error);
        updateConnectionStatus('Connection error', '#F44336');
    };
    
    channel.onmessage = event => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                // Decrypt message
                const decryptedMessage = decryptMessage(data.content, currentCipher);
                displayMessage(decryptedMessage, 'received');
            }
        } catch (error) {
            console.error('Error processing message:', error);
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
    updateConnectionStatus('Offline', '#F44336');
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
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
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
        setTimeout(() => {
            signaling.send({
                type: 'key',
                cipher: currentCipher,
                key: encryptionKey.toString()
            });
        }, 2000);
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
    updateConnectionStatus('Offline', '#F44336');
});
