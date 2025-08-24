// CipherWave Storage Manager - Handles encrypted message persistence
// Provides secure local storage with IndexedDB and offline message queuing

import sodium from 'libsodium-wrappers';

export class StorageManager {
    constructor(identityManager) {
        this.identityManager = identityManager;
        this.db = null;
        this.dbName = 'CipherWaveDB';
        this.dbVersion = 1;
        this.storageKey = null;
        this.isInitialized = false;
        
        // Message queue for offline delivery
        this.messageQueue = new Map();
        this.retryIntervals = new Map();
    }

    async initialize() {
        if (!this.identityManager.isLoggedIn) {
            throw new Error('User must be logged in to initialize storage');
        }

        try {
            // Open IndexedDB
            await this.openDatabase();
            
            // Derive storage encryption key from user's identity
            await this.deriveStorageKey();
            
            this.isInitialized = true;
            console.log('💾 Storage manager initialized');
            
            // Load pending message queue
            await this.loadMessageQueue();
            
        } catch (error) {
            console.error('❌ Failed to initialize storage:', error);
            throw new Error(`Storage initialization failed: ${error.message}`);
        }
    }

    // Open or create IndexedDB database
    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(new Error('Failed to open database'));
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('messages')) {
                    const messagesStore = db.createObjectStore('messages', { keyPath: 'messageId' });
                    messagesStore.createIndex('roomId', 'roomId', { unique: false });
                    messagesStore.createIndex('senderId', 'senderId', { unique: false });
                    messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
                    messagesStore.createIndex('recipientId', 'recipientId', { unique: false });
                }

                if (!db.objectStoreNames.contains('conversations')) {
                    const conversationsStore = db.createObjectStore('conversations', { keyPath: 'roomId' });
                    conversationsStore.createIndex('lastActivity', 'lastActivity', { unique: false });
                    conversationsStore.createIndex('participantId', 'participants', { unique: false, multiEntry: true });
                }

                if (!db.objectStoreNames.contains('messageQueue')) {
                    db.createObjectStore('messageQueue', { keyPath: 'queueId' });
                }

                if (!db.objectStoreNames.contains('contacts')) {
                    const contactsStore = db.createObjectStore('contacts', { keyPath: 'publicKey' });
                    contactsStore.createIndex('displayName', 'displayName', { unique: false });
                    contactsStore.createIndex('lastInteraction', 'lastInteraction', { unique: false });
                }
            };
        });
    }

    // Derive storage encryption key from user's identity
    async deriveStorageKey() {
        const userPublicKey = this.identityManager.userIdentity.profileData.publicKey;
        const deviceId = this.identityManager.deviceId;
        
        // Create unique context for key derivation
        const context = `storage:${deviceId}`.substring(0, 8);
        const masterKey = this.identityManager.userIdentity.identityKeyPair.privateKey;
        
        // Derive storage key using HKDF
        this.storageKey = sodium.crypto_kdf_derive_from_key(
            32, // 256-bit key
            1,  // subkey ID for storage
            context,
            masterKey.slice(0, 32) // Use first 32 bytes as master key
        );
    }

    // Store encrypted message
    async storeMessage(messageData) {
        if (!this.isInitialized) {
            throw new Error('Storage not initialized');
        }

        try {
            const messageId = this.generateMessageId();
            const timestamp = Date.now();

            // Create message record
            const messageRecord = {
                messageId,
                roomId: messageData.roomId,
                senderId: messageData.senderId || this.identityManager.userIdentity.profileData.publicKey,
                recipientId: messageData.recipientId,
                encryptedContent: await this.encryptForStorage(messageData.content),
                signature: messageData.signature,
                timestamp,
                messageType: messageData.type || 'text',
                delivered: messageData.delivered || false
            };

            // Store in IndexedDB
            await this.dbTransaction('messages', 'readwrite', (store) => {
                store.add(messageRecord);
            });

            // Update conversation metadata
            await this.updateConversation(messageData.roomId, messageRecord);

            console.log(`💾 Message stored: ${messageId}`);
            return messageId;

        } catch (error) {
            console.error('Failed to store message:', error);
            throw new Error(`Message storage failed: ${error.message}`);
        }
    }

    // Retrieve messages for a conversation
    async getMessages(roomId, limit = 50, offset = 0) {
        if (!this.isInitialized) {
            throw new Error('Storage not initialized');
        }

        try {
            const messages = await this.dbTransaction('messages', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const index = store.index('roomId');
                    const request = index.getAll(roomId);
                    
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });

            // Sort by timestamp and apply pagination
            const sortedMessages = messages
                .sort((a, b) => a.timestamp - b.timestamp)
                .slice(offset, offset + limit);

            // Decrypt messages
            const decryptedMessages = await Promise.all(
                sortedMessages.map(async (msg) => ({
                    ...msg,
                    content: await this.decryptFromStorage(msg.encryptedContent)
                }))
            );

            return decryptedMessages;

        } catch (error) {
            console.error('Failed to retrieve messages:', error);
            throw new Error(`Message retrieval failed: ${error.message}`);
        }
    }

    // Get all conversations
    async getConversations() {
        if (!this.isInitialized) {
            throw new Error('Storage not initialized');
        }

        try {
            const conversations = await this.dbTransaction('conversations', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            });

            // Sort by last activity
            return conversations.sort((a, b) => b.lastActivity - a.lastActivity);

        } catch (error) {
            console.error('Failed to retrieve conversations:', error);
            throw new Error(`Conversation retrieval failed: ${error.message}`);
        }
    }

    // Queue message for offline delivery
    async queueMessage(messageData, recipientPublicKey, priority = 'normal') {
        const queueId = this.generateMessageId();
        const queueItem = {
            queueId,
            messageData,
            recipientPublicKey,
            priority,
            attempts: 0,
            maxAttempts: 5,
            created: Date.now(),
            nextRetry: Date.now() + 1000 // Retry in 1 second
        };

        // Store in IndexedDB
        await this.dbTransaction('messageQueue', 'readwrite', (store) => {
            store.add(queueItem);
        });

        // Add to memory queue
        this.messageQueue.set(queueId, queueItem);

        // Schedule retry
        this.scheduleRetry(queueId);

        console.log(`📤 Message queued for offline delivery: ${queueId}`);
        return queueId;
    }

    // Process message queue for delivery
    async processMessageQueue(isOnline = true) {
        if (!isOnline || !this.isInitialized) {
            return;
        }

        const currentTime = Date.now();
        const readyMessages = Array.from(this.messageQueue.values())
            .filter(item => item.nextRetry <= currentTime)
            .sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));

        for (const item of readyMessages) {
            try {
                // Attempt to deliver message
                const delivered = await this.attemptMessageDelivery(item);
                
                if (delivered) {
                    // Remove from queue
                    await this.removeFromQueue(item.queueId);
                } else {
                    // Schedule next retry with exponential backoff
                    item.attempts++;
                    if (item.attempts >= item.maxAttempts) {
                        console.warn(`❌ Message delivery failed after ${item.maxAttempts} attempts: ${item.queueId}`);
                        await this.removeFromQueue(item.queueId);
                    } else {
                        item.nextRetry = currentTime + (1000 * Math.pow(2, item.attempts));
                        await this.updateQueueItem(item);
                        this.scheduleRetry(item.queueId);
                    }
                }

            } catch (error) {
                console.error(`Queue processing error for ${item.queueId}:`, error);
            }
        }
    }

    // Encrypt data for storage
    async encryptForStorage(data) {
        const nonce = sodium.randombytes_buf(12);
        const plaintext = JSON.stringify(data);
        
        const ciphertext = sodium.crypto_aead_aes256gcm_encrypt(
            plaintext,
            null,
            null,
            nonce,
            this.storageKey
        );

        return {
            ciphertext: sodium.to_base64(ciphertext),
            nonce: sodium.to_base64(nonce)
        };
    }

    // Decrypt data from storage
    async decryptFromStorage(encryptedData) {
        const ciphertext = sodium.from_base64(encryptedData.ciphertext);
        const nonce = sodium.from_base64(encryptedData.nonce);

        const plaintext = sodium.crypto_aead_aes256gcm_decrypt(
            null,
            ciphertext,
            null,
            nonce,
            this.storageKey
        );

        return JSON.parse(sodium.to_string(plaintext));
    }

    // Update conversation metadata
    async updateConversation(roomId, messageRecord) {
        const conversationData = {
            roomId,
            lastActivity: messageRecord.timestamp,
            lastMessage: {
                senderId: messageRecord.senderId,
                timestamp: messageRecord.timestamp,
                messageType: messageRecord.messageType
            },
            participants: [messageRecord.senderId, messageRecord.recipientId].filter(Boolean)
        };

        await this.dbTransaction('conversations', 'readwrite', (store) => {
            const request = store.get(roomId);
            request.onsuccess = () => {
                const existing = request.result;
                if (existing) {
                    // Merge participants
                    const allParticipants = new Set([...existing.participants, ...conversationData.participants]);
                    conversationData.participants = Array.from(allParticipants);
                    conversationData.messageCount = (existing.messageCount || 0) + 1;
                } else {
                    conversationData.messageCount = 1;
                }
                
                store.put(conversationData);
            };
        });
    }

    // Helper method for database transactions
    async dbTransaction(storeName, mode, operation) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            
            try {
                const result = operation(store);
                if (result instanceof Promise) {
                    result.then(resolve).catch(reject);
                } else if (result !== undefined) {
                    resolve(result);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    // Generate unique message ID
    generateMessageId() {
        const timestamp = Date.now().toString(36);
        const random = sodium.to_hex(sodium.randombytes_buf(6));
        return `${timestamp}_${random}`;
    }

    // Schedule retry for queued message
    scheduleRetry(queueId) {
        const item = this.messageQueue.get(queueId);
        if (!item) return;

        const delay = Math.max(0, item.nextRetry - Date.now());
        
        if (this.retryIntervals.has(queueId)) {
            clearTimeout(this.retryIntervals.get(queueId));
        }

        const timeoutId = setTimeout(() => {
            this.processMessageQueue(true);
            this.retryIntervals.delete(queueId);
        }, delay);

        this.retryIntervals.set(queueId, timeoutId);
    }

    // Get priority numeric value
    getPriorityValue(priority) {
        const priorities = { critical: 4, high: 3, normal: 2, low: 1 };
        return priorities[priority] || 2;
    }

    // Load message queue from storage
    async loadMessageQueue() {
        const queueItems = await this.dbTransaction('messageQueue', 'readonly', (store) => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });

        queueItems.forEach(item => {
            this.messageQueue.set(item.queueId, item);
            this.scheduleRetry(item.queueId);
        });

        console.log(`📥 Loaded ${queueItems.length} queued messages`);
    }

    // Remove item from queue
    async removeFromQueue(queueId) {
        this.messageQueue.delete(queueId);
        
        if (this.retryIntervals.has(queueId)) {
            clearTimeout(this.retryIntervals.get(queueId));
            this.retryIntervals.delete(queueId);
        }

        await this.dbTransaction('messageQueue', 'readwrite', (store) => {
            store.delete(queueId);
        });
    }

    // Update queue item
    async updateQueueItem(item) {
        this.messageQueue.set(item.queueId, item);
        
        await this.dbTransaction('messageQueue', 'readwrite', (store) => {
            store.put(item);
        });
    }

    // Attempt to deliver a queued message
    async attemptMessageDelivery(queueItem) {
        // This would integrate with the connection manager to send the message
        // For now, we'll simulate delivery attempt
        try {
            // TODO: Integrate with ConnectionManager to actually send message
            console.log(`📤 Attempting delivery for message ${queueItem.queueId}`);
            
            // Simulate network call (replace with actual delivery logic)
            return false; // Return true when actually delivered
            
        } catch (error) {
            console.error(`Delivery attempt failed for ${queueItem.queueId}:`, error);
            return false;
        }
    }

    // Clear all stored data (for logout/reset)
    async clearAllData() {
        if (!this.db) return;

        const storeNames = ['messages', 'conversations', 'messageQueue', 'contacts'];
        
        for (const storeName of storeNames) {
            await this.dbTransaction(storeName, 'readwrite', (store) => {
                store.clear();
            });
        }

        this.messageQueue.clear();
        this.retryIntervals.forEach(id => clearTimeout(id));
        this.retryIntervals.clear();

        console.log('🗑️ All storage data cleared');
    }

    // Get storage statistics
    async getStorageStats() {
        if (!this.isInitialized) {
            return null;
        }

        try {
            const stats = {};

            const storeNames = ['messages', 'conversations', 'messageQueue', 'contacts'];
            
            for (const storeName of storeNames) {
                const count = await this.dbTransaction(storeName, 'readonly', (store) => {
                    return new Promise((resolve, reject) => {
                        const request = store.count();
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                });
                stats[storeName] = count;
            }

            return stats;

        } catch (error) {
            console.error('Failed to get storage stats:', error);
            return null;
        }
    }

    // Cleanup and destroy
    destroy() {
        // Clear retry intervals
        this.retryIntervals.forEach(id => clearTimeout(id));
        this.retryIntervals.clear();
        
        // Clear message queue
        this.messageQueue.clear();

        // Clear storage key
        if (this.storageKey) {
            sodium.memzero(this.storageKey);
            this.storageKey = null;
        }

        // Close database
        if (this.db) {
            this.db.close();
            this.db = null;
        }

        this.isInitialized = false;
        console.log('🗑️ Storage manager destroyed');
    }
}