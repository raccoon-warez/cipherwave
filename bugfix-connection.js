// CipherWave Connection Bug Fixes
// This script addresses common connection issues in the CipherWave application

// 1. Enhanced signaling server connection with retry mechanism
class EnhancedSignaling {
    constructor(maxRetries = 3, retryDelay = 2000) {
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
        this.connectionAttempts = 0;
    }
    
    async connectWithRetry(serverUrl, roomId) {
        while (this.connectionAttempts < this.maxRetries) {
            try {
                console.log(`Connection attempt ${this.connectionAttempts + 1}/${this.maxRetries}`);
                return await this.connect(serverUrl, roomId);
            } catch (error) {
                this.connectionAttempts++;
                console.warn(`Connection attempt ${this.connectionAttempts} failed:`, error.message);
                
                if (this.connectionAttempts < this.maxRetries) {
                    console.log(`Retrying in ${this.retryDelay}ms...`);
                    await this.delay(this.retryDelay);
                } else {
                    throw new Error(`Failed to connect after ${this.maxRetries} attempts`);
                }
            }
        }
    }
    
    connect(serverUrl, roomId) {
        return new Promise((resolve, reject) => {
            try {
                const socket = new WebSocket(serverUrl);
                
                const timeout = setTimeout(() => {
                    socket.close();
                    reject(new Error('Connection timeout'));
                }, 10000); // 10 second timeout
                
                socket.onopen = () => {
                    clearTimeout(timeout);
                    socket.send(JSON.stringify({ type: 'join', room: roomId }));
                    resolve(socket);
                };
                
                socket.onerror = (err) => {
                    clearTimeout(timeout);
                    reject(new Error(`WebSocket error: ${err.message}`));
                };
                
                socket.onclose = () => {
                    clearTimeout(timeout);
                    reject(new Error('Connection closed unexpectedly'));
                };
            } catch (error) {
                reject(new Error(`Failed to create WebSocket: ${error.message}`));
            }
        });
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 2. ICE candidate gathering timeout handling
function handleIceGatheringTimeout(peerConnection, timeout = 15000) {
    return new Promise((resolve, reject) => {
        let iceGatheringCompleted = false;
        
        const timeoutId = setTimeout(() => {
            if (!iceGatheringCompleted) {
                console.warn('ICE gathering timeout, forcing completion');
                iceGatheringCompleted = true;
                // Force completion by creating a null candidate
                if (peerConnection.onicecandidate) {
                    peerConnection.onicecandidate({ candidate: null });
                }
                resolve();
            }
        }, timeout);
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE candidate gathered:', event.candidate.type);
                // Forward to original handler if it exists
                if (window.originalOnIceCandidate) {
                    window.originalOnIceCandidate(event);
                }
            } else {
                // Gathering complete
                if (!iceGatheringCompleted) {
                    clearTimeout(timeoutId);
                    iceGatheringCompleted = true;
                    console.log('ICE candidate gathering complete');
                    resolve();
                }
            }
        };
        
        peerConnection.onicecandidateerror = (event) => {
            console.error('ICE candidate error:', event);
            // Forward to original handler if it exists
            if (window.originalOnIceCandidateError) {
                window.originalOnIceCandidateError(event);
            }
        };
    });
}

// 3. Connection health monitoring
class ConnectionHealthMonitor {
    constructor(checkInterval = 5000) {
        this.checkInterval = checkInterval;
        this.healthChecks = [];
        this.monitoring = false;
    }
    
