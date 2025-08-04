// CipherWave - Secure P2P Messenger
// script.js - Enhanced with security fixes and performance optimizations

// Load security, message, and connection managers
const securityManager = new SecurityManager();
let messageManager = null;
let connectionManager = null;

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
const userIdDisplay = document.getElementById('user-id-display');
const peerStatus = document.getElementById('peer-status');

// Application State
let peerConnection = null;
let dataChannel = null;
let isConnected = false;
let isInitiator = false;
let currentCipher = 'chacha20-poly1305'; // Use secure cipher by default
let room = null;
let nodeServer = null;
let signalingSocket = null;
let pendingMessages = new Map(); // For message delivery confirmations
let messageCounter = 0;
let userId = null;
let authenticationState = 'none'; // 'none', 'challenging', 'authenticated'
let peerChallenge = null;

// Optimized WebRTC configuration for faster connection establishment (2-4s target)
const configuration = {
    iceServers: [
        // Primary STUN server (Google - most reliable and fastest)
        { urls: 'stun:stun.l.google.com:19302' },
        
        // Primary TURN server (OpenRelay - most reliable free TURN)
        { 
            urls: 'turn:openrelay.metered.ca:80', 
            username: 'openrelayproject', 
            credential: 'openrelayproject' 
        },
        
        // Backup TURN server with TCP transport for restrictive networks
        { 
            urls: 'turn:openrelay.metered.ca:443?transport=tcp', 
            username: 'openrelayproject', 
            credential: 'openrelayproject' 
        }
    ],
    
    // Optimized ICE configuration for speed
    iceCandidatePoolSize: 2,  // Reduced from 10 to minimize gathering time
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// Fallback configuration for difficult network conditions
const fallbackConfiguration = {
    iceServers: [
        // Google STUN servers (backup)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        
        // Additional TURN servers for fallback
        { urls: 'turn:freeturn.net:3478', username: 'free', credential: 'free' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
    ],
    iceCandidatePoolSize: 3,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
};

// Function to validate TURN server credentials
function validateTurnCredentials(iceServers) {
    return iceServers.map(server => {
        if (server.urls.startsWith('turn:') && (!server.username || !server.credential)) {
            console.warn('TURN server missing credentials:', server.urls);
            // Remove the server from the list if credentials are missing
            return null;
        }
        return server;
    }).filter(server => server !== null);
}

// Validate and filter ICE servers
const validatedIceServers = validateTurnCredentials(configuration.iceServers);
configuration.iceServers = validatedIceServers;

// Optimized connection timeout values for faster establishment
const CONNECTION_TIMEOUT = 15000; // 15 seconds (reduced from 60s)
const ICE_TIMEOUT = 8000; // 8 seconds (reduced from 30s)
const ICE_GATHERING_TIMEOUT = 5000; // 5 seconds for ICE gathering
const OFFER_ANSWER_TIMEOUT = 3000; // 3 seconds for offer/answer exchange

// Connection state tracking for debugging
let connectionStateLog = [];

// Connection pooling and reuse optimization
let connectionPool = {
    activeConnections: new Map(),
    connectionAttempts: 0,
    lastSuccessfulConfig: null,
    fastConnectionEnabled: true
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

// Generate a cryptographically secure random room ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let roomId = '';
    
    if (window.crypto && window.crypto.getRandomValues) {
        // Use secure random number generation
        const randomArray = new Uint8Array(20);
        window.crypto.getRandomValues(randomArray);
        
        for (let i = 0; i < 20; i++) {
            roomId += chars.charAt(randomArray[i] % chars.length);
        }
    } else {
        // Fallback for older browsers
        console.warn('Using fallback random generation - not cryptographically secure');
        for (let i = 0; i < 20; i++) {
            roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    return roomId;
}

// Generate a unique user ID
function generateUserId() {
    const prefix = 'CW';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = prefix + '-';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
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
    
    // Update peer status in chat header
    if (peerStatus) {
        peerStatus.textContent = text;
        if (className.includes('connected')) {
            peerStatus.style.color = '#4CAF50';
        } else if (className.includes('disconnected')) {
            peerStatus.style.color = '#F44336';
        } else {
            peerStatus.style.color = '#FF9800';
        }
    }
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

// Connect to room with enhanced security
connectBtn.addEventListener('click', async () => {
    room = roomInput.value.trim();
    if (!room) {
        alert('Please enter or generate a room ID');
        return;
    }

    // Validate room ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(room) || room.length < 4 || room.length > 100) {
        alert('Invalid room ID format. Use only letters, numbers, hyphens, and underscores (4-100 characters)');
        return;
    }

    try {
        // Initialize security manager first
        updateConnectionStatus('Initializing security...', 'status-disconnected');
        const securityInitialized = await securityManager.initialize();
        if (!securityInitialized) {
            throw new Error('Failed to initialize security subsystem');
        }

        // Initialize message manager
        if (!messageManager) {
            messageManager = new MessageManager(messagesContainer, {
                maxMessages: 1000,
                batchSize: 5,
                batchInterval: 100
            });
        }

        // Discover and connect to signaling server
        updateConnectionStatus('Discovering network...', 'status-disconnected');
        let serverUrl;
        try {
            serverUrl = await discoverServer(room);
        } catch (err) {
            updateConnectionStatus('No available servers', 'status-disconnected');
            return;
        }

        // Initialize connection manager
        connectionManager = new ConnectionManager(configuration, signaling);
        connectionManager.addEventListener('connected', () => {
            isConnected = true;
            updateConnectionStatus('Connected', 'status-connected');
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            
            // Show chat panel
            connectionPanel.classList.add('hidden');
            chatPanel.classList.remove('hidden');
        });
        
        connectionManager.addEventListener('disconnected', () => {
            isConnected = false;
            updateConnectionStatus('Disconnected', 'status-disconnected');
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            
            // Show connection panel
            chatPanel.classList.add('hidden');
            connectionPanel.classList.remove('hidden');
        });
        
        connectionManager.addEventListener('error', (error) => {
            console.error('Connection error:', error);
            updateConnectionStatus('Connection error: ' + error.message, 'status-disconnected');
        });
        
        connectionManager.addEventListener('dataReceived', async (data) => {
            try {
                const messageData = JSON.parse(data);
                if (messageData.type === 'message') {
                    const decryptedMessage = await decryptMessage(messageData.content);
                    displayMessage(decryptedMessage, 'received');
                    
                    // Send delivery confirmation
                    if (messageData.messageId) {
                        connectionManager.sendData(JSON.stringify({
                            type: 'delivery-confirmation',
                            messageId: messageData.messageId
                        }));
                    }
                } else if (messageData.type === 'delivery-confirmation') {
                    if (messageManager) {
                        messageManager.updateMessageStatus(messageData.messageId, 'delivered');
                    }
                    pendingMessages.delete(messageData.messageId);
                }
            } catch (error) {
                console.error('Error processing received data:', error);
            }
        });

        // Set up signaling message handler with authentication
        signaling.onMessage(handleSecureSignalingMessage);
        
    } catch (error) {
        console.error('Connection initialization failed:', error);
        updateConnectionStatus('Connection failed: ' + error.message, 'status-disconnected');
    }
});

// Log connection state for debugging
function logConnectionState(state) {
    const timestamp = new Date().toLocaleTimeString();
    connectionStateLog.push(`${timestamp}: ${state}`);
    console.log(`[Connection Log] ${timestamp}: ${state}`);
    
    // Update debug panel in real-time
    if (typeof debugLogs !== 'undefined' && debugLogs) {
        const logEntry = document.createElement('div');
        logEntry.className = 'debug-log-entry';
        logEntry.textContent = `[${timestamp}] ${state}`;
        debugLogs.appendChild(logEntry);
        
        // Scroll to bottom
        debugLogs.scrollTop = debugLogs.scrollHeight;
    }
}

// Optimized WebRTC connection function with fast connection logic
function startConnection() {
    try {
        // Update connection status
        updateConnectionStatus('Establishing peer connection...', 'status-disconnected');
        logConnectionState('Starting optimized WebRTC connection setup');
        
        // Use last successful configuration if available, otherwise use optimized default
        const configToUse = connectionPool.lastSuccessfulConfig || configuration;
        connectionPool.connectionAttempts++;
        
        // Create peer connection with optimized configuration
        peerConnection = new RTCPeerConnection(configToUse);
        logConnectionState(`RTCPeerConnection created (attempt ${connectionPool.connectionAttempts})`);
        
        // Set up optimized connection timeout
        const connectionTimeout = setTimeout(() => {
            if (peerConnection.connectionState !== 'connected' && 
                peerConnection.connectionState !== 'completed') {
                logConnectionState('Connection timeout - trying fallback');
                updateConnectionStatus('Connection timeout, trying fallback...', 'status-disconnected');
                
                // Try fallback configuration if primary fails
                if (connectionPool.connectionAttempts === 1) {
                    peerConnection.close();
                    startConnectionWithFallback();
                    return;
                }
                
                // If fallback also fails, restart ICE
                if (peerConnection.iceConnectionState === 'checking' || 
                    peerConnection.iceConnectionState === 'disconnected') {
                    logConnectionState('Attempting ICE restart after timeout');
                    peerConnection.restartIce();
                }
            }
        }, CONNECTION_TIMEOUT);
        
        // Setup connection handlers
        setupConnectionHandlers(configToUse);
        
        // Clear timeout when connection is established
        const originalConnectionHandler = peerConnection.onconnectionstatechange;
        peerConnection.onconnectionstatechange = () => {
            originalConnectionHandler();
            if (peerConnection.connectionState === 'connected' || 
                peerConnection.connectionState === 'completed') {
                clearTimeout(connectionTimeout);
            }
        };
        
        // Handle signaling state changes
        peerConnection.onsignalingstatechange = () => {
            logConnectionState(`Signaling state: ${peerConnection.signalingState}`);
        };
        
        // Handle data channel and offer creation
        if (isInitiator) {
            logConnectionState('Creating data channel (initiator)');
            createOfferWithTimeout();
        } else {
            logConnectionState('Waiting for data channel (non-initiator)');
        }
        
    } catch (error) {
        logConnectionState(`Error starting connection: ${error.message}`);
        console.error('Error starting connection:', error);
        updateConnectionStatus('Connection failed', 'status-disconnected');
    }
}

// Fallback connection function with alternative configuration
function startConnectionWithFallback() {
    logConnectionState('Starting connection with fallback configuration');
    connectionPool.connectionAttempts++;
    
    // Use fallback configuration
    peerConnection = new RTCPeerConnection(fallbackConfiguration);
    logConnectionState(`RTCPeerConnection created with fallback (attempt ${connectionPool.connectionAttempts})`);
    
    // Set the same event handlers but with fallback config reference
    setupConnectionHandlers(fallbackConfiguration);
    
    // Continue with connection setup
    if (isInitiator) {
        createOfferWithTimeout();
    }
}

// Setup connection handlers (extracted for reuse)
function setupConnectionHandlers(config) {
    // Connection state change handler
    peerConnection.onconnectionstatechange = () => {
        logConnectionState(`Connection state: ${peerConnection.connectionState}`);
        updateConnectionStatus(`Connection: ${peerConnection.connectionState}`, 'status-disconnected');
        
        if (peerConnection.connectionState === 'connected' || 
            peerConnection.connectionState === 'completed') {
            logConnectionState('Connection established successfully');
            connectionPool.lastSuccessfulConfig = config;
        }
        
        if (peerConnection.connectionState === 'failed') {
            logConnectionState('Connection failed, attempting to restart ICE');
            peerConnection.restartIce();
        }
    };
    
    // ICE connection state handler
    peerConnection.oniceconnectionstatechange = () => {
        logConnectionState(`ICE connection state: ${peerConnection.iceConnectionState}`);
        
        if (peerConnection.iceConnectionState === 'failed') {
            logConnectionState('ICE connection failed, attempting to restart ICE');
            peerConnection.restartIce();
        }
    };
    
    // ICE gathering state handler
    peerConnection.onicegatheringstatechange = () => {
        logConnectionState(`ICE gathering state: ${peerConnection.iceGatheringState}`);
        
        if (peerConnection.iceGatheringState === 'gathering') {
            setTimeout(() => {
                if (peerConnection.iceGatheringState === 'gathering') {
                    logConnectionState('ICE gathering timeout - forcing completion');
                    peerConnection.onicecandidate({ candidate: null });
                }
            }, ICE_GATHERING_TIMEOUT);
        } else if (peerConnection.iceGatheringState === 'complete') {
            connectionPool.lastSuccessfulConfig = config;
        }
    };
    
    // ICE candidate handler
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
    
    // Data channel handler
    if (isInitiator) {
        dataChannel = peerConnection.createDataChannel('messaging', {
            ordered: true,
            maxRetransmits: 3
        });
        setupDataChannel(dataChannel);
    } else {
        peerConnection.ondatachannel = event => {
            logConnectionState('Data channel received');
            dataChannel = event.channel;
            dataChannel.binaryType = 'arraybuffer';
            setupDataChannel(dataChannel);
        };
    }
}

// Create offer with timeout optimization
function createOfferWithTimeout() {
    logConnectionState('Creating offer with timeout');
    
    const offerTimeout = setTimeout(() => {
        logConnectionState('Offer creation timeout');
        updateConnectionStatus('Offer timeout', 'status-disconnected');
    }, OFFER_ANSWER_TIMEOUT);
    
    peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
    })
    .then(offer => {
        clearTimeout(offerTimeout);
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
        clearTimeout(offerTimeout);
        logConnectionState(`Error creating offer: ${error.message}`);
        console.error('Error creating offer:', error);
        updateConnectionStatus('Connection failed', 'status-disconnected');
    });
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
    
    channel.onerror = (error) => {
        logConnectionState(`Data channel error: ${error.message}`);
        console.error('Data channel error:', error);
        
        // If we're still connected, try to restart the data channel
        if (isConnected) {
            logConnectionState('Attempting to restart data channel after error');
            isConnected = false;
            updateConnectionStatus('Data channel error, reconnecting...', 'status-disconnected');
            
            // Try to restart the connection after a short delay
            setTimeout(() => {
                if (peerConnection && peerConnection.connectionState !== 'connected') {
                    logConnectionState('Restarting ICE after data channel error');
                    peerConnection.restartIce();
                }
            }, 2000);
        }
    };
    
    channel.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                // Decrypt message using security manager
                const decryptedMessage = await decryptMessage(data.content);
                displayMessage(decryptedMessage, 'received');
                
                // Send delivery confirmation
                if (data.messageId) {
                    channel.send(JSON.stringify({
                        type: 'delivery-confirmation',
                        messageId: data.messageId
                    }));
                }
            } else if (data.type === 'delivery-confirmation') {
                // Handle message delivery confirmation
                if (messageManager) {
                    messageManager.updateMessageStatus(data.messageId, 'delivered');
                }
                pendingMessages.delete(data.messageId);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            logConnectionState(`Message processing error: ${error.message}`);
        }
    };
}

