// CipherWave Connection Manager
// Handles WebRTC connection lifecycle with enhanced error handling and reconnection

class ConnectionManager {
    constructor(configuration, signaling) {
        this.configuration = configuration;
        this.signaling = signaling;
        this.peerConnection = null;
        this.dataChannel = null;
        this.isConnected = false;
        this.isInitiator = false;
        this.connectionState = 'new';
        this.iceConnectionState = 'new';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.connectionTimeout = null;
        this.iceTimeout = null;
        this.healthCheckInterval = null;
        this.eventHandlers = new Map();
        
        // Connection quality tracking
        this.connectionStats = {
            packetsLost: 0,
            roundTripTime: 0,
            jitter: 0,
            bandwidth: 0
        };
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // Define default event handlers
        this.eventHandlers.set('connected', () => {
            console.log('Connection established');
        });
        
        this.eventHandlers.set('disconnected', () => {
            console.log('Connection lost');
        });
        
        this.eventHandlers.set('error', (error) => {
            console.error('Connection error:', error);
        });
        
        this.eventHandlers.set('dataReceived', (data) => {
            console.log('Data received:', data);
        });
    }
    
    // Add event listener
    addEventListener(event, handler) {
        this.eventHandlers.set(event, handler);
    }
    
    // Emit event
    emit(event, data = null) {
        const handler = this.eventHandlers.get(event);
        if (handler) {
            try {
                handler(data);
            } catch (error) {
                console.error(`Error in ${event} handler:`, error);
            }
        }
    }
    
    // Create WebRTC peer connection with enhanced error handling
    async createConnection(isInitiator = false) {
        try {
            this.isInitiator = isInitiator;
            this.peerConnection = new RTCPeerConnection(this.configuration);
            
            this.setupConnectionEventHandlers();
            this.setupConnectionTimeout();
            
            if (isInitiator) {
                await this.createDataChannel();
                await this.createOffer();
            } else {
                this.setupDataChannelHandler();
            }
            
            this.startHealthCheck();
            return true;
            
        } catch (error) {
            console.error('Failed to create connection:', error);
            this.emit('error', error);
            return false;
        }
    }
    
    setupConnectionEventHandlers() {
        // Connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            this.connectionState = this.peerConnection.connectionState;
            console.log('Connection state:', this.connectionState);
            
            switch (this.connectionState) {
                case 'connected':
                    this.handleConnectionEstablished();
                    break;
                case 'disconnected':
                    this.handleConnectionDisconnected();
                    break;
                case 'failed':
                    this.handleConnectionFailed();
                    break;
                case 'closed':
                    this.handleConnectionClosed();
                    break;
            }
        };
        
        // ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            this.iceConnectionState = this.peerConnection.iceConnectionState;
            console.log('ICE connection state:', this.iceConnectionState);
            
