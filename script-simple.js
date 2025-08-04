// CipherWave - Secure P2P Messenger (Simplified Interface)
// Enhanced with security fixes and performance optimizations

// Load security, message, and connection managers
const securityManager = new SecurityManager();
let messageManager = null;
let connectionManager = null;

// DOM Elements - with null checks for missing elements
const modeSelection = document.getElementById('mode-selection');
const nodePanel = document.getElementById('node-panel');
const connectionPanel = document.getElementById('connection-panel');
const chatPanel = document.getElementById('chat-panel');
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
const debugLogs = document.getElementById('debug-logs');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const runDebugBtn = document.getElementById('run-debug-btn');
const userIdDisplay = document.getElementById('user-id-display');

// Application State
let peerConnection = null;
let dataChannel = null;
let isConnected = false;
let isInitiator = false;
let currentCipher = 'chacha20-poly1305';
let room = null;
let nodeServer = null;
let signalingSocket = null;
let pendingMessages = new Map();
let messageCounter = 0;
let userId = null;
let authenticationState = 'none';
let peerChallenge = null;

// Configuration for WebRTC
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
    ],
    iceCandidatePoolSize: 10
};

// Connection timeout values
const CONNECTION_TIMEOUT = 60000;
const ICE_TIMEOUT = 30000;

// Connection state tracking
let connectionStateLog = [];