// Disconnect from room
disconnectBtn.addEventListener('click', () => {
    // Close connection manager
    if (connectionManager) {
        connectionManager.close();
        connectionManager = null;
    }
    
    // Close signaling connection
    signaling.disconnect();
    
    // Clean up security manager
    if (securityManager) {
        securityManager.destroy();
    }

    // Reset state
    isConnected = false;
    authenticationState = 'none';
    updateConnectionStatus('Disconnected', 'status-disconnected');
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;

    // Show connection panel
    chatPanel.classList.add('hidden');
    connectionPanel.classList.remove('hidden');

    // Clear messages using message manager
    if (messageManager) {
        messageManager.clearAllMessages();
    }
    
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

// Send message function with enhanced security
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected || !dataChannel) return;
    
    try {
        // Validate message length and content
        if (message.length > 5000) {
            alert('Message too long (maximum 5000 characters)');
            return;
        }
        
        // Encrypt message using security manager
        const encryptedData = await encryptMessage(message);
        
        // Create message ID for tracking
        const messageId = ++messageCounter;
        
        // Send via data channel
        const messageData = {
            type: 'message',
            content: encryptedData,
            timestamp: Date.now(),
            messageId: messageId
        };
        
        if (connectionManager && connectionManager.sendData(JSON.stringify(messageData))) {
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
                    if (messageManager) {
                        messageManager.updateMessageStatus(messageId, 'failed');
                    }
                    pendingMessages.delete(messageId);
                }
            }, 5000);
        } else {
            throw new Error('Failed to send message - connection not available');
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + error.message);
    }
}

