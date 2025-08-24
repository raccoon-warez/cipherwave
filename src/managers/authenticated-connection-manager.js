// CipherWave Authenticated Connection Manager
// Extends ConnectionManager with identity verification and secure messaging

import { ConnectionManager } from './connection-manager.js';

export class AuthenticatedConnectionManager extends ConnectionManager {
    constructor(identityManager, storageManager, configuration = {}) {
        super(configuration);
        
        this.identityManager = identityManager;
        this.storageManager = storageManager;
        this.peerIdentity = null;
        this.isAuthenticated = false;
        this.authenticationTimeout = 10000; // 10 seconds
        
        // Enhanced connection state
        this.connectionPhase = 'disconnected'; // disconnected, signaling, authenticating, connected
        
        console.log('🔐 Authenticated connection manager initialized');
    }

    // Enhanced connect with authentication
    async connect(roomId, isInitiator = false) {
        if (!this.identityManager.isLoggedIn) {
            throw new Error('User must be logged in to connect');
        }

        console.log(`🔐 Starting authenticated connection to room: ${roomId}`);
        this.connectionPhase = 'signaling';

        try {
            // Connect using parent class
            await super.connect(roomId, isInitiator);
            
            // Override data handler for authentication
            this.peer.removeAllListeners('data');
            this.peer.on('data', (data) => {
                this.handleAuthenticatedData(data);
            });

            // Start authentication process
            this.connectionPhase = 'authenticating';
            await this.performAuthentication();
            
        } catch (error) {
            this.connectionPhase = 'disconnected';
            throw error;
        }
    }

