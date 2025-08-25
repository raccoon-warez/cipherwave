// CipherWave Device Trust Manager
// Handles secure device pairing, authorization, and trust circle management

import sodium from 'libsodium-wrappers';
import QRCode from 'qrcode';

export class DeviceTrustManager {
    constructor(identityManager) {
        this.identityManager = identityManager;
        this.trustedDevices = new Map();
        this.deviceAuthKeys = new Map();
        this.pendingAuthorizations = new Map();
        this.storageKey = 'cipherwave_trusted_devices';
        this.maxTrustedDevices = 10;
        this.defaultTrustLevel = 70;
        this.trustDecayRate = 0.95; // Trust decays by 5% per month
        
        // Device types and their trust implications
        this.deviceTypes = {
            MOBILE: { maxTrust: 85, autoApprove: false },
            DESKTOP: { maxTrust: 95, autoApprove: false },
            TABLET: { maxTrust: 80, autoApprove: false },
            WEB: { maxTrust: 75, autoApprove: false }
        };
        
        console.log('🔗 Device trust manager initialized');
    }

    async initialize() {
        await this.loadTrustedDevices();
        this.startTrustDecayMonitor();
    }

    // Generate secure device pairing QR code
    async generatePairingQR(deviceType = 'DESKTOP', expiryMinutes = 5) {
        if (!this.identityManager.isLoggedIn) {
            throw new Error('User must be logged in to generate pairing QR');
        }

        try {
            // Generate ephemeral pairing keypair
            const pairingKeypair = sodium.crypto_box_keypair();
            const pairingId = sodium.to_hex(sodium.randombytes_buf(16));
            const timestamp = Date.now();
            const expiryTime = timestamp + (expiryMinutes * 60 * 1000);

            // Create pairing challenge
            const challenge = sodium.randombytes_buf(32);
            const challengeSignature = this.identityManager.signWithIdentity(challenge);

            const pairingData = {
                version: '1.0',
                pairingId,
                deviceId: this.identityManager.deviceId,
                publicKey: this.identityManager.userIdentity.profileData.publicKey,
                displayName: this.identityManager.userIdentity.profileData.displayName,
                deviceType,
                pairingPublicKey: sodium.to_hex(pairingKeypair.publicKey),
                challenge: sodium.to_hex(challenge),
                signature: sodium.to_hex(challengeSignature),
                timestamp,
                expiryTime
            };

            // Store pairing session
            this.pendingAuthorizations.set(pairingId, {
                ...pairingData,
                pairingPrivateKey: pairingKeypair.privateKey,
                created: timestamp,
                attempts: 0,
                maxAttempts: 3
            });

            // Generate QR code
            const qrDataUrl = await QRCode.toDataURL(JSON.stringify(pairingData), {
                errorCorrectionLevel: 'H',
                margin: 2,
                width: 300,
                color: {
                    dark: '#2D3748',
                    light: '#FFFFFF'
                }
            });

            // Clean up expired pairings
            this.cleanupExpiredPairings();

            console.log(`🔗 Generated pairing QR for device type: ${deviceType}`);
            
            return {
                qrCodeDataUrl: qrDataUrl,
                pairingId,
                expiryTime,
                pairingData
            };

        } catch (error) {
            console.error('Failed to generate pairing QR:', error);
            throw new Error(`Pairing QR generation failed: ${error.message}`);
        }
    }

    // Process scanned QR code for device pairing
    async processPairingQR(qrData, deviceInfo) {
        try {
            const pairingData = JSON.parse(qrData);
            
            // Validate QR code structure
            if (!this.validatePairingData(pairingData)) {
                throw new Error('Invalid pairing QR code format');
            }

            // Check if pairing has expired
            if (Date.now() > pairingData.expiryTime) {
                throw new Error('Pairing QR code has expired');
            }

            // Verify the challenge signature
            const challengeValid = this.identityManager.verifySignature(
                pairingData.challenge,
                pairingData.signature,
                pairingData.publicKey
            );

            if (!challengeValid) {
                throw new Error('Invalid pairing signature');
            }

            // Create pairing request
            const pairingRequest = {
                requestId: sodium.to_hex(sodium.randombytes_buf(16)),
                pairingId: pairingData.pairingId,
                requestingDevice: {
                    deviceId: this.identityManager.deviceId,
                    publicKey: this.identityManager.userIdentity.profileData.publicKey,
                    displayName: this.identityManager.userIdentity.profileData.displayName,
                    deviceType: deviceInfo.type || 'UNKNOWN',
                    platform: deviceInfo.platform || navigator.platform,
                    userAgent: navigator.userAgent.substring(0, 100)
                },
                timestamp: Date.now(),
                challenge: sodium.to_hex(sodium.randombytes_buf(32))
            };

            // Sign the pairing request
            const requestSignature = this.identityManager.signWithIdentity(
                JSON.stringify(pairingRequest)
            );
            pairingRequest.signature = sodium.to_hex(requestSignature);

            console.log('🔗 Created pairing request:', pairingRequest.requestId);
            
            return pairingRequest;

        } catch (error) {
            console.error('Failed to process pairing QR:', error);
            throw new Error(`Pairing failed: ${error.message}`);
        }
    }