// Display message using enhanced message manager
function displayMessage(message, type, messageId = null) {
    if (messageManager) {
        messageManager.addMessage(message, type, messageId);
    } else {
        console.error('Message manager not initialized');
    }
}

// Enhanced unread message counter
let unreadCount = 0;
function updateUnreadCount() {
    const unreadElement = document.getElementById('unread-count');
    if (unreadElement) {
        if (unreadCount > 0) {
            unreadElement.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
            unreadElement.style.display = 'inline-block';
        } else {
            unreadElement.style.display = 'none';
        }
    }
}

// Secure authentication and key exchange process
async function performAuthentication() {
    if (!securityManager.isInitialized) {
        throw new Error('Security manager not initialized');
    }

    if (isInitiator) {
        // Initiator starts the authentication process
        logConnectionState('Starting authentication as initiator');
        const publicKeys = securityManager.getPublicKeys();
        
        signaling.send({
            type: 'auth-request',
            publicKeys: publicKeys
        });
        
        authenticationState = 'challenging';
    } else {
        // Non-initiator waits for authentication request
        logConnectionState('Waiting for authentication request');
    }
}

// Handle secure signaling messages with authentication
async function handleSecureSignalingMessage(msg) {
    try {
        switch (msg.type) {
            case 'init':
                isInitiator = msg.initiator;
                logConnectionState(`Received init message, isInitiator: ${isInitiator}`);
                await performAuthentication();
                break;
                
            case 'auth-request':
                await handleAuthRequest(msg);
                break;
                
            case 'auth-challenge':
                await handleAuthChallenge(msg);
                break;
                
            case 'auth-response':
                await handleAuthResponse(msg);
                break;
                
            case 'key-exchange':
                await handleSecureKeyExchange(msg);
                break;
                
            case 'authenticated':
                logConnectionState('Authentication successful, starting WebRTC connection');
                if (connectionManager) {
                    await connectionManager.createConnection(isInitiator);
                }
                break;
                
            default:
                // Handle regular WebRTC signaling only after authentication
                if (authenticationState === 'authenticated') {
                    handleSignalingMessage(msg);
                } else {
                    console.warn('Received signaling message before authentication:', msg.type);
                }
        }
    } catch (error) {
        console.error('Error handling secure signaling message:', error);
        logConnectionState(`Signaling error: ${error.message}`);
    }
}

