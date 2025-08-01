// CipherWave - Secure P2P Messenger (Telegram-like UI)
// script.js

// DOM Elements for Telegram-like UI
const app = document.getElementById('app');
const splashScreen = document.getElementById('splash-screen');
const mainContainer = document.getElementById('main-container');
const connectionModal = document.getElementById('connection-modal');
const newChatBtn = document.getElementById('new-chat-btn');
const closeModal = document.getElementById('close-modal');
const nicknameInput = document.getElementById('nickname');
const avatarOptions = document.querySelectorAll('.avatar-option');
const selectedAvatarInput = document.getElementById('selected-avatar');
const roomIdInput = document.getElementById('room-id');
const generateRoomBtn = document.getElementById('generate-room');
const cipherSelect = document.getElementById('cipher-select');
const connectBtn = document.getElementById('connect-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.querySelector('.messages-container');

// Application State
let peerConnection = null;
let dataChannel = null;
let isConnected = false;
let isInitiator = false;
let currentCipher = 'aes';
let encryptionKey = null;
let room = null;
let signalingSocket = null;
let userNickname = '';
let userAvatar = 'avatar1';

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

// List of known signaling servers for automatic discovery
const knownServers = [
    'ws://localhost:52178',
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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Show splash screen for 2 seconds
    setTimeout(() => {
        splashScreen.classList.add('hidden');
        mainContainer.classList.remove('hidden');
    }, 2000);
    
    // Generate a room ID by default
    roomIdInput.value = generateRoomId();
});

// Event Listeners
newChatBtn.addEventListener('click', () => {
    connectionModal.classList.remove('hidden');
});

closeModal.addEventListener('click', () => {
    connectionModal.classList.add('hidden');
});

// Avatar selection
avatarOptions.forEach(option => {
    option.addEventListener('click', () => {
        // Remove selected class from all options
        avatarOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Add selected class to clicked option
        option.classList.add('selected');
        
        // Update hidden input value
        selectedAvatarInput.value = option.dataset.avatar;
        
        // Update userAvatar variable
        userAvatar = option.dataset.avatar;
    });
});

// Generate room ID on button click
generateRoomBtn.addEventListener('click', () => {
    roomIdInput.value = generateRoomId();
});

// Update cipher selection
cipherSelect.addEventListener('change', () => {
    currentCipher = cipherSelect.value;
});

// Connect to room
connectBtn.addEventListener('click', async () => {
    userNickname = nicknameInput.value.trim() || 'Anonymous';
    room = roomIdInput.value.trim();
    
    if (!room) {
        alert('Please enter or generate a room ID');
        return;
    }

    // Hide modal
    connectionModal.classList.add('hidden');
    
    // Discover and connect to signaling server
    let serverUrl;
    try {
        serverUrl = await discoverServer(room);
    } catch (err) {
        alert('No available servers');
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

// Send message
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Generate a random room ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let roomId = '';
    for (let i = 0; i < 20; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
}

// Automatic server discovery
async function discoverServer(roomId) {
    // Try each known server until one works
    for (const server of knownServers) {
        try {
            await signaling.connect(server, roomId);
            return server;
        } catch (err) {
            console.log(`Failed to connect to ${server}`);
            continue;
        }
    }
    
    throw new Error('No available signaling servers found');
}

// Start WebRTC connection
function startConnection() {
    try {
        // Create peer connection
        peerConnection = new RTCPeerConnection(configuration);
        
        // Handle data channel
        if (isInitiator) {
            // Create data channel for initiator
            dataChannel = peerConnection.createDataChannel('messaging');
            setupDataChannel(dataChannel);
            
            // Create offer
            peerConnection.createOffer()
                .then(offer => {
                    return peerConnection.setLocalDescription(offer);
                })
                .then(() => {
                    signaling.send({
                        type: 'offer',
                        offer: peerConnection.localDescription
                    });
                })
                .catch(error => {
                    console.error('Error creating offer:', error);
                });
        } else {
            // Handle incoming data channel for non-initiator
            peerConnection.ondatachannel = event => {
                dataChannel = event.channel;
                setupDataChannel(dataChannel);
            };
        }
        
        // Handle ICE candidates
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                signaling.send({
                    type: 'candidate',
                    candidate: event.candidate
                });
            }
        };
        
        // Handle signaling messages
        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection.iceConnectionState === 'connected') {
                console.log('Connected to peer');
            }
        };
        
    } catch (error) {
        console.error('Error starting connection:', error);
    }
}

// Handle signaling messages
function handleSignalingMessage(message) {
    if (!peerConnection) return;
    
    switch (message.type) {
        case 'offer':
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer))
                .then(() => {
                    return peerConnection.createAnswer();
                })
                .then(answer => {
                    return peerConnection.setLocalDescription(answer);
                })
                .then(() => {
                    signaling.send({
                        type: 'answer',
                        answer: peerConnection.localDescription
                    });
                })
                .catch(error => {
                    console.error('Error handling offer:', error);
                });
            break;
            
        case 'answer':
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
                .catch(error => {
                    console.error('Error handling answer:', error);
                });
            break;
            
        case 'candidate':
            peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
                .catch(error => {
                    console.error('Error adding ICE candidate:', error);
                });
            break;
    }
}

// Setup data channel
function setupDataChannel(channel) {
    channel.onopen = () => {
        isConnected = true;
        console.log('Data channel opened');
    };
    
    channel.onclose = () => {
        isConnected = false;
        console.log('Data channel closed');
    };
    
    channel.onmessage = event => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                // Decrypt message
                const decryptedMessage = decryptMessage(data.content, currentCipher);
                displayMessage(decryptedMessage, 'received', null, data.nickname, data.avatar);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };
}

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected || !dataChannel) return;
    
    try {
        // Encrypt message
        const encryptedMessage = encryptMessage(message, currentCipher);
        
        // Send via data channel
        const messageData = {
            type: 'message',
            content: encryptedMessage,
            timestamp: Date.now(),
            nickname: userNickname,
            avatar: userAvatar
        };
        
        dataChannel.send(JSON.stringify(messageData));
        displayMessage(message, 'sent', null, userNickname, userAvatar);
        messageInput.value = '';
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

// Display message in UI
function displayMessage(message, type, messageId = null, nickname = null, avatar = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    // Create avatar element
    if (nickname && avatar) {
        const avatarElement = document.createElement('div');
        avatarElement.className = 'message-avatar';
        avatarElement.textContent = nickname.charAt(0).toUpperCase();
        messageElement.appendChild(avatarElement);
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = message;
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    messageInfo.textContent = new Date().toLocaleTimeString();
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(messageInfo);
    messageElement.appendChild(messageContent);
    
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

// Handle incoming key exchange messages
function handleKeyExchange(message) {
    if (message.type === 'key') {
        // Set the encryption key received from the initiator
        encryptionKey = CryptoJS.enc.Hex.parse(message.key);
        console.log(`Encryption key received for ${message.cipher}`);
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