    // Approve device pairing request
    async approvePairingRequest(pairingRequest, approvalLevel = 'MANUAL') {
        try {
            const pairingId = pairingRequest.pairingId;
            const pendingPairing = this.pendingAuthorizations.get(pairingId);

            if (!pendingPairing) {
                throw new Error('Pairing session not found or expired');
            }

            // Verify request signature
            const requestSignature = pairingRequest.signature;
            delete pairingRequest.signature;
            
            const signatureValid = this.identityManager.verifySignature(
                JSON.stringify(pairingRequest),
                requestSignature,
                pairingRequest.requestingDevice.publicKey
            );

            if (!signatureValid) {
                throw new Error('Invalid pairing request signature');
            }

            // Check if we already trust this device
            if (this.trustedDevices.has(pairingRequest.requestingDevice.deviceId)) {
                throw new Error('Device is already trusted');
            }

            // Check trust limits
            if (this.trustedDevices.size >= this.maxTrustedDevices) {
                throw new Error('Maximum trusted devices limit reached');
            }

            // Create device trust entry
            const deviceType = this.deviceTypes[pairingRequest.requestingDevice.deviceType] || 
                             this.deviceTypes.WEB;
            
            const trustLevel = this.calculateInitialTrust(
                pairingRequest.requestingDevice.deviceType,
                approvalLevel
            );

            const trustedDevice = {
                deviceId: pairingRequest.requestingDevice.deviceId,
                publicKey: pairingRequest.requestingDevice.publicKey,
                displayName: pairingRequest.requestingDevice.displayName,
                deviceType: pairingRequest.requestingDevice.deviceType,
                platform: pairingRequest.requestingDevice.platform,
                trustLevel,
                approved: true,
                approvedBy: this.identityManager.deviceId,
                approvalMethod: approvalLevel,
                created: Date.now(),
                lastSeen: Date.now(),
                lastSync: null,
                syncPreferences: this.getDefaultSyncPreferences(),
                isActive: true
            };

            // Generate device authorization keypair
            const deviceAuthKeys = sodium.crypto_box_keypair();
            this.deviceAuthKeys.set(trustedDevice.deviceId, {
                publicKey: deviceAuthKeys.publicKey,
                privateKey: deviceAuthKeys.privateKey
            });

            // Add to trusted devices
            this.trustedDevices.set(trustedDevice.deviceId, trustedDevice);

            // Save to storage
            await this.saveTrustedDevices();

            // Generate approval response
            const approvalResponse = {
                approved: true,
                trustLevel: trustLevel,
                deviceAuthPublicKey: sodium.to_hex(deviceAuthKeys.publicKey),
                syncPreferences: trustedDevice.syncPreferences,
                welcomeMessage: `Welcome to ${this.identityManager.userIdentity.profileData.displayName}'s trusted devices!`
            };

            // Clean up pairing session
            this.pendingAuthorizations.delete(pairingId);

            console.log(`✅ Approved device: ${trustedDevice.displayName} (${trustLevel}% trust)`);
            
            return {
                success: true,
                trustedDevice,
                approvalResponse
            };

        } catch (error) {
            console.error('Failed to approve pairing:', error);
            throw new Error(`Pairing approval failed: ${error.message}`);
        }
    }

    // Reject device pairing request
    async rejectPairingRequest(pairingId, reason = 'User rejected') {
        const pendingPairing = this.pendingAuthorizations.get(pairingId);
        
        if (pendingPairing) {
            this.pendingAuthorizations.delete(pairingId);
            console.log(`❌ Rejected pairing: ${reason}`);
        }
        
        return { success: true, reason };
    }