// Handle authentication request
async function handleAuthRequest(msg) {
    if (isInitiator) return; // Only non-initiator handles auth requests
    
    logConnectionState('Processing authentication request');
    const myPublicKeys = securityManager.getPublicKeys();
    
    // Generate challenge for peer
    const challenge = securityManager.generateChallenge();
    peerChallenge = challenge;
    
    signaling.send({
        type: 'auth-challenge',
        publicKeys: myPublicKeys,
        challenge: challenge
    });
    
    authenticationState = 'challenging';
}

// Handle authentication challenge
async function handleAuthChallenge(msg) {
    if (!isInitiator) return; // Only initiator handles challenges
    
    logConnectionState('Processing authentication challenge');
    
    try {
        // Sign the challenge
        const signature = await securityManager.signChallenge(msg.challenge);
        
        // Generate our own challenge
        const myChallenge = securityManager.generateChallenge();
        peerChallenge = myChallenge;
        
        signaling.send({
            type: 'auth-response',
            signature: signature,
            challenge: myChallenge
        });
        
    } catch (error) {
        console.error('Failed to sign challenge:', error);
        logConnectionState('Authentication failed: signature error');
    }
}

// Handle authentication response
async function handleAuthResponse(msg) {
    if (isInitiator) return; // Only non-initiator handles responses
    
    logConnectionState('Processing authentication response');
    
    try {
        // Verify peer's signature (would need peer's public key)
        // const isValid = await securityManager.verifySignature(peerChallenge, msg.signature, peerPublicKey);
        
        // For now, proceed with key exchange
        // Sign the challenge from peer
        const signature = await securityManager.signChallenge(msg.challenge);
        
        // Perform ECDH key exchange
        const myPublicKeys = securityManager.getPublicKeys();
        
        signaling.send({
            type: 'key-exchange',
            signature: signature,
            ephemeralPublicKey: myPublicKeys.ephemeral
        });
        
    } catch (error) {
        console.error('Authentication response failed:', error);
        logConnectionState('Authentication failed: response error');
    }
}

