// CipherWave Sync Coordinator
// Handles encrypted P2P synchronization of identity, messages, and preferences across devices

import sodium from 'libsodium-wrappers';

export class SyncCoordinator {
    constructor(identityManager, storageManager, deviceTrustManager) {
        this.identityManager = identityManager;
        this.storageManager = storageManager;
        this.deviceTrustManager = deviceTrustManager;
        
        // Sync state
        this.syncConnections = new Map(); // deviceId -> WebRTC connection
        this.syncInProgress = new Map(); // deviceId -> sync status
        this.vectorClocks = new Map(); // data_type -> vector clock
        this.conflictQueue = [];
        
        // Sync preferences
        this.syncModes = {
            REAL_TIME: 'real-time',
            BATCH: 'batch', 
            MANUAL: 'manual'
        };
        
        this.dataTypes = {
            IDENTITY: 'identity',
            MESSAGES: 'messages',
            CONTACTS: 'contacts',
            PREFERENCES: 'preferences',
            VOICE_NOTES: 'voice_notes'
        };
        
        // Sync intervals
        this.batchSyncInterval = 5 * 60 * 1000; // 5 minutes
        this.heartbeatInterval = 30 * 1000; // 30 seconds
        
        // Vector clock for conflict resolution
        this.deviceId = null;
        this.clockCounter = 0;
        
        console.log('🔄 Sync coordinator initialized');
    }

    async initialize() {
        this.deviceId = this.identityManager.deviceId;
        await this.loadVectorClocks();
        this.startHeartbeat();
        this.startBatchSync();
    }

    // Establish sync connection with trusted device
    async connectToDevice(deviceId) {
        if (!this.deviceTrustManager.isDeviceTrusted(deviceId, 70)) {
            throw new Error('Device not trusted for sync operations');
        }

        try {
            const device = this.deviceTrustManager.getDevice(deviceId);
            const authKeys = this.deviceTrustManager.getDeviceAuthKeys(deviceId);
            
            if (!authKeys) {
                throw new Error('No authorization keys found for device');
            }

            // Create WebRTC connection for sync
            const syncConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });

            // Set up data channel for sync
            const syncChannel = syncConnection.createDataChannel('sync', {
                ordered: true,
                maxRetransmits: 3
            });

            // Set up event handlers
            this.setupSyncChannelHandlers(deviceId, syncChannel);

            // Store connection
            this.syncConnections.set(deviceId, {
                connection: syncConnection,
                channel: syncChannel,
                device: device,
                authKeys: authKeys,
                connected: false,
                lastSync: null,
                syncQueue: []
            });

            console.log(`🔄 Sync connection initiated with ${device.displayName}`);
            