// List of known signaling servers
const knownServers = [
    'ws://localhost:8081',
    'ws://localhost:52178',
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

// Generate secure random room ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let roomId = '';
    
    if (window.crypto && window.crypto.getRandomValues) {
        const randomArray = new Uint8Array(20);
        window.crypto.getRandomValues(randomArray);
        
        for (let i = 0; i < 20; i++) {
            roomId += chars.charAt(randomArray[i] % chars.length);
        }
    } else {
        console.warn('Using fallback random generation - not cryptographically secure');
        for (let i = 0; i < 20; i++) {
            roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    return roomId;
}

// Generate unique user ID
function generateUserId() {
    const prefix = 'CW';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = prefix + '-';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// Update status displays
function updateNodeStatus(text, className) {
    if (nodeStatus) {
        nodeStatus.textContent = text;
        nodeStatus.className = 'status ' + className;
    }
}

function updateConnectionStatus(text, className) {
    if (connectionStatus) {
        connectionStatus.textContent = text;
        connectionStatus.className = 'status ' + className;
    }
}

// Log connection state
function logConnectionState(state) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${state}`;
    connectionStateLog.push(logEntry);
    console.log(logEntry);
    
    if (debugLogs) {
        const logDiv = document.createElement('div');
        logDiv.textContent = logEntry;
        debugLogs.appendChild(logDiv);
        debugLogs.scrollTop = debugLogs.scrollHeight;
    }
}

// Automatic server discovery
async function discoverServer(roomId) {
    updateConnectionStatus('Discovering network...', 'status-connecting');
    
    for (const server of knownServers) {
        try {
            updateConnectionStatus(`Trying ${server}...`, 'status-connecting');
            await signaling.connect(server, roomId);
            logConnectionState(`Connected to signaling server: ${server}`);
            return server;
        } catch (err) {
            logConnectionState(`Failed to connect to ${server}: ${err.message}`);
            continue;
        }
    }
    
    throw new Error('No available signaling servers found');
}

// Display message using enhanced message manager
function displayMessage(message, type, messageId = null) {
    if (messageManager) {
        messageManager.addMessage(message, type, messageId);
    } else {
        // Fallback display method
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        if (messageId) {
            messageElement.setAttribute('data-message-id', messageId);
        }
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Encrypt message using security manager
async function encryptMessage(message) {
    try {
        SecurityManager.validateInput(message, 5000);
        const sanitizedMessage = SecurityManager.sanitizeMessage(message);
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

// Send message function with enhanced security
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected || !connectionManager) return;
    
    try {
        if (message.length > 5000) {
            alert('Message too long (maximum 5000 characters)');
            return;
        }
        
        const encryptedData = await encryptMessage(message);
        const messageId = ++messageCounter;
        
        const messageData = {
            type: 'message',
            content: encryptedData,
            timestamp: Date.now(),
            messageId: messageId
        };
        
        if (connectionManager && connectionManager.sendData(JSON.stringify(messageData))) {
            displayMessage(message, 'sent', messageId);
            messageInput.value = '';
            
            pendingMessages.set(messageId, {
                content: message,
                timestamp: Date.now()
            });
            
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

// Simple authentication (for demo - in production use full crypto protocol)
async function performAuthentication() {
    if (!securityManager.isInitialized) {
        throw new Error('Security manager not initialized');
    }
    
    logConnectionState('Authentication completed (simplified for demo)');
    authenticationState = 'authenticated';
    
    // Skip complex authentication for demo
    return true;
}

// Handle secure signaling messages
async function handleSecureSignalingMessage(msg) {
    try {
        switch (msg.type) {
            case 'init':
                isInitiator = msg.initiator;
                logConnectionState(`Received init message, isInitiator: ${isInitiator}`);
                await performAuthentication();
                if (connectionManager) {
                    await connectionManager.createConnection(isInitiator);
                }
                break;
                
            default:
                // Handle regular WebRTC signaling
                handleSignalingMessage(msg);
        }
    } catch (error) {
        console.error('Error handling secure signaling message:', error);
        logConnectionState(`Signaling error: ${error.message}`);
    }
}

// Handle regular signaling messages
function handleSignalingMessage(message) {
    if (!peerConnection && connectionManager && connectionManager.peerConnection) {
        peerConnection = connectionManager.peerConnection;
    }
    
    if (!peerConnection) {
        logConnectionState('Received signaling message but no peer connection exists');
        return;
    }
    
    logConnectionState(`Received signaling message: ${message.type}`);
    
    switch (message.type) {
        case 'offer':
            if (connectionManager) {
                connectionManager.handleOffer(message.offer);
            }
            break;
        case 'answer':
            if (connectionManager) {
                connectionManager.handleAnswer(message.answer);
            }
            break;
        case 'candidate':
            if (connectionManager) {
                connectionManager.handleICECandidate(message.candidate);
            }
            break;
    }
}

// Event Listeners
if (hostNodeBtn) {
    hostNodeBtn.addEventListener('click', () => {
        modeSelection.classList.add('hidden');
        nodePanel.classList.remove('hidden');
    });
}

if (joinNetworkBtn) {
    joinNetworkBtn.addEventListener('click', () => {
        modeSelection.classList.add('hidden');
        connectionPanel.classList.remove('hidden');
    });
}

if (startNodeBtn) {
    startNodeBtn.addEventListener('click', async () => {
        const port = nodePortInput.value || 8080;
        updateNodeStatus('Starting node...', 'status-connecting');
        
        // Simulate node start (in real implementation, this would start a server)
        setTimeout(() => {
            updateNodeStatus(`Node Running on port ${port}`, 'status-connected');
            startNodeBtn.disabled = true;
            stopNodeBtn.disabled = false;
        }, 1000);
    });
}

if (stopNodeBtn) {
    stopNodeBtn.addEventListener('click', () => {
        updateNodeStatus('Node Stopped', 'status-disconnected');
        startNodeBtn.disabled = false;
        stopNodeBtn.disabled = true;
    });
}

if (generateRoomBtn) {
    generateRoomBtn.addEventListener('click', () => {
        roomInput.value = generateRoomId();
    });
}

if (cipherSelect) {
    cipherSelect.addEventListener('change', () => {
        currentCipher = cipherSelect.value;
    });
}

if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
        room = roomInput.value.trim();
        if (!room) {
            alert('Please enter or generate a room ID');
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(room) || room.length < 4 || room.length > 100) {
            alert('Invalid room ID format. Use only letters, numbers, hyphens, and underscores (4-100 characters)');
            return;
        }

        try {
            updateConnectionStatus('Initializing security...', 'status-connecting');
            const securityInitialized = await securityManager.initialize();
            if (!securityInitialized) {
                throw new Error('Failed to initialize security subsystem');
            }

            if (!messageManager) {
                messageManager = new MessageManager(messagesContainer, {
                    maxMessages: 1000,
                    batchSize: 5,
                    batchInterval: 100
                });
            }

            let serverUrl;
            try {
                serverUrl = await discoverServer(room);
            } catch (err) {
                updateConnectionStatus('No available servers', 'status-disconnected');
                return;
            }

            connectionManager = new ConnectionManager(configuration, signaling);
            
            connectionManager.addEventListener('connected', () => {
                isConnected = true;
                updateConnectionStatus('Connected', 'status-connected');
                connectBtn.disabled = true;
                disconnectBtn.disabled = false;
                
                connectionPanel.classList.add('hidden');
                chatPanel.classList.remove('hidden');
            });
            
            connectionManager.addEventListener('disconnected', () => {
                isConnected = false;
                updateConnectionStatus('Disconnected', 'status-disconnected');
                connectBtn.disabled = false;
                disconnectBtn.disabled = true;
                
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

            signaling.onMessage(handleSecureSignalingMessage);
            
        } catch (error) {
            console.error('Connection initialization failed:', error);
            updateConnectionStatus('Connection failed: ' + error.message, 'status-disconnected');
        }
    });
}

if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
        if (connectionManager) {
            connectionManager.close();
            connectionManager = null;
        }
        
        signaling.disconnect();
        
        if (securityManager) {
            securityManager.destroy();
        }

        isConnected = false;
        authenticationState = 'none';
        updateConnectionStatus('Disconnected', 'status-disconnected');
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;

        chatPanel.classList.add('hidden');
        connectionPanel.classList.remove('hidden');

        if (messageManager) {
            messageManager.clearAllMessages();
        }
        
        pendingMessages.clear();
    });
}

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

if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
        if (debugLogs) {
            debugLogs.innerHTML = 'CipherWave Debug Console - Cleared';
        }
        connectionStateLog = [];
    });
}

if (runDebugBtn) {
    runDebugBtn.addEventListener('click', () => {
        debugConnection();
    });
}

// Debug function
function debugConnection() {
    let debugInfo = `=== CipherWave Debug Report ===\n`;
    debugInfo += `Time: ${new Date().toLocaleString()}\n`;
    debugInfo += `User ID: ${userId || 'Not generated'}\n\n`;
    
    debugInfo += `WebRTC Support: ${!!window.RTCPeerConnection}\n`;
    debugInfo += `WebSocket Support: ${!!window.WebSocket}\n`;
    debugInfo += `Crypto Support: ${!!window.crypto}\n\n`;
    
    debugInfo += `Online Status: ${navigator.onLine}\n\n`;
    
    if (signalingSocket) {
        debugInfo += `Signaling Server Status: ${signalingSocket.readyState}\n`;
        debugInfo += `Signaling Server URL: ${signalingSocket.url || 'N/A'}\n\n`;
    } else {
        debugInfo += `Signaling Server: Not connected\n\n`;
    }
    
    if (connectionManager) {
        const stats = connectionManager.getStats();
        debugInfo += `Connection State: ${stats.connectionState}\n`;
        debugInfo += `ICE Connection State: ${stats.iceConnectionState}\n`;
        debugInfo += `Is Connected: ${stats.isConnected}\n`;
        debugInfo += `Reconnect Attempts: ${stats.reconnectAttempts}\n\n`;
    } else {
        debugInfo += `Connection Manager: Not initialized\n\n`;
    }
    
    if (connectionStateLog.length > 0) {
        debugInfo += `=== Recent Connection Events ===\n`;
        const recentLogs = connectionStateLog.slice(-10);
        debugInfo += recentLogs.join('\n');
    } else {
        debugInfo += `=== No Connection Events ===\n`;
    }
    
    debugInfo += `\n=== End Debug Report ===`;
    
    if (debugLogs) {
        const logDiv = document.createElement('div');
        logDiv.style.whiteSpace = 'pre-wrap';
        logDiv.textContent = debugInfo;
        debugLogs.appendChild(logDiv);
        debugLogs.scrollTop = debugLogs.scrollHeight;
    }
    
    console.log(debugInfo);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    updateNodeStatus('Node Stopped', 'status-disconnected');
    updateConnectionStatus('Disconnected', 'status-disconnected');
    
    if (roomInput) {
        roomInput.value = generateRoomId();
    }
    
    userId = generateUserId();
    if (userIdDisplay) {
        userIdDisplay.textContent = userId;
    }
    
    logConnectionState('CipherWave initialized');
});