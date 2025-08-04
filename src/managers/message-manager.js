// CipherWave Message Manager - Optimized for code splitting
// Handles secure message encryption/decryption and delivery

export class MessageManager {
    constructor(securityManager) {
        this.securityManager = securityManager;
        this.eventHandlers = new Map();
        this.messageQueue = [];
        this.pendingMessages = new Map();
        this.messageCounter = 0;
        
        // Message delivery tracking
        this.deliveryTimeout = 30000; // 30 seconds
        this.retryAttempts = 3;
        
        // Performance metrics
        this.metrics = {
            messagesSent: 0,
            messagesReceived: 0,
            averageEncryptionTime: 0,
            averageDecryptionTime: 0
        };
        
        console.log('💬 Message manager initialized');
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
    
    // Encrypt a message for sending
    async encryptMessage(plaintext, options = {}) {
        if (!this.securityManager.isInitialized) {
            throw new Error('Security manager not initialized');
        }
        
        const startTime = performance.now();
        
        try {
            // Create message metadata
            const messageId = this.generateMessageId();
            const timestamp = Date.now();
            
            // Prepare message payload
            const messagePayload = {
                id: messageId,
                text: plaintext,
                timestamp: timestamp,
                type: options.type || 'text',
                metadata: options.metadata || {}
            };
            
            // Encrypt the message
            const encryptedPayload = await this.securityManager.encryptMessage(
                JSON.stringify(messagePayload)
            );
            
            // Create final message structure
            const encryptedMessage = {
                id: messageId,
                type: 'encrypted_message',
                payload: encryptedPayload,
                timestamp: timestamp,
                requiresAck: options.requiresAck !== false // Default to true
            };
            
            // Track encryption time
            const encryptionTime = performance.now() - startTime;
            this.updateEncryptionMetrics(encryptionTime);
            
            // Store for delivery tracking if acknowledgment required
            if (encryptedMessage.requiresAck) {
                this.trackMessageDelivery(messageId, encryptedMessage);
            }
            
            this.metrics.messagesSent++;
            
            console.log(`🔒 Message encrypted (${encryptionTime.toFixed(2)}ms)`);
            return encryptedMessage;
            
        } catch (error) {
            console.error('Message encryption failed:', error);
            throw new Error(`Failed to encrypt message: ${error.message}`);
        }
    }
    
    // Decrypt a received message
    async decryptMessage(encryptedMessage) {
        if (!this.securityManager.isInitialized) {
            throw new Error('Security manager not initialized');
        }
        
        const startTime = performance.now();
        
        try {
            // Handle different message types
            if (encryptedMessage.type === 'encrypted_message') {
                // Decrypt the payload
                const decryptedPayload = await this.securityManager.decryptMessage(
                    encryptedMessage.payload
                );
                
                // Parse the message content
                const messageContent = JSON.parse(decryptedPayload.text);
                
                // Send acknowledgment if required
                if (encryptedMessage.requiresAck) {
                    this.sendAcknowledgment(encryptedMessage.id);
                }
                
                // Track decryption time
                const decryptionTime = performance.now() - startTime;
                this.updateDecryptionMetrics(decryptionTime);
                
                this.metrics.messagesReceived++;
                
                // Emit decrypted message event
                const decryptedMessage = {
                    id: messageContent.id,
                    text: messageContent.text,
                    timestamp: messageContent.timestamp,
                    type: messageContent.type,
                    metadata: messageContent.metadata || {},
                    decrypted: true,
                    decryptionTime: decryptionTime
                };
                
                this.emit('messageDecrypted', decryptedMessage);
                
                console.log(`🔓 Message decrypted (${decryptionTime.toFixed(2)}ms)`);
                return decryptedMessage;
                
            } else if (encryptedMessage.type === 'acknowledgment') {
                // Handle message acknowledgment
                this.handleAcknowledgment(encryptedMessage.messageId);
                return null;
                
            } else if (encryptedMessage.type === 'ping') {
                // Handle ping message
                this.handlePing(encryptedMessage);
                return null;
                
            } else {
                console.warn('Unknown message type:', encryptedMessage.type);
                return null;
            }
            
        } catch (error) {
            console.error('Message decryption failed:', error);
            
            // Send error acknowledgment
            if (encryptedMessage.requiresAck) {
                this.sendErrorAcknowledgment(encryptedMessage.id, error.message);
            }
            
            throw new Error(`Failed to decrypt message: ${error.message}`);
        }
    }
    
    // Generate unique message ID
    generateMessageId() {
        this.messageCounter++;
        return `msg_${Date.now()}_${this.messageCounter}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Track message delivery for acknowledgment
    trackMessageDelivery(messageId, message) {
        const deliveryInfo = {
            message: message,
            sentAt: Date.now(),
            attempts: 0,
            maxAttempts: this.retryAttempts
        };
        
        this.pendingMessages.set(messageId, deliveryInfo);
        
        // Set delivery timeout
        setTimeout(() => {
            if (this.pendingMessages.has(messageId)) {
                this.handleDeliveryTimeout(messageId);
            }
        }, this.deliveryTimeout);
    }
    
    // Send acknowledgment for received message
    sendAcknowledgment(messageId) {
        const ackMessage = {
            type: 'acknowledgment',
            messageId: messageId,
            timestamp: Date.now(),
            status: 'delivered'
        };
        
        this.emit('sendAcknowledgment', ackMessage);
    }
    
    // Send error acknowledgment
    sendErrorAcknowledgment(messageId, errorMessage) {
        const errorAck = {
            type: 'acknowledgment',
            messageId: messageId,
            timestamp: Date.now(),
            status: 'error',
            error: errorMessage
        };
        
        this.emit('sendAcknowledgment', errorAck);
    }
    
    // Handle received acknowledgment
    handleAcknowledgment(messageId) {
        if (this.pendingMessages.has(messageId)) {
            const deliveryInfo = this.pendingMessages.get(messageId);
            this.pendingMessages.delete(messageId);
            
            console.log(`✅ Message ${messageId} delivered`);
            this.emit('messageDelivered', {
                messageId: messageId,
                deliveryTime: Date.now() - deliveryInfo.sentAt
            });
        }
    }
    
    // Handle delivery timeout
    handleDeliveryTimeout(messageId) {
        const deliveryInfo = this.pendingMessages.get(messageId);
        
        if (deliveryInfo) {
            deliveryInfo.attempts++;
            
            if (deliveryInfo.attempts < deliveryInfo.maxAttempts) {
                console.log(`🔄 Retrying message ${messageId} (attempt ${deliveryInfo.attempts})`);
                this.emit('retryMessage', deliveryInfo.message);
                
                // Reset timeout for next attempt
                setTimeout(() => {
                    if (this.pendingMessages.has(messageId)) {
                        this.handleDeliveryTimeout(messageId);
                    }
                }, this.deliveryTimeout);
                
            } else {
                console.error(`❌ Message ${messageId} delivery failed after ${deliveryInfo.attempts} attempts`);
                this.pendingMessages.delete(messageId);
                
                this.emit('messageDeliveryFailed', {
                    messageId: messageId,
                    attempts: deliveryInfo.attempts,
                    message: deliveryInfo.message
                });
            }
        }
    }
    
    // Handle ping message
    handlePing(pingMessage) {
        // Respond with pong
        const pongMessage = {
            type: 'pong',
            originalTimestamp: pingMessage.timestamp,
            timestamp: Date.now()
        };
        
        this.emit('sendPong', pongMessage);
    }
    
    // Update encryption metrics
    updateEncryptionMetrics(encryptionTime) {
        if (this.metrics.messagesSent === 0) {
            this.metrics.averageEncryptionTime = encryptionTime;
        } else {
            this.metrics.averageEncryptionTime = 
                (this.metrics.averageEncryptionTime * (this.metrics.messagesSent - 1) + encryptionTime) / 
                this.metrics.messagesSent;
        }
    }
    
    // Update decryption metrics
    updateDecryptionMetrics(decryptionTime) {
        if (this.metrics.messagesReceived === 0) {
            this.metrics.averageDecryptionTime = decryptionTime;
        } else {
            this.metrics.averageDecryptionTime = 
                (this.metrics.averageDecryptionTime * (this.metrics.messagesReceived - 1) + decryptionTime) / 
                this.metrics.messagesReceived;
        }
    }
    
    // Get pending messages count
    getPendingMessagesCount() {
        return this.pendingMessages.size;
    }
    
    // Get message statistics
    getMetrics() {
        return {
            ...this.metrics,
            pendingMessages: this.getPendingMessagesCount()
        };
    }
    
    // Clear all pending messages
    clearPendingMessages() {
        this.pendingMessages.clear();
        console.log('🗑️ Cleared all pending messages');
    }
    
    // Destroy message manager
    destroy() {
        this.clearPendingMessages();
        this.messageQueue = [];
        this.eventHandlers.clear();
        this.messageCounter = 0;
        console.log('🗑️ Message manager destroyed');
    }
}