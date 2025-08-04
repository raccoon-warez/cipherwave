// CipherWave Connection Manager - Optimized for code splitting
// Uses simple-peer for WebRTC with enhanced error handling

import Peer from 'simple-peer';

export class ConnectionManager {
    constructor(configuration = {}) {
        this.configuration = {
            initiator: false,
            trickle: true,
            ...configuration
        };
        
        this.peer = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.connectionState = 'new';
        this.eventHandlers = new Map();
        
        // Connection management
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.connectionTimeout = null;
        this.healthCheckInterval = null;
        
        // Signaling
        this.signalingSocket = null;
        this.currentRoom = null;
        
        // Performance tracking
        this.stats = {
            connectTime: 0,
            packetsLost: 0,
            roundTripTime: 0,
            dataChannelState: 'connecting'
        };
        
        console.log('🔗 Connection manager initialized');
    }
    
    // Event system
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }
    
    // Connect to a room
    async connect(roomId, isInitiator = false) {
        if (this.isConnecting || this.isConnected) {
            throw new Error('Connection already in progress or established');
        }
        
        console.log(`🔗 Connecting to room: ${roomId} (initiator: ${isInitiator})`);
        const startTime = performance.now();
        
        try {
            this.isConnecting = true;
            this.currentRoom = roomId;
            
            // Connect to signaling server
            await this.connectToSignalingServer();
            
            // Join room
            await this.joinRoom(roomId);
            
            // Initialize WebRTC peer
            await this.initializePeer(isInitiator);
            
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    this.handleConnectionTimeout();
                }
            }, 30000); // 30 second timeout
            
            this.stats.connectTime = performance.now() - startTime;
            
        } catch (error) {
            this.isConnecting = false;
            console.error('Connection failed:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    // Initialize WebRTC peer connection
    async initializePeer(isInitiator) {
        this.peer = new Peer({
            initiator: isInitiator,
            trickle: true,
            config: this.configuration
        });
        
        // Set up peer event handlers
        this.peer.on('signal', (signal) => {
            console.log('📡 Sending signal:', signal.type);
            this.sendSignal(signal);
        });
        
        this.peer.on('connect', () => {
            console.log('✅ WebRTC connection established');
            this.isConnected = true;
            this.isConnecting = false;
            this.connectionState = 'connected';
            this.stats.dataChannelState = 'open';
            
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            this.startHealthCheck();
            this.emit('connected');
        });
        
        this.peer.on('data', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.emit('dataReceived', message);
            } catch (error) {
                console.error('Failed to parse received data:', error);
            }
        });
        
        this.peer.on('close', () => {
            console.log('🔌 WebRTC connection closed');
            this.handleDisconnection();
        });
        
        this.peer.on('error', (error) => {
            console.error('WebRTC error:', error);
            this.emit('error', error);
            
            // Attempt reconnection for certain errors
            if (this.shouldAttemptReconnect(error)) {
                this.scheduleReconnect();
            }
        });
    }
    
    // Connect to signaling server
    async connectToSignalingServer() {
        return new Promise((resolve, reject) => {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const host = window.location.host;
                const wsUrl = `${protocol}//${host}`;
                
                this.signalingSocket = new WebSocket(wsUrl);
                
                this.signalingSocket.onopen = () => {
                    console.log('📡 Connected to signaling server');
                    resolve();
                };
                
                this.signalingSocket.onmessage = (event) => {
                    this.handleSignalingMessage(JSON.parse(event.data));
                };
                
                this.signalingSocket.onclose = () => {
                    console.log('📡 Signaling server connection closed');
                    if (this.isConnected) {
                        this.scheduleReconnect();
                    }
                };
                
                this.signalingSocket.onerror = (error) => {
                    console.error('Signaling server error:', error);
                    reject(error);
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // Join a room on the signaling server
    async joinRoom(roomId) {
        return new Promise((resolve, reject) => {
            if (!this.signalingSocket || this.signalingSocket.readyState !== WebSocket.OPEN) {
                reject(new Error('Signaling server not connected'));
                return;
            }
            
            const joinMessage = {
                type: 'join',
                room: roomId
            };
            
            this.signalingSocket.send(JSON.stringify(joinMessage));
            
            // Wait for join confirmation
            const timeout = setTimeout(() => {
                reject(new Error('Room join timeout'));
            }, 10000);
            
            const originalHandler = this.handleSignalingMessage.bind(this);
            this.handleSignalingMessage = (message) => {
                if (message.type === 'joined' && message.room === roomId) {
                    clearTimeout(timeout);
                    this.handleSignalingMessage = originalHandler;
                    resolve();
                } else if (message.type === 'error') {
                    clearTimeout(timeout);
                    this.handleSignalingMessage = originalHandler;
                    reject(new Error(message.message));
                } else {
                    originalHandler(message);
                }
            };
        });
    }
    
    // Handle signaling messages
    handleSignalingMessage(message) {
        switch (message.type) {
            case 'signal':
                if (this.peer) {
                    console.log('📡 Received signal:', message.signal.type);
                    this.peer.signal(message.signal);
                }
                break;
                
            case 'peer-joined':
                console.log('👋 Peer joined the room');
                if (!this.peer && !this.isConnecting) {
                    // Become the initiator if we're already in the room
                    this.initializePeer(true);
                }
                break;
                
            case 'peer-left':
                console.log('👋 Peer left the room');
                this.handleDisconnection();
                break;
                
            default:
                console.log('Unknown signaling message:', message);
        }
    }
    
    // Send signaling data
    sendSignal(signal) {
        if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'signal',
                room: this.currentRoom,
                signal: signal
            };
            this.signalingSocket.send(JSON.stringify(message));
        }
    }
    
    // Send data through WebRTC
    async sendData(data) {
        if (!this.isConnected || !this.peer) {
            throw new Error('Not connected');
        }
        
        try {
            const jsonData = JSON.stringify(data);
            this.peer.send(jsonData);
        } catch (error) {
            console.error('Failed to send data:', error);
            throw error;
        }
    }
    
    // Start health check
    startHealthCheck() {
        this.healthCheckInterval = setInterval(() => {
            if (this.isConnected && this.peer) {
                // Update connection stats
                this.updateConnectionStats();
                
                // Send ping if needed
                this.sendPing();
            }
        }, 30000); // Check every 30 seconds
    }
    
    // Update connection statistics
    updateConnectionStats() {
        if (this.peer && this.peer._pc) {
            this.peer._pc.getStats().then(stats => {
                stats.forEach(report => {
                    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        this.stats.roundTripTime = report.currentRoundTripTime * 1000; // Convert to ms
                    } else if (report.type === 'transport') {
                        this.stats.packetsLost = report.packetsLost || 0;
                    }
                });
            }).catch(error => {
                console.warn('Failed to get connection stats:', error);
            });
        }
    }
    
    // Send ping for connection health check
    sendPing() {
        try {
            this.sendData({
                type: 'ping',
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('Failed to send ping:', error);
        }
    }
    
    // Handle disconnection
    handleDisconnection() {
        this.isConnected = false;
        this.isConnecting = false;
        this.connectionState = 'disconnected';
        this.stats.dataChannelState = 'closed';
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        this.emit('disconnected');
    }
    
    // Handle connection timeout
    handleConnectionTimeout() {
        console.error('⏰ Connection timeout');
        this.handleDisconnection();
        this.emit('error', new Error('Connection timeout'));
    }
    
    // Determine if we should attempt reconnection
    shouldAttemptReconnect(error) {
        // Don't reconnect for certain error types
        const nonRecoverableErrors = ['ERR_CONNECTION_REFUSED', 'ERR_NETWORK'];
        return !nonRecoverableErrors.includes(error.code) && 
               this.reconnectAttempts < this.maxReconnectAttempts;
    }
    
    // Schedule reconnection attempt
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            this.emit('error', new Error('Max reconnection attempts reached'));
            return;
        }
        
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        
        console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.isConnected && this.currentRoom) {
                this.connect(this.currentRoom, false).catch(error => {
                    console.error('Reconnection failed:', error);
                    this.scheduleReconnect();
                });
            }
        }, delay);
    }
    
    // Disconnect
    async disconnect() {
        console.log('🔌 Disconnecting...');
        
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        if (this.signalingSocket) {
            this.signalingSocket.close();
            this.signalingSocket = null;
        }
        
        this.handleDisconnection();
    }
    
    // Get connection statistics
    getStats() {
        return { ...this.stats };
    }
    
    // Get connection state
    getState() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            connectionState: this.connectionState,
            currentRoom: this.currentRoom,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}