    startMonitoring(peerConnection, dataChannel) {
        this.monitoring = true;
        this.peerConnection = peerConnection;
        this.dataChannel = dataChannel;
        
        this.monitorInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.checkInterval);
    }
    
    stopMonitoring() {
        this.monitoring = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
    }
    
    performHealthCheck() {
        if (!this.peerConnection || !this.dataChannel) return;
        
        const healthStatus = {
            timestamp: Date.now(),
            peerConnectionState: this.peerConnection.connectionState,
            iceConnectionState: this.peerConnection.iceConnectionState,
            signalingState: this.peerConnection.signalingState,
            dataChannelState: this.dataChannel.readyState,
            isHealthy: true,
            issues: []
        };
        
        // Check peer connection state
        if (this.peerConnection.connectionState === 'failed' || 
            this.peerConnection.connectionState === 'closed') {
            healthStatus.isHealthy = false;
            healthStatus.issues.push(`Peer connection state: ${this.peerConnection.connectionState}`);
        }
        
        // Check ICE connection state
        if (this.peerConnection.iceConnectionState === 'failed' || 
            this.peerConnection.iceConnectionState === 'disconnected') {
            healthStatus.isHealthy = false;
            healthStatus.issues.push(`ICE connection state: ${this.peerConnection.iceConnectionState}`);
        }
        
        // Check data channel state
        if (this.dataChannel.readyState === 'closed') {
            healthStatus.isHealthy = false;
            healthStatus.issues.push(`Data channel state: ${this.dataChannel.readyState}`);
        }
        
        // Store health check
        this.healthChecks.push(healthStatus);
        
        // Keep only the last 100 health checks
        if (this.healthChecks.length > 100) {
            this.healthChecks.shift();
        }
        
        // Log issues if any
        if (!healthStatus.isHealthy) {
            console.warn('Connection health issue detected:', healthStatus.issues);
            // Trigger recovery mechanism
            this.attemptRecovery();
        }
    }
    
    attemptRecovery() {
        console.log('Attempting connection recovery...');
        
        // Try to restart ICE
        if (this.peerConnection && 
            (this.peerConnection.connectionState !== 'connected' && 
             this.peerConnection.connectionState !== 'completed')) {
            console.log('Restarting ICE...');
            try {
                this.peerConnection.restartIce();
            } catch (error) {
                console.error('Failed to restart ICE:', error);
            }
        }
    }
    
    getHealthReport() {
        if (this.healthChecks.length === 0) {
            return 'No health checks performed yet';
        }
        
        const latest = this.healthChecks[this.healthChecks.length - 1];
        const healthyChecks = this.healthChecks.filter(check => check.isHealthy).length;
        const healthPercentage = (healthyChecks / this.healthChecks.length) * 100;
        
        return {
            totalChecks: this.healthChecks.length,
            healthyChecks: healthyChecks,
            healthPercentage: healthPercentage.toFixed(2),
            latestStatus: latest
        };
    }
}

// 4. Network connectivity detection
class NetworkDetector {
    constructor() {
        this.isOnline = navigator.onLine;
        this.listeners = [];
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Network connection restored');
            this.notifyListeners('online');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Network connection lost');
            this.notifyListeners('offline');
        });
    }
    
    addListener(callback) {
        this.listeners.push(callback);
    }
    
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    
    notifyListeners(status) {
        this.listeners.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('Error in network status listener:', error);
            }
        });
    }
    
    checkConnectivity() {
        return new Promise((resolve) => {
            if (!this.isOnline) {
                resolve(false);
                return;
            }
            
            // Try to fetch a small resource to verify connectivity
            fetch('https://httpbin.org/get', { method: 'HEAD', mode: 'no-cors' })
                .then(() => resolve(true))
                .catch(() => resolve(false));
        });
    }
}

// 5. Fallback signaling servers
const FALLBACK_SERVERS = [
    'wss://echo.websocket.org', // Public WebSocket echo server
    'ws://localhost:52178',
    'ws://localhost:8081',
    'ws://localhost:8082'
];

async function findWorkingServer(roomId) {
    console.log('Searching for available signaling servers...');
    
    for (const server of FALLBACK_SERVERS) {
        try {
            console.log(`Testing server: ${server}`);
            const signaling = new EnhancedSignaling(1, 1000); // Quick test
            const socket = await signaling.connectWithRetry(server, roomId);
            socket.close(); // Close test connection
            console.log(`Found working server: ${server}`);
            return server;
        } catch (error) {
            console.log(`Server ${server} not available: ${error.message}`);
            continue;
        }
    }
    
    throw new Error('No available signaling servers found');
}

// 6. Initialize bug fixes when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize network detector
    window.networkDetector = new NetworkDetector();
    
    // Initialize connection health monitor
    window.connectionHealthMonitor = new ConnectionHealthMonitor();
    
    console.log('CipherWave bug fixes initialized');
});

// 7. Export classes for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EnhancedSignaling,
        ConnectionHealthMonitor,
        NetworkDetector,
        handleIceGatheringTimeout,
        findWorkingServer
    };
}