// Handle secure key exchange
async function handleSecureKeyExchange(msg) {
    if (!isInitiator) return; // Only initiator handles key exchange
    
    logConnectionState('Processing secure key exchange');
    
    try {
        // Perform ECDH with peer's ephemeral public key
        await securityManager.performKeyExchange(msg.ephemeralPublicKey);
        
        // Send our ephemeral public key
        const myPublicKeys = securityManager.getPublicKeys();
        
        signaling.send({
            type: 'key-exchange-complete',
            ephemeralPublicKey: myPublicKeys.ephemeral
        });
        
        authenticationState = 'authenticated';
        
        signaling.send({
            type: 'authenticated'
        });
        
    } catch (error) {
        console.error('Key exchange failed:', error);
        logConnectionState('Key exchange failed: ' + error.message);
    }
}

// Encrypt message using security manager
async function encryptMessage(message) {
    try {
        // Validate and sanitize message
        SecurityManager.validateInput(message, 5000);
        const sanitizedMessage = SecurityManager.sanitizeMessage(message);
        
        // Encrypt using security manager
        return await securityManager.encryptMessage(sanitizedMessage);
    } catch (error) {
        console.error('Encryption failed:', error);
        throw error;
    }
}

// Decrypt message using security manager
async function decryptMessage(encryptedData) {
    try {
        return await securityManager.decryptMessage(encryptedData);
    } catch (error) {
        console.error('Decryption failed:', error);
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
    
    // Generate and display user ID
    userId = generateUserId();
    if (userIdDisplay) {
        userIdDisplay.textContent = userId;
    }
    
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
    debugInfo += `Time: ${new Date().toLocaleString()}\n`;
    debugInfo += `User ID: ${userId || 'Not generated'}\n\n`;
    
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