            switch (this.iceConnectionState) {
                case 'connected':
                case 'completed':
                    this.clearConnectionTimeout();
                    break;
                case 'disconnected':
                    this.scheduleReconnection();
                    break;
                case 'failed':
                    this.handleICEFailure();
                    break;
            }
        };
        
        // ICE candidate handling
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.signaling.send({
                    type: 'candidate',
                    candidate: event.candidate
                });
            } else {
                console.log('ICE candidate gathering complete');
            }
        };
        
        // ICE candidate errors
        this.peerConnection.onicecandidateerror = (event) => {
            console.error('ICE candidate error:', event);
            this.handleICECandidateError(event);
        };
        
        // Signaling state changes
        this.peerConnection.onsignalingstatechange = () => {
            console.log('Signaling state:', this.peerConnection.signalingState);
        };
        
        // ICE gathering state changes
        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
            this.handleICEGatheringStateChange();
        };
    }
    
    setupConnectionTimeout() {
        this.connectionTimeout = setTimeout(() => {
            if (this.connectionState !== 'connected') {
                console.warn('Connection timeout - attempting recovery');
                this.handleConnectionTimeout();
            }
        }, 30000); // 30 second timeout
    }
    
    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }
    
    async createDataChannel() {
        try {
            this.dataChannel = this.peerConnection.createDataChannel('messaging', {
                ordered: true,
                maxRetransmits: 3,
                maxPacketLifeTime: null
            });
            
            this.setupDataChannelHandlers(this.dataChannel);
            return true;
        } catch (error) {
            console.error('Failed to create data channel:', error);
            return false;
        }
    }
    
    setupDataChannelHandler() {
        this.peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannelHandlers(this.dataChannel);
        };
    }
    
    setupDataChannelHandlers(channel) {
        channel.onopen = () => {
            this.isConnected = true;
            console.log('Data channel opened');
            this.emit('connected');
        };
        
        channel.onclose = () => {
            this.isConnected = false;
            console.log('Data channel closed');
            this.emit('disconnected');
        };
        
        channel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.emit('error', error);
            this.handleDataChannelError(error);
        };
        
        channel.onmessage = (event) => {
            this.emit('dataReceived', event.data);
        };
        
        // Monitor buffer levels
        channel.onbufferedamountlow = () => {
            console.log('Data channel buffer low');
        };
    }
    
    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            this.signaling.send({
                type: 'offer',
                offer: offer
            });
            
            return true;
        } catch (error) {
            console.error('Failed to create offer:', error);
            this.emit('error', error);
            return false;
        }
    }
    
    async handleOffer(offer) {
        try {
            await this.peerConnection.setRemoteDescription(offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.signaling.send({
                type: 'answer',
                answer: answer
            });
            
            return true;
        } catch (error) {
            console.error('Failed to handle offer:', error);
            this.emit('error', error);
            return false;
        }
    }
    
    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(answer);
            return true;
        } catch (error) {
            console.error('Failed to handle answer:', error);
            this.emit('error', error);
            return false;
        }
    }
    
    async handleICECandidate(candidate) {
        try {
            await this.peerConnection.addIceCandidate(candidate);
            return true;
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
            // Don't emit error for ICE candidate failures as they're often recoverable\n            return false;
        }
    }
    
    // Send data through the connection\n    sendData(data) {
        if (this.isConnected && this.dataChannel && this.dataChannel.readyState === 'open') {
            try {
                // Check buffer before sending
                if (this.dataChannel.bufferedAmount > 16 * 1024 * 1024) { // 16MB buffer limit
                    console.warn('Data channel buffer full, dropping message');
                    return false;
                }
                
                this.dataChannel.send(data);
                return true;
            } catch (error) {
                console.error('Failed to send data:', error);
                this.emit('error', error);
                return false;
            }
        }
        return false;
    }
    
    // Connection event handlers\n    handleConnectionEstablished() {
        this.clearConnectionTimeout();
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // Reset delay
        console.log('WebRTC connection established');
    }
    
    handleConnectionDisconnected() {
        console.log('WebRTC connection disconnected');
        this.scheduleReconnection();
    }
    
    handleConnectionFailed() {
        console.error('WebRTC connection failed');
        this.emit('error', new Error('Connection failed'));
        this.scheduleReconnection();
    }
    
    handleConnectionClosed() {
        console.log('WebRTC connection closed');
        this.cleanup();
    }
    
    handleConnectionTimeout() {
        console.warn('Connection establishment timeout');
        if (this.peerConnection) {
            this.restartICE();
        }
    }
    
    handleICEFailure() {
        console.error('ICE connection failed');
        this.restartICE();
    }
    
    handleICECandidateError(event) {
        console.error(`ICE candidate error: ${event.errorCode} - ${event.errorText}`);
        // Continue with available candidates
    }
    
    handleICEGatheringStateChange() {
        if (this.peerConnection.iceGatheringState === 'gathering') {
            // Set ICE gathering timeout
            this.iceTimeout = setTimeout(() => {
                if (this.peerConnection.iceGatheringState === 'gathering') {
                    console.warn('ICE gathering timeout');
                    // Force completion\n                    this.peerConnection.onicecandidate({ candidate: null });
                }
            }, 30000); // 30 second timeout
        } else {
            if (this.iceTimeout) {
                clearTimeout(this.iceTimeout);
                this.iceTimeout = null;
            }
        }
    }
    
    handleDataChannelError(error) {
        console.error('Data channel error, attempting recovery:', error);
        // Attempt to recreate data channel if we're the initiator
        if (this.isInitiator && this.peerConnection.connectionState === 'connected') {
            setTimeout(() => {
                this.createDataChannel();
            }, 1000);
        }
    }
    
    // Restart ICE connection
    restartICE() {
        if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
            try {
                console.log('Restarting ICE connection');
                this.peerConnection.restartIce();
            } catch (error) {
                console.error('Failed to restart ICE:', error);
                this.scheduleReconnection();
            }
        }
    }
    
    // Schedule reconnection with exponential backoff
    scheduleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('error', new Error('Max reconnection attempts reached'));
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
        
        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            this.attemptReconnection();
        }, delay);
    }
    
    async attemptReconnection() {
        console.log(`Attempting reconnection (attempt ${this.reconnectAttempts})`);
        
        try {
            // Close existing connection
            this.cleanup(false);
            
            // Create new connection
            const success = await this.createConnection(this.isInitiator);
            if (!success) {
                this.scheduleReconnection();
            }
        } catch (error) {
            console.error('Reconnection attempt failed:', error);
            this.scheduleReconnection();
        }
    }
    
    // Health check monitoring
    startHealthCheck() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 10000); // Every 10 seconds
    }
    
    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
    
    async performHealthCheck() {
        if (!this.peerConnection) return;
        
        try {
            const stats = await this.peerConnection.getStats();
            this.updateConnectionStats(stats);
            
            // Check connection quality
            if (this.connectionStats.packetsLost > 100 || this.connectionStats.roundTripTime > 1000) {
                console.warn('Poor connection quality detected');
                this.emit('connectionQuality', 'poor');
            }
        } catch (error) {
            console.error('Health check failed:', error);
        }
    }
    
    updateConnectionStats(stats) {
        stats.forEach(report => {
            if (report.type === 'inbound-rtp') {
                this.connectionStats.packetsLost = report.packetsLost || 0;
                this.connectionStats.jitter = report.jitter || 0;
            } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                this.connectionStats.roundTripTime = report.currentRoundTripTime || 0;
                this.connectionStats.bandwidth = report.availableOutgoingBitrate || 0;
            }
        });
    }
    
    // Get connection statistics
    getStats() {
        return {
            connectionState: this.connectionState,
            iceConnectionState: this.iceConnectionState,
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            stats: this.connectionStats
        };
    }
    
    // Close connection
    close() {
        console.log('Closing connection');
        this.cleanup();
    }
    
    // Cleanup resources
    cleanup(emitEvent = true) {
        this.stopHealthCheck();
        this.clearConnectionTimeout();
        
        if (this.iceTimeout) {
            clearTimeout(this.iceTimeout);
            this.iceTimeout = null;
        }
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.isConnected = false;
        this.connectionState = 'closed';
        
        if (emitEvent) {
            this.emit('disconnected');
        }
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConnectionManager;
} else {
    window.ConnectionManager = ConnectionManager;
}