    // Update device trust level based on activity
    updateDeviceTrust(deviceId, delta, reason = 'Activity-based update') {
        const device = this.trustedDevices.get(deviceId);
        if (!device) {
            return false;
        }

        const oldTrust = device.trustLevel;
        const deviceType = this.deviceTypes[device.deviceType] || this.deviceTypes.WEB;
        
        device.trustLevel = Math.max(0, Math.min(deviceType.maxTrust, oldTrust + delta));
        device.lastSeen = Date.now();

        // Log significant trust changes
        if (Math.abs(delta) >= 5) {
            console.log(`🔄 Trust updated for ${device.displayName}: ${oldTrust}% → ${device.trustLevel}% (${reason})`);
        }

        // Remove device if trust falls too low
        if (device.trustLevel < 10) {
            this.removeDevice(deviceId, 'Trust level too low');
        } else {
            this.saveTrustedDevices();
        }

        return true;
    }

    // Remove device from trust circle
    async removeDevice(deviceId, reason = 'Manual removal') {
        const device = this.trustedDevices.get(deviceId);
        if (!device) {
            return false;
        }

        // Clean up auth keys
        const authKeys = this.deviceAuthKeys.get(deviceId);
        if (authKeys) {
            sodium.memzero(authKeys.privateKey);
            this.deviceAuthKeys.delete(deviceId);
        }

        // Remove from trusted devices
        this.trustedDevices.delete(deviceId);
        
        await this.saveTrustedDevices();

        console.log(`🗑️ Removed device: ${device.displayName} (${reason})`);
        return true;
    }

    // Get all trusted devices
    getTrustedDevices() {
        return Array.from(this.trustedDevices.values());
    }

    // Get device by ID
    getDevice(deviceId) {
        return this.trustedDevices.get(deviceId);
    }

    // Check if device is trusted
    isDeviceTrusted(deviceId, minimumTrust = 50) {
        const device = this.trustedDevices.get(deviceId);
        return device && device.isActive && device.trustLevel >= minimumTrust;
    }

    // Get device authorization keys
    getDeviceAuthKeys(deviceId) {
        return this.deviceAuthKeys.get(deviceId);
    }

    // Calculate initial trust level
    calculateInitialTrust(deviceType, approvalLevel) {
        const deviceConfig = this.deviceTypes[deviceType] || this.deviceTypes.WEB;
        let baseTrust = this.defaultTrustLevel;

        // Adjust based on approval method
        switch (approvalLevel) {
            case 'AUTO':
                baseTrust *= 0.8; // 20% reduction for auto-approval
                break;
            case 'MANUAL':
                baseTrust *= 1.0; // Full trust for manual approval
                break;
            case 'CONSENSUS':
                baseTrust *= 1.1; // 10% bonus for consensus approval
                break;
        }

        return Math.min(deviceConfig.maxTrust, Math.round(baseTrust));
    }

    // Get default sync preferences
    getDefaultSyncPreferences() {
        return {
            messages: true,
            contacts: true,
            preferences: true,
            voiceNotes: false,
            fileTransfers: false,
            syncMode: 'real-time', // real-time, batch, manual
            bandwidth: 'normal' // low, normal, high
        };
    }

    // Validate pairing data structure
    validatePairingData(data) {
        const required = [
            'version', 'pairingId', 'deviceId', 'publicKey', 
            'displayName', 'deviceType', 'pairingPublicKey', 
            'challenge', 'signature', 'timestamp', 'expiryTime'
        ];

        return required.every(field => data.hasOwnProperty(field)) &&
               typeof data.publicKey === 'string' &&
               data.publicKey.length === 64 && // Ed25519 public key hex length
               Date.now() <= data.expiryTime;
    }

    // Clean up expired pairing sessions
    cleanupExpiredPairings() {
        const now = Date.now();
        for (const [pairingId, pairing] of this.pendingAuthorizations.entries()) {
            if (now > pairing.expiryTime) {
                // Clear private key before deletion
                if (pairing.pairingPrivateKey) {
                    sodium.memzero(pairing.pairingPrivateKey);
                }
                this.pendingAuthorizations.delete(pairingId);
            }
        }
    }

    // Start trust decay monitoring
    startTrustDecayMonitor() {
        // Check trust decay once per day
        setInterval(() => {
            this.processTrustDecay();
        }, 24 * 60 * 60 * 1000);
    }