    // Perform peer authentication after WebRTC connection
    async performAuthentication() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, this.authenticationTimeout);

            const cleanup = () => {
                clearTimeout(timeout);
                this.off('auth:success', onAuthSuccess);
                this.off('auth:failed', onAuthFailed);
            };

            const onAuthSuccess = () => {
                cleanup();
                this.isAuthenticated = true;
                this.connectionPhase = 'connected';
                console.log('✅ Peer authentication successful');
                resolve();
            };

            const onAuthFailed = (error) => {
                cleanup();
                reject(new Error(`Authentication failed: ${error}`));
            };

            this.on('auth:success', onAuthSuccess);
            this.on('auth:failed', onAuthFailed);

            // Send our authentication challenge
            this.sendAuthChallenge();
        });
    }

    // Send authentication challenge
    async sendAuthChallenge() {
        try {
            // Get our key exchange data with identity proof
            const keyExchangeData = await this.identityManager.performAuthenticatedKeyExchange();
            
            const authMessage = {
                type: 'auth:challenge',
                identityPublicKey: keyExchangeData.identityPublicKey,
                ephemeralPublicKey: keyExchangeData.ephemeralPublicKey,
                challenge: keyExchangeData.challenge,
                challengeSignature: keyExchangeData.challengeSignature,
                displayName: keyExchangeData.displayName,
                deviceId: this.identityManager.deviceId,
                timestamp: Date.now()
            };

            await super.sendData(authMessage);
            console.log('📤 Sent authentication challenge');

        } catch (error) {
            console.error('Failed to send auth challenge:', error);
            this.emit('auth:failed', error.message);
        }
    }

    // Handle authentication response
    async handleAuthChallenge(message) {
        try {
            // Verify peer's identity
            const verificationResult = await this.identityManager.verifyPeerIdentity(message);
            
            if (!verificationResult.verified) {
                throw new Error(verificationResult.error || 'Identity verification failed');
            }

            // Store peer identity information
            this.peerIdentity = {
                publicKey: message.identityPublicKey,
                displayName: message.displayName || 'Unknown',
                deviceId: message.deviceId,
                trustLevel: verificationResult.trustLevel,
                verified: true
            };

            // Complete key exchange with peer's ephemeral key
            await this.identityManager.performKeyExchange(message.ephemeralPublicKey);

            // Send our authentication response
            const responseData = await this.identityManager.performAuthenticatedKeyExchange();
            
            const authResponse = {
                type: 'auth:response',
                identityPublicKey: responseData.identityPublicKey,
                ephemeralPublicKey: responseData.ephemeralPublicKey,
                challenge: responseData.challenge,
                challengeSignature: responseData.challengeSignature,
                displayName: responseData.displayName,
                deviceId: this.identityManager.deviceId,
                timestamp: Date.now()
            };

            await super.sendData(authResponse);

            // Add to trusted contacts if not already present
            if (!this.identityManager.trustedContacts.has(this.peerIdentity.publicKey)) {
                this.identityManager.addTrustedContact(
                    this.peerIdentity.publicKey,
                    this.peerIdentity.displayName,
                    10 // Initial trust level
                );
            }

            this.emit('auth:success');
            console.log('✅ Authentication successful with peer:', this.peerIdentity.displayName);

        } catch (error) {
            console.error('Authentication challenge handling failed:', error);
            this.emit('auth:failed', error.message);
        }
    }

    // Handle authentication response from peer
    async handleAuthResponse(message) {
        try {
            // Verify peer's identity
            const verificationResult = await this.identityManager.verifyPeerIdentity(message);
            
            if (!verificationResult.verified) {
                throw new Error(verificationResult.error || 'Identity verification failed');
            }

            // Store peer identity
            this.peerIdentity = {
                publicKey: message.identityPublicKey,
                displayName: message.displayName || 'Unknown',
                deviceId: message.deviceId,
                trustLevel: verificationResult.trustLevel,
                verified: true
            };

            // Complete key exchange with peer's ephemeral key
            await this.identityManager.performKeyExchange(message.ephemeralPublicKey);

            // Add to trusted contacts
            if (!this.identityManager.trustedContacts.has(this.peerIdentity.publicKey)) {
                this.identityManager.addTrustedContact(
                    this.peerIdentity.publicKey,
                    this.peerIdentity.displayName,
                    10
                );
            }

            this.emit('auth:success');
            console.log('✅ Authentication response verified for:', this.peerIdentity.displayName);

        } catch (error) {
            console.error('Authentication response handling failed:', error);
            this.emit('auth:failed', error.message);
        }
    }

    // Handle authenticated data messages
    async handleAuthenticatedData(data) {
        try {
            const message = JSON.parse(data.toString());
            
            // Handle authentication messages
            if (message.type === 'auth:challenge') {
                await this.handleAuthChallenge(message);
                return;
            }
            
            if (message.type === 'auth:response') {
                await this.handleAuthResponse(message);
                return;
            }

            // Handle regular messages only if authenticated
            if (!this.isAuthenticated) {
                console.warn('Received message before authentication completed');
                return;
            }

            // Handle ping/pong
            if (message.type === 'ping') {
                await this.sendData({ type: 'pong', timestamp: Date.now() });
                return;
            }

            if (message.type === 'pong') {
                // Update round trip time
                const rtt = Date.now() - message.timestamp;
                this.stats.roundTripTime = rtt;
                return;
            }

            // Handle encrypted messages
            if (message.type === 'encrypted_message') {
                await this.handleEncryptedMessage(message);
                return;
            }

            // Emit for other message types
            this.emit('dataReceived', message);

        } catch (error) {
            console.error('Failed to handle authenticated data:', error);
        }
    }

    // Handle encrypted message
    async handleEncryptedMessage(message) {
        try {
            // Decrypt the message
            const decryptedMessage = await this.identityManager.decryptMessage(message.encryptedData);
            
            // Verify message signature if present
            if (message.signature && this.peerIdentity) {
                const isValid = this.identityManager.verifySignature(
                    decryptedMessage.text,
                    message.signature,
                    this.peerIdentity.publicKey
                );
                
                if (!isValid) {
                    console.error('❌ Message signature verification failed');
                    return;
                }
            }

            // Store message if storage is available
            if (this.storageManager) {
                await this.storageManager.storeMessage({
                    roomId: this.currentRoom,
                    senderId: this.peerIdentity?.publicKey,
                    content: decryptedMessage.text,
                    signature: message.signature,
                    type: 'text',
                    delivered: true
                });
            }

            // Update trust level for successful interaction
            if (this.peerIdentity) {
                this.identityManager.updateTrustLevel(this.peerIdentity.publicKey, 1);
            }

            // Emit the decrypted message
            this.emit('messageReceived', {
                content: decryptedMessage.text,
                sender: this.peerIdentity?.displayName || 'Unknown',
                senderId: this.peerIdentity?.publicKey,
                timestamp: message.timestamp || Date.now(),
                verified: !!message.signature
            });

        } catch (error) {
            console.error('Failed to handle encrypted message:', error);
            this.emit('messageError', error);
        }
    }

    // Send encrypted message with signature
    async sendEncryptedMessage(plaintext) {
        if (!this.isAuthenticated) {
            throw new Error('Connection not authenticated');
        }

        try {
            // Encrypt the message
            const encryptedData = await this.identityManager.encryptMessage(plaintext);
            
            // Sign the message
            const signature = this.identityManager.signWithIdentity(plaintext);
            
            const message = {
                type: 'encrypted_message',
                encryptedData,
                signature: Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join(''),
                senderId: this.identityManager.userIdentity.profileData.publicKey,
                timestamp: Date.now()
            };

            await super.sendData(message);

            // Store our own message if storage is available
            if (this.storageManager) {
                await this.storageManager.storeMessage({
                    roomId: this.currentRoom,
                    senderId: this.identityManager.userIdentity.profileData.publicKey,
                    recipientId: this.peerIdentity?.publicKey,
                    content: plaintext,
                    signature: message.signature,
                    type: 'text',
                    delivered: true
                });
            }

            console.log('📤 Sent encrypted message');

        } catch (error) {
            console.error('Failed to send encrypted message:', error);
            throw error;
        }
    }

    // Queue message for offline delivery
    async queueMessageForDelivery(plaintext, priority = 'normal') {
        if (!this.storageManager) {
            throw new Error('Storage manager not available');
        }

        try {
            const messageData = {
                content: plaintext,
                roomId: this.currentRoom,
                recipientId: this.peerIdentity?.publicKey,
                type: 'text'
            };

            const queueId = await this.storageManager.queueMessage(
                messageData,
                this.peerIdentity?.publicKey,
                priority
            );

            console.log(`📥 Message queued for delivery: ${queueId}`);
            return queueId;

        } catch (error) {
            console.error('Failed to queue message:', error);
            throw error;
        }
    }

    // Get conversation history
    async getConversationHistory(limit = 50, offset = 0) {
        if (!this.storageManager) {
            return [];
        }

        try {
            const messages = await this.storageManager.getMessages(this.currentRoom, limit, offset);
            return messages.map(msg => ({
                content: msg.content,
                sender: msg.senderId === this.identityManager.userIdentity.profileData.publicKey 
                    ? 'You' 
                    : this.peerIdentity?.displayName || 'Unknown',
                senderId: msg.senderId,
                timestamp: msg.timestamp,
                verified: !!msg.signature,
                messageId: msg.messageId
            }));
        } catch (error) {
            console.error('Failed to get conversation history:', error);
            return [];
        }
    }

    // Get peer information
    getPeerInfo() {
        return this.peerIdentity;
    }

    // Enhanced connection state
    getState() {
        const baseState = super.getState();
        return {
            ...baseState,
            connectionPhase: this.connectionPhase,
            isAuthenticated: this.isAuthenticated,
            peerIdentity: this.peerIdentity
        };
    }

    // Override disconnect to handle authentication cleanup
    async disconnect() {
        console.log('🔐 Disconnecting authenticated connection...');
        
        this.isAuthenticated = false;
        this.peerIdentity = null;
        this.connectionPhase = 'disconnected';
        
        await super.disconnect();
    }

    // Override handleDisconnection
    handleDisconnection() {
        this.isAuthenticated = false;
        this.connectionPhase = 'disconnected';
        
        // Process any pending messages in queue
        if (this.storageManager) {
            this.storageManager.processMessageQueue(false); // Mark as offline
        }
        
        super.handleDisconnection();
    }

    // Handle reconnection with re-authentication
    async handleReconnection() {
        console.log('🔄 Handling authenticated reconnection...');
        
        this.isAuthenticated = false;
        this.peerIdentity = null;
        this.connectionPhase = 'signaling';
        
        // Let parent handle base reconnection
        await super.scheduleReconnect();
    }

    // Process offline message queue when connection is restored
    async processOfflineMessages() {
        if (this.storageManager && this.isAuthenticated) {
            await this.storageManager.processMessageQueue(true);
        }
    }

    // Override sendData to ensure authentication
    async sendData(data) {
        if (data.type && data.type.startsWith('auth:')) {
            // Allow authentication messages
            return await super.sendData(data);
        }

        if (!this.isAuthenticated) {
            throw new Error('Connection not authenticated - cannot send data');
        }

        return await super.sendData(data);
    }
}