            return syncConnection;

        } catch (error) {
            console.error('Failed to connect to device for sync:', error);
            throw error;
        }
    }

    // Set up sync channel event handlers
    setupSyncChannelHandlers(deviceId, channel) {
        channel.onopen = () => {
            console.log(`🔄 Sync channel opened with device: ${deviceId}`);
            const syncConnection = this.syncConnections.get(deviceId);
            if (syncConnection) {
                syncConnection.connected = true;
                this.performInitialSync(deviceId);
            }
        };

        channel.onmessage = (event) => {
            this.handleSyncMessage(deviceId, event.data);
        };

        channel.onclose = () => {
            console.log(`🔄 Sync channel closed with device: ${deviceId}`);
            const syncConnection = this.syncConnections.get(deviceId);
            if (syncConnection) {
                syncConnection.connected = false;
            }
        };

        channel.onerror = (error) => {
            console.error('Sync channel error:', error);
            this.handleSyncError(deviceId, error);
        };
    }

    // Handle incoming sync messages
    async handleSyncMessage(deviceId, messageData) {
        try {
            const message = JSON.parse(messageData);
            const syncConnection = this.syncConnections.get(deviceId);
            
            if (!syncConnection || !syncConnection.connected) {
                console.warn('Received sync message from disconnected device');
                return;
            }

            // Decrypt sync message
            const decryptedMessage = await this.decryptSyncMessage(message, syncConnection.authKeys);

            switch (decryptedMessage.type) {
                case 'SYNC_REQUEST':
                    await this.handleSyncRequest(deviceId, decryptedMessage);
                    break;
                case 'SYNC_RESPONSE':
                    await this.handleSyncResponse(deviceId, decryptedMessage);
                    break;
                case 'DATA_UPDATE':
                    await this.handleDataUpdate(deviceId, decryptedMessage);
                    break;
                case 'CONFLICT_RESOLUTION':
                    await this.handleConflictResolution(deviceId, decryptedMessage);
                    break;
                case 'HEARTBEAT':
                    await this.handleHeartbeat(deviceId, decryptedMessage);
                    break;
                default:
                    console.warn('Unknown sync message type:', decryptedMessage.type);
            }

        } catch (error) {
            console.error('Failed to handle sync message:', error);
        }
    }

    // Perform initial sync when device connects
    async performInitialSync(deviceId) {
        try {
            const syncConnection = this.syncConnections.get(deviceId);
            if (!syncConnection) return;

            const device = syncConnection.device;
            const syncPrefs = device.syncPreferences;

            // Determine what data types to sync
            const dataTypesToSync = [];
            if (syncPrefs.messages) dataTypesToSync.push(this.dataTypes.MESSAGES);
            if (syncPrefs.contacts) dataTypesToSync.push(this.dataTypes.CONTACTS);
            if (syncPrefs.preferences) dataTypesToSync.push(this.dataTypes.PREFERENCES);
            if (syncPrefs.voiceNotes) dataTypesToSync.push(this.dataTypes.VOICE_NOTES);

            // Send sync request
            const syncRequest = {
                type: 'SYNC_REQUEST',
                requestId: sodium.to_hex(sodium.randombytes_buf(16)),
                dataTypes: dataTypesToSync,
                vectorClocks: this.getVectorClocksForDevice(deviceId),
                timestamp: Date.now(),
                syncMode: syncPrefs.syncMode || this.syncModes.BATCH
            };

            await this.sendSyncMessage(deviceId, syncRequest);

            console.log(`🔄 Initial sync request sent to ${device.displayName}`);

        } catch (error) {
            console.error('Failed to perform initial sync:', error);
        }
    }

    // Handle sync request from another device
    async handleSyncRequest(deviceId, message) {
        try {
            const syncConnection = this.syncConnections.get(deviceId);
            if (!syncConnection) return;

            // Compare vector clocks to determine what data to send
            const dataToSync = await this.generateSyncData(message.dataTypes, message.vectorClocks);

            // Create sync response
            const syncResponse = {
                type: 'SYNC_RESPONSE',
                requestId: message.requestId,
                data: dataToSync,
                vectorClocks: this.getVectorClocksForDevice(deviceId),
                timestamp: Date.now()
            };

            await this.sendSyncMessage(deviceId, syncResponse);

            console.log(`🔄 Sync response sent to device: ${deviceId}`);

        } catch (error) {
            console.error('Failed to handle sync request:', error);
        }
    }

    // Handle sync response with data updates
    async handleSyncResponse(deviceId, message) {
        try {
            // Process received sync data
            for (const dataType of Object.keys(message.data)) {
                await this.processSyncData(deviceId, dataType, message.data[dataType]);
            }

            // Update vector clocks
            this.mergeVectorClocks(message.vectorClocks);

            // Update last sync time
            const syncConnection = this.syncConnections.get(deviceId);
            if (syncConnection) {
                syncConnection.lastSync = Date.now();
            }

            console.log(`🔄 Sync response processed from device: ${deviceId}`);

        } catch (error) {
            console.error('Failed to handle sync response:', error);
        }
    }

    // Handle real-time data updates
    async handleDataUpdate(deviceId, message) {
        try {
            const { dataType, operation, data, vectorClock } = message;

            // Check if we need this update based on vector clocks
            if (!this.shouldApplyUpdate(dataType, vectorClock)) {
                console.log('Skipping outdated update');
                return;
            }

            // Apply the update
            await this.applyDataUpdate(dataType, operation, data);

            // Update our vector clock
            this.updateVectorClock(dataType, vectorClock);

            console.log(`🔄 Real-time update applied: ${dataType} (${operation})`);

        } catch (error) {
            console.error('Failed to handle data update:', error);
        }
    }

    // Generate sync data based on vector clock comparison
    async generateSyncData(dataTypes, remoteVectorClocks) {
        const syncData = {};

        for (const dataType of dataTypes) {
            const localClock = this.vectorClocks.get(dataType) || {};
            const remoteClock = remoteVectorClocks[dataType] || {};

            // Determine what data needs to be synced
            switch (dataType) {
                case this.dataTypes.MESSAGES:
                    syncData[dataType] = await this.generateMessageSyncData(localClock, remoteClock);
                    break;
                case this.dataTypes.CONTACTS:
                    syncData[dataType] = await this.generateContactSyncData(localClock, remoteClock);
                    break;
                case this.dataTypes.PREFERENCES:
                    syncData[dataType] = await this.generatePreferencesSyncData(localClock, remoteClock);
                    break;
                case this.dataTypes.IDENTITY:
                    syncData[dataType] = await this.generateIdentitySyncData(localClock, remoteClock);
                    break;
            }
        }

        return syncData;
    }

    // Generate message sync data
    async generateMessageSyncData(localClock, remoteClock) {
        try {
            // Get messages that are newer than remote clock
            const conversations = await this.storageManager.getConversations();
            const syncMessages = [];

            for (const conversation of conversations) {
                const messages = await this.storageManager.getMessages(conversation.roomId);
                
                for (const message of messages) {
                    const messageTimestamp = message.timestamp;
                    const remoteTimestamp = remoteClock[message.messageId] || 0;
                    
                    if (messageTimestamp > remoteTimestamp) {
                        syncMessages.push({
                            messageId: message.messageId,
                            roomId: message.roomId,
                            encryptedContent: message.encryptedContent,
                            senderId: message.senderId,
                            timestamp: message.timestamp,
                            signature: message.signature
                        });
                    }
                }
            }

            return syncMessages;

        } catch (error) {
            console.error('Failed to generate message sync data:', error);
            return [];
        }
    }

    // Generate contact sync data  
    async generateContactSyncData(localClock, remoteClock) {
        try {
            const contacts = Array.from(this.identityManager.trustedContacts.entries());
            const syncContacts = [];

            for (const [publicKey, contactData] of contacts) {
                const contactTimestamp = contactData.lastInteraction || contactData.firstContact;
                const remoteTimestamp = remoteClock[publicKey] || 0;

                if (contactTimestamp > remoteTimestamp) {
                    syncContacts.push({
                        publicKey,
                        displayName: contactData.displayName,
                        trustLevel: contactData.trustLevel,
                        firstContact: contactData.firstContact,
                        lastInteraction: contactData.lastInteraction,
                        interactionCount: contactData.interactionCount
                    });
                }
            }

            return syncContacts;

        } catch (error) {
            console.error('Failed to generate contact sync data:', error);
            return [];
        }
    }

    // Apply data updates from sync
    async applyDataUpdate(dataType, operation, data) {
        switch (dataType) {
            case this.dataTypes.MESSAGES:
                await this.applyMessageUpdate(operation, data);
                break;
            case this.dataTypes.CONTACTS:
                await this.applyContactUpdate(operation, data);
                break;
            case this.dataTypes.PREFERENCES:
                await this.applyPreferencesUpdate(operation, data);
                break;
        }
    }

    // Apply message updates
    async applyMessageUpdate(operation, messageData) {
        try {
            switch (operation) {
                case 'CREATE':
                case 'UPDATE':
                    await this.storageManager.storeMessage(messageData);
                    break;
                case 'DELETE':
                    // Handle message deletion if supported
                    break;
            }
        } catch (error) {
            console.error('Failed to apply message update:', error);
        }
    }

    // Apply contact updates
    async applyContactUpdate(operation, contactData) {
        try {
            switch (operation) {
                case 'CREATE':
                case 'UPDATE':
                    this.identityManager.trustedContacts.set(contactData.publicKey, {
                        displayName: contactData.displayName,
                        trustLevel: contactData.trustLevel,
                        firstContact: contactData.firstContact,
                        lastInteraction: contactData.lastInteraction,
                        interactionCount: contactData.interactionCount
                    });
                    break;
                case 'DELETE':
                    this.identityManager.trustedContacts.delete(contactData.publicKey);
                    break;
            }
        } catch (error) {
            console.error('Failed to apply contact update:', error);
        }
    }

    // Send encrypted sync message
    async sendSyncMessage(deviceId, message) {
        try {
            const syncConnection = this.syncConnections.get(deviceId);
            if (!syncConnection || !syncConnection.connected) {
                throw new Error('Device not connected for sync');
            }

            // Encrypt message with device auth keys
            const encryptedMessage = await this.encryptSyncMessage(message, syncConnection.authKeys);
            
            // Send through data channel
            syncConnection.channel.send(JSON.stringify(encryptedMessage));

            // Update vector clock for outgoing message
            this.incrementVectorClock(message.type);

        } catch (error) {
            console.error('Failed to send sync message:', error);
            throw error;
        }
    }

    // Encrypt sync message
    async encryptSyncMessage(message, authKeys) {
        try {
            const nonce = sodium.randombytes_buf(12);
            const plaintext = JSON.stringify(message);

            // Use device auth keys for encryption
            const ciphertext = sodium.crypto_box_easy(
                plaintext,
                nonce,
                authKeys.publicKey,
                authKeys.privateKey
            );

            return {
                ciphertext: sodium.to_base64(ciphertext),
                nonce: sodium.to_base64(nonce),
                timestamp: Date.now()
            };

        } catch (error) {
            throw new Error(`Sync message encryption failed: ${error.message}`);
        }
    }

    // Decrypt sync message
    async decryptSyncMessage(encryptedMessage, authKeys) {
        try {
            const ciphertext = sodium.from_base64(encryptedMessage.ciphertext);
            const nonce = sodium.from_base64(encryptedMessage.nonce);

            const plaintext = sodium.crypto_box_open_easy(
                ciphertext,
                nonce,
                authKeys.publicKey,
                authKeys.privateKey
            );

            return JSON.parse(sodium.to_string(plaintext));

        } catch (error) {
            throw new Error(`Sync message decryption failed: ${error.message}`);
        }
    }

    // Vector clock management
    incrementVectorClock(eventType) {
        this.clockCounter++;
        const clockKey = `${this.deviceId}:${eventType}`;
        
        if (!this.vectorClocks.has(eventType)) {
            this.vectorClocks.set(eventType, {});
        }
        
        const clock = this.vectorClocks.get(eventType);
        clock[this.deviceId] = this.clockCounter;
        
        this.saveVectorClocks();
    }

    updateVectorClock(eventType, remoteClock) {
        if (!this.vectorClocks.has(eventType)) {
            this.vectorClocks.set(eventType, {});
        }
        
        const localClock = this.vectorClocks.get(eventType);
        
        // Merge remote clock with local clock
        for (const [deviceId, timestamp] of Object.entries(remoteClock)) {
            localClock[deviceId] = Math.max(localClock[deviceId] || 0, timestamp);
        }
        
        this.saveVectorClocks();
    }

    shouldApplyUpdate(dataType, vectorClock) {
        const localClock = this.vectorClocks.get(dataType) || {};
        
        // Check if this update is newer than what we have
        for (const [deviceId, timestamp] of Object.entries(vectorClock)) {
            if (timestamp > (localClock[deviceId] || 0)) {
                return true;
            }
        }
        
        return false;
    }

    // Get vector clocks for specific device
    getVectorClocksForDevice(deviceId) {
        const clocks = {};
        for (const [dataType, clock] of this.vectorClocks.entries()) {
            clocks[dataType] = { ...clock };
        }
        return clocks;
    }

    // Merge vector clocks from remote device
    mergeVectorClocks(remoteClocks) {
        for (const [dataType, remoteClock] of Object.entries(remoteClocks)) {
            this.updateVectorClock(dataType, remoteClock);
        }
    }

    // Start heartbeat for connected devices
    startHeartbeat() {
        setInterval(() => {
            this.sendHeartbeats();
        }, this.heartbeatInterval);
    }

    async sendHeartbeats() {
        for (const [deviceId, syncConnection] of this.syncConnections.entries()) {
            if (syncConnection.connected) {
                try {
                    const heartbeat = {
                        type: 'HEARTBEAT',
                        deviceId: this.deviceId,
                        timestamp: Date.now(),
                        syncStatus: 'active'
                    };

                    await this.sendSyncMessage(deviceId, heartbeat);
                } catch (error) {
                    console.error(`Failed to send heartbeat to ${deviceId}:`, error);
                }
            }
        }
    }

    // Start batch sync interval
    startBatchSync() {
        setInterval(() => {
            this.performBatchSync();
        }, this.batchSyncInterval);
    }

    async performBatchSync() {
        for (const [deviceId, syncConnection] of this.syncConnections.entries()) {
            if (syncConnection.connected && 
                syncConnection.device.syncPreferences.syncMode === this.syncModes.BATCH) {
                
                try {
                    await this.performInitialSync(deviceId);
                } catch (error) {
                    console.error(`Batch sync failed for ${deviceId}:`, error);
                }
            }
        }
    }

    // Save vector clocks to storage
    async saveVectorClocks() {
        try {
            const clocksData = {};
            for (const [dataType, clock] of this.vectorClocks.entries()) {
                clocksData[dataType] = clock;
            }

            const storageKey = await this.deriveVectorClockKey();
            const encryptedData = await this.encryptStorageData(JSON.stringify(clocksData), storageKey);
            
            localStorage.setItem('cipherwave_vector_clocks', encryptedData);

        } catch (error) {
            console.error('Failed to save vector clocks:', error);
        }
    }

    // Load vector clocks from storage
    async loadVectorClocks() {
        try {
            const encryptedData = localStorage.getItem('cipherwave_vector_clocks');
            if (!encryptedData) {
                return;
            }

            const storageKey = await this.deriveVectorClockKey();
            const decryptedData = await this.decryptStorageData(encryptedData, storageKey);
            
            const clocksData = JSON.parse(decryptedData);
            
            for (const [dataType, clock] of Object.entries(clocksData)) {
                this.vectorClocks.set(dataType, clock);
            }

        } catch (error) {
            console.error('Failed to load vector clocks:', error);
        }
    }

    // Derive storage key for vector clocks
    async deriveVectorClockKey() {
        return sodium.crypto_kdf_derive_from_key(
            32, // 256-bit key
            3,  // subkey ID for vector clocks
            'clocks:',
            this.identityManager.userIdentity.identityKeyPair.privateKey.slice(0, 32)
        );
    }

    // Storage encryption helpers (reuse from other managers)
    async encryptStorageData(plaintext, key) {
        const nonce = sodium.randombytes_buf(12);
        const ciphertext = sodium.crypto_aead_aes256gcm_encrypt(
            plaintext, null, null, nonce, key
        );

        return JSON.stringify({
            ciphertext: sodium.to_base64(ciphertext),
            nonce: sodium.to_base64(nonce)
        });
    }

    async decryptStorageData(encryptedData, key) {
        const data = JSON.parse(encryptedData);
        const ciphertext = sodium.from_base64(data.ciphertext);
        const nonce = sodium.from_base64(data.nonce);

        const plaintext = sodium.crypto_aead_aes256gcm_decrypt(
            null, ciphertext, null, nonce, key
        );

        return sodium.to_string(plaintext);
    }

    // Get sync status for all devices
    getSyncStatus() {
        const status = {};
        for (const [deviceId, syncConnection] of this.syncConnections.entries()) {
            status[deviceId] = {
                device: syncConnection.device,
                connected: syncConnection.connected,
                lastSync: syncConnection.lastSync,
                queueLength: syncConnection.syncQueue.length
            };
        }
        return status;
    }

    // Disconnect from device
    async disconnectFromDevice(deviceId) {
        const syncConnection = this.syncConnections.get(deviceId);
        if (syncConnection) {
            if (syncConnection.channel) {
                syncConnection.channel.close();
            }
            if (syncConnection.connection) {
                syncConnection.connection.close();
            }
            this.syncConnections.delete(deviceId);
        }
    }

    // Cleanup and destroy
    async destroy() {
        // Disconnect all sync connections
        for (const deviceId of this.syncConnections.keys()) {
            await this.disconnectFromDevice(deviceId);
        }

        // Save final vector clocks
        await this.saveVectorClocks();

        console.log('🗑️ Sync coordinator destroyed');
    }
}