    // Process trust decay for inactive devices
    processTrustDecay() {
        const now = Date.now();
        const monthMs = 30 * 24 * 60 * 60 * 1000; // 30 days

        for (const [deviceId, device] of this.trustedDevices.entries()) {
            const inactiveTime = now - device.lastSeen;
            
            if (inactiveTime > monthMs) {
                const monthsInactive = Math.floor(inactiveTime / monthMs);
                const decayFactor = Math.pow(this.trustDecayRate, monthsInactive);
                const newTrust = Math.round(device.trustLevel * decayFactor);
                
                if (newTrust !== device.trustLevel) {
                    this.updateDeviceTrust(
                        deviceId, 
                        newTrust - device.trustLevel, 
                        `Inactivity decay (${monthsInactive} months)`
                    );
                }
            }
        }
    }

    // Load trusted devices from storage
    async loadTrustedDevices() {
        try {
            if (!this.identityManager.isLoggedIn) {
                return;
            }

            const encryptedData = localStorage.getItem(this.storageKey);
            if (!encryptedData) {
                return;
            }

            // Decrypt using identity-derived key
            const storageKey = await this.deriveStorageKey();
            const decryptedData = await this.decryptStorageData(encryptedData, storageKey);
            
            const devicesData = JSON.parse(decryptedData);
            
            // Restore trusted devices
            for (const deviceData of devicesData.trustedDevices || []) {
                this.trustedDevices.set(deviceData.deviceId, deviceData);
            }

            // Restore auth keys
            for (const keyData of devicesData.authKeys || []) {
                this.deviceAuthKeys.set(keyData.deviceId, {
                    publicKey: sodium.from_hex(keyData.publicKey),
                    privateKey: sodium.from_hex(keyData.privateKey)
                });
            }

            console.log(`🔗 Loaded ${this.trustedDevices.size} trusted devices`);

        } catch (error) {
            console.error('Failed to load trusted devices:', error);
        }
    }

    // Save trusted devices to storage
    async saveTrustedDevices() {
        try {
            if (!this.identityManager.isLoggedIn) {
                return;
            }

            const devicesData = {
                trustedDevices: Array.from(this.trustedDevices.values()),
                authKeys: Array.from(this.deviceAuthKeys.entries()).map(([deviceId, keys]) => ({
                    deviceId,
                    publicKey: sodium.to_hex(keys.publicKey),
                    privateKey: sodium.to_hex(keys.privateKey)
                })),
                lastUpdated: Date.now()
            };

            const storageKey = await this.deriveStorageKey();
            const encryptedData = await this.encryptStorageData(JSON.stringify(devicesData), storageKey);
            
            localStorage.setItem(this.storageKey, encryptedData);

        } catch (error) {
            console.error('Failed to save trusted devices:', error);
        }
    }

    // Derive storage key for device data
    async deriveStorageKey() {
        const userPublicKey = this.identityManager.userIdentity.profileData.publicKey;
        const context = 'devices:';
        
        return sodium.crypto_kdf_derive_from_key(
            32, // 256-bit key
            2,  // subkey ID for device storage
            context,
            this.identityManager.userIdentity.identityKeyPair.privateKey.slice(0, 32)
        );
    }

    // Encrypt storage data
    async encryptStorageData(plaintext, key) {
        const nonce = sodium.randombytes_buf(12);
        const ciphertext = sodium.crypto_aead_aes256gcm_encrypt(
            plaintext,
            null,
            null,
            nonce,
            key
        );

        return JSON.stringify({
            ciphertext: sodium.to_base64(ciphertext),
            nonce: sodium.to_base64(nonce)
        });
    }

    // Decrypt storage data
    async decryptStorageData(encryptedData, key) {
        const data = JSON.parse(encryptedData);
        const ciphertext = sodium.from_base64(data.ciphertext);
        const nonce = sodium.from_base64(data.nonce);

        const plaintext = sodium.crypto_aead_aes256gcm_decrypt(
            null,
            ciphertext,
            null,
            nonce,
            key
        );

        return sodium.to_string(plaintext);
    }

    // Clean up and destroy
    destroy() {
        // Clear all auth keys from memory
        for (const [deviceId, keys] of this.deviceAuthKeys.entries()) {
            sodium.memzero(keys.privateKey);
        }
        
        this.deviceAuthKeys.clear();
        this.trustedDevices.clear();
        this.pendingAuthorizations.clear();

        console.log('🗑️ Device trust manager destroyed');
    }
}