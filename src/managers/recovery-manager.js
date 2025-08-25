// CipherWave Recovery Manager
// Implements Shamir's Secret Sharing for secure account recovery across trusted devices

import sodium from 'libsodium-wrappers';

export class RecoveryManager {
    constructor(identityManager, deviceTrustManager) {
        this.identityManager = identityManager;
        this.deviceTrustManager = deviceTrustManager;
        this.recoveryShares = new Map(); // deviceId -> encrypted share
        this.pendingRecoveries = new Map(); // recoveryId -> recovery session
        
        // Recovery configuration
        this.threshold = 3; // Minimum shares needed for recovery
        this.totalShares = 5; // Total shares to generate
        this.recoveryTimeout = 24 * 60 * 60 * 1000; // 24 hours
        this.approvalTimeout = 30 * 60 * 1000; // 30 minutes per device approval
        
        // Recovery types
        this.recoveryTypes = {
            DEVICE_LOST: 'device_lost',
            PASSWORD_FORGOTTEN: 'password_forgotten',
            IDENTITY_COMPROMISED: 'identity_compromised',
            EMERGENCY_ACCESS: 'emergency_access'
        };

        console.log('🔐 Recovery manager initialized');
    }

    async initialize() {
        await this.loadRecoveryShares();
        await this.generateInitialShares();
    }

    // Generate recovery shares using Shamir's Secret Sharing
    async generateRecoveryShares() {
        if (!this.identityManager.isLoggedIn) {
            throw new Error('User must be logged in to generate recovery shares');
        }

        try {
            const trustedDevices = this.deviceTrustManager.getTrustedDevices()
                .filter(device => device.trustLevel >= 70 && device.isActive);

            if (trustedDevices.length < this.threshold) {
                throw new Error(`Need at least ${this.threshold} trusted devices for recovery`);
            }

            // Create the master secret (combination of identity private key and a random salt)
            const identityPrivateKey = this.identityManager.userIdentity.identityKeyPair.privateKey;
            const recoverySalt = sodium.randombytes_buf(32);
            
            // Combine identity key and salt to create master secret
            const masterSecret = new Uint8Array(64);
            masterSecret.set(identityPrivateKey);
            masterSecret.set(recoverySalt, 32);

            // Generate shares using Shamir's Secret Sharing
            const shares = this.shamirSecretShare(masterSecret, this.totalShares, this.threshold);

            // Distribute shares to trusted devices
            const shareDistribution = new Map();
            const deviceList = trustedDevices.slice(0, this.totalShares);

            for (let i = 0; i < Math.min(shares.length, deviceList.length); i++) {
                const device = deviceList[i];
                const share = shares[i];
                
                // Encrypt share with device-specific key
                const encryptedShare = await this.encryptShareForDevice(share, device);
                
                shareDistribution.set(device.deviceId, {
                    shareIndex: i + 1,
                    encryptedShare,
                    deviceId: device.deviceId,
                    deviceName: device.displayName,
                    created: Date.now(),
                    isBackup: false
                });
            }

            // Store share distribution
            this.recoveryShares = shareDistribution;
            await this.saveRecoveryShares();

            console.log(`🔐 Generated ${shares.length} recovery shares for ${deviceList.length} devices`);
            
            return {
                totalShares: shares.length,
                threshold: this.threshold,
                devices: deviceList.map(d => ({
                    deviceId: d.deviceId,
                    displayName: d.displayName,
                    trustLevel: d.trustLevel
                }))
            };

        } catch (error) {
            console.error('Failed to generate recovery shares:', error);
            throw new Error(`Recovery share generation failed: ${error.message}`);
        }
    }

    // Initiate account recovery process
    async initiateRecovery(recoveryType, recoveryData = {}) {
        try {
            const recoveryId = sodium.to_hex(sodium.randombytes_buf(16));
            const currentTime = Date.now();

            // Create recovery session
            const recoverySession = {
                recoveryId,
                recoveryType,
                recoveryData,
                initiatedBy: {
                    deviceId: this.identityManager.deviceId,
                    timestamp: currentTime,
                    userAgent: navigator.userAgent.substring(0, 100),
                    ipAddress: 'unknown' // Would be detected by server in real implementation
                },
                status: 'PENDING_APPROVALS',
                requiredApprovals: this.threshold,
                receivedApprovals: 0,
                approvalDevices: [],
                collectedShares: [],
                expiryTime: currentTime + this.recoveryTimeout,
                created: currentTime
            };

            // Store recovery session
            this.pendingRecoveries.set(recoveryId, recoverySession);

            // Send recovery requests to trusted devices
            await this.sendRecoveryRequests(recoverySession);

            console.log(`🔐 Recovery initiated: ${recoveryType} (${recoveryId})`);

            return {
                recoveryId,
                recoveryType,
                requiredApprovals: this.threshold,
                expiryTime: recoverySession.expiryTime
            };

        } catch (error) {
            console.error('Failed to initiate recovery:', error);
            throw new Error(`Recovery initiation failed: ${error.message}`);
        }
    }

    // Send recovery requests to trusted devices
    async sendRecoveryRequests(recoverySession) {
        const trustedDevices = this.deviceTrustManager.getTrustedDevices()
            .filter(device => device.trustLevel >= 70 && device.isActive);

        for (const device of trustedDevices) {
            if (this.recoveryShares.has(device.deviceId)) {
                try {
                    const recoveryRequest = {
                        type: 'RECOVERY_REQUEST',
                        recoveryId: recoverySession.recoveryId,
                        recoveryType: recoverySession.recoveryType,
                        requestedBy: recoverySession.initiatedBy,
                        timestamp: Date.now(),
                        expiryTime: recoverySession.expiryTime,
                        deviceInfo: {
                            deviceId: device.deviceId,
                            displayName: device.displayName,
                            hasShare: true
                        }
                    };

                    // In a real implementation, this would be sent via WebRTC or similar P2P mechanism
                    await this.sendRecoveryRequestToDevice(device.deviceId, recoveryRequest);

                } catch (error) {
                    console.error(`Failed to send recovery request to ${device.deviceId}:`, error);
                }
            }
        }
    }

    // Handle recovery request approval from a device
    async approveRecoveryRequest(recoveryId, approvalData) {
        try {
            const recoverySession = this.pendingRecoveries.get(recoveryId);
            if (!recoverySession) {
                throw new Error('Recovery session not found or expired');
            }

            if (recoverySession.status !== 'PENDING_APPROVALS') {
                throw new Error('Recovery is not in approval phase');
            }

            if (Date.now() > recoverySession.expiryTime) {
                throw new Error('Recovery session has expired');
            }

            const approvingDevice = approvalData.deviceId;
            
            // Check if device already approved
            if (recoverySession.approvalDevices.includes(approvingDevice)) {
                throw new Error('Device has already approved this recovery');
            }

            // Verify approval signature
            if (!await this.verifyRecoveryApproval(recoverySession, approvalData)) {
                throw new Error('Invalid recovery approval signature');
            }

            // Add approval
            recoverySession.approvalDevices.push(approvingDevice);
            recoverySession.receivedApprovals++;

            // Collect the recovery share from this device
            const deviceShare = this.recoveryShares.get(approvingDevice);
            if (deviceShare) {
                const decryptedShare = await this.decryptShareFromDevice(deviceShare, approvalData);
                recoverySession.collectedShares.push({
                    deviceId: approvingDevice,
                    shareIndex: deviceShare.shareIndex,
                    shareData: decryptedShare,
                    timestamp: Date.now()
                });
            }

            console.log(`✅ Recovery approval from ${approvingDevice} (${recoverySession.receivedApprovals}/${recoverySession.requiredApprovals})`);

            // Check if we have enough approvals
            if (recoverySession.receivedApprovals >= recoverySession.requiredApprovals) {
                recoverySession.status = 'READY_FOR_RECOVERY';
                await this.processRecovery(recoverySession);
            }

            return {
                success: true,
                receivedApprovals: recoverySession.receivedApprovals,
                requiredApprovals: recoverySession.requiredApprovals,
                readyForRecovery: recoverySession.status === 'READY_FOR_RECOVERY'
            };

        } catch (error) {
            console.error('Failed to approve recovery request:', error);
            throw new Error(`Recovery approval failed: ${error.message}`);
        }
    }

    // Process recovery once enough approvals are collected
    async processRecovery(recoverySession) {
        try {
            if (recoverySession.collectedShares.length < this.threshold) {
                throw new Error('Insufficient shares for recovery');
            }

            console.log('🔐 Processing recovery with collected shares...');

            // Reconstruct the master secret using Shamir's Secret Sharing
            const shares = recoverySession.collectedShares.map(share => ({
                index: share.shareIndex,
                data: share.shareData
            }));

            const reconstructedSecret = this.shamirSecretReconstruct(shares);
            
            // Extract identity private key and recovery salt
            const identityPrivateKey = reconstructedSecret.slice(0, 32);
            const recoverySalt = reconstructedSecret.slice(32, 64);

            // Reconstruct the identity
            const recoveredIdentity = await this.reconstructIdentityFromKey(identityPrivateKey);

            recoverySession.status = 'COMPLETED';
            recoverySession.completedAt = Date.now();
            recoverySession.recoveredIdentity = {
                publicKey: recoveredIdentity.publicKey,
                displayName: recoveredIdentity.displayName,
                deviceId: recoveredIdentity.deviceId
            };

            // Clear the reconstructed secret from memory
            sodium.memzero(reconstructedSecret);

            console.log('✅ Recovery completed successfully');

            return {
                success: true,
                recoveredIdentity: recoverySession.recoveredIdentity,
                recoveryType: recoverySession.recoveryType
            };

        } catch (error) {
            console.error('Failed to process recovery:', error);
            recoverySession.status = 'FAILED';
            recoverySession.error = error.message;
            throw error;
        }
    }

    // Shamir's Secret Sharing implementation
    shamirSecretShare(secret, totalShares, threshold) {
        // Simplified implementation - in production, use a proper cryptographic library
        const shares = [];
        const polynomial = this.generatePolynomial(secret, threshold - 1);
        
        for (let i = 1; i <= totalShares; i++) {
            const shareValue = this.evaluatePolynomial(polynomial, i);
            shares.push({
                index: i,
                data: shareValue
            });
        }
        
        return shares;
    }

    shamirSecretReconstruct(shares) {
        // Simplified implementation - in production, use a proper cryptographic library
        if (shares.length < this.threshold) {
            throw new Error('Insufficient shares for reconstruction');
        }
        
        // Use Lagrange interpolation to reconstruct the secret
        const secret = this.lagrangeInterpolation(shares, 0);
        return secret;
    }

    // Generate polynomial coefficients
    generatePolynomial(secret, degree) {
        const coefficients = [secret]; // Constant term is the secret
        
        for (let i = 0; i < degree; i++) {
            coefficients.push(sodium.randombytes_buf(secret.length));
        }
        
        return coefficients;
    }

    // Evaluate polynomial at point x
    evaluatePolynomial(polynomial, x) {
        let result = new Uint8Array(polynomial[0].length);
        
        for (let i = 0; i < polynomial.length; i++) {
            const coefficient = polynomial[i];
            const power = Math.pow(x, i);
            
            // Simplified arithmetic in GF(256) - use proper field arithmetic in production
            for (let j = 0; j < coefficient.length; j++) {
                result[j] ^= (coefficient[j] * power) & 0xFF;
            }
        }
        
        return result;
    }

    // Lagrange interpolation for reconstruction
    lagrangeInterpolation(shares, x) {
        const result = new Uint8Array(shares[0].data.length);
        
        for (let i = 0; i < shares.length; i++) {
            let numerator = 1;
            let denominator = 1;
            
            for (let j = 0; j < shares.length; j++) {
                if (i !== j) {
                    numerator *= (x - shares[j].index);
                    denominator *= (shares[i].index - shares[j].index);
                }
            }
            
            const coefficient = numerator / denominator;
            
            for (let k = 0; k < shares[i].data.length; k++) {
                result[k] ^= (shares[i].data[k] * coefficient) & 0xFF;
            }
        }
        
        return result;
    }

    // Encrypt recovery share for specific device
    async encryptShareForDevice(share, device) {
        const deviceAuthKeys = this.deviceTrustManager.getDeviceAuthKeys(device.deviceId);
        if (!deviceAuthKeys) {
            throw new Error('Device authorization keys not found');
        }

        const nonce = sodium.randombytes_buf(24);
        const shareData = new Uint8Array(share.data.length + 1);
        shareData[0] = share.index;
        shareData.set(share.data, 1);

        const encryptedShare = sodium.crypto_box_easy(
            shareData,
            nonce,
            deviceAuthKeys.publicKey,
            deviceAuthKeys.privateKey
        );

        return {
            ciphertext: sodium.to_base64(encryptedShare),
            nonce: sodium.to_base64(nonce),
            deviceId: device.deviceId,
            timestamp: Date.now()
        };
    }

    // Decrypt recovery share from device
    async decryptShareFromDevice(encryptedShare, approvalData) {
        const deviceAuthKeys = this.deviceTrustManager.getDeviceAuthKeys(approvalData.deviceId);
        if (!deviceAuthKeys) {
            throw new Error('Device authorization keys not found');
        }

        const ciphertext = sodium.from_base64(encryptedShare.encryptedShare.ciphertext);
        const nonce = sodium.from_base64(encryptedShare.encryptedShare.nonce);

        const decryptedData = sodium.crypto_box_open_easy(
            ciphertext,
            nonce,
            deviceAuthKeys.publicKey,
            deviceAuthKeys.privateKey
        );

        const shareIndex = decryptedData[0];
        const shareData = decryptedData.slice(1);

        return {
            index: shareIndex,
            data: shareData
        };
    }

    // Reconstruct identity from private key
    async reconstructIdentityFromKey(privateKey) {
        // Generate public key from private key
        const keyPair = sodium.crypto_sign_seed_keypair(privateKey);
        
        return {
            publicKey: sodium.to_hex(keyPair.publicKey),
            privateKey: keyPair.privateKey,
            displayName: 'Recovered Identity', // Would need to be stored separately
            deviceId: this.identityManager.deviceId
        };
    }

    // Verify recovery approval signature
    async verifyRecoveryApproval(recoverySession, approvalData) {
        try {
            const device = this.deviceTrustManager.getDevice(approvalData.deviceId);
            if (!device) {
                return false;
            }

            const approvalMessage = JSON.stringify({
                recoveryId: recoverySession.recoveryId,
                approvalTimestamp: approvalData.timestamp,
                deviceId: approvalData.deviceId
            });

            return this.identityManager.verifySignature(
                approvalMessage,
                approvalData.signature,
                device.publicKey
            );

        } catch (error) {
            console.error('Failed to verify recovery approval:', error);
            return false;
        }
    }

    // Send recovery request to device (placeholder for P2P communication)
    async sendRecoveryRequestToDevice(deviceId, recoveryRequest) {
        // In a real implementation, this would use WebRTC data channels or similar P2P mechanism
        console.log(`📤 Sending recovery request to device ${deviceId}:`, recoveryRequest);
        
        // For now, we'll simulate this by storing the request locally
        // In practice, this would be sent through the established sync connection
    }

    // Generate initial recovery shares if none exist
    async generateInitialShares() {
        if (this.recoveryShares.size === 0) {
            try {
                await this.generateRecoveryShares();
            } catch (error) {
                console.log('Skipping initial share generation:', error.message);
            }
        }
    }

    // Save recovery shares to encrypted storage
    async saveRecoveryShares() {
        try {
            if (!this.identityManager.isLoggedIn) {
                return;
            }

            const sharesData = {
                shares: Array.from(this.recoveryShares.entries()),
                threshold: this.threshold,
                totalShares: this.totalShares,
                lastUpdated: Date.now()
            };

            const storageKey = await this.deriveRecoveryStorageKey();
            const encryptedData = await this.encryptStorageData(JSON.stringify(sharesData), storageKey);
            
            localStorage.setItem('cipherwave_recovery_shares', encryptedData);

        } catch (error) {
            console.error('Failed to save recovery shares:', error);
        }
    }

    // Load recovery shares from encrypted storage
    async loadRecoveryShares() {
        try {
            if (!this.identityManager.isLoggedIn) {
                return;
            }

            const encryptedData = localStorage.getItem('cipherwave_recovery_shares');
            if (!encryptedData) {
                return;
            }

            const storageKey = await this.deriveRecoveryStorageKey();
            const decryptedData = await this.decryptStorageData(encryptedData, storageKey);
            
            const sharesData = JSON.parse(decryptedData);
            
            this.threshold = sharesData.threshold;
            this.totalShares = sharesData.totalShares;
            
            for (const [deviceId, shareData] of sharesData.shares) {
                this.recoveryShares.set(deviceId, shareData);
            }

            console.log(`🔐 Loaded recovery shares for ${this.recoveryShares.size} devices`);

        } catch (error) {
            console.error('Failed to load recovery shares:', error);
        }
    }

    // Derive storage key for recovery data
    async deriveRecoveryStorageKey() {
        return sodium.crypto_kdf_derive_from_key(
            32, // 256-bit key
            4,  // subkey ID for recovery storage
            'recovery',
            this.identityManager.userIdentity.identityKeyPair.privateKey.slice(0, 32)
        );
    }

    // Storage encryption helpers
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

    // Get recovery status
    getRecoveryStatus() {
        return {
            sharesGenerated: this.recoveryShares.size,
            threshold: this.threshold,
            totalShares: this.totalShares,
            trustedDevices: this.deviceTrustManager.getTrustedDevices().length,
            pendingRecoveries: this.pendingRecoveries.size,
            isRecoveryReady: this.recoveryShares.size >= this.threshold
        };
    }

    // Cancel recovery process
    async cancelRecovery(recoveryId) {
        const recoverySession = this.pendingRecoveries.get(recoveryId);
        if (recoverySession) {
            recoverySession.status = 'CANCELLED';
            recoverySession.cancelledAt = Date.now();
            
            // Notify participating devices
            // In practice, this would send cancellation messages via P2P
            
            console.log(`❌ Recovery cancelled: ${recoveryId}`);
            return true;
        }
        return false;
    }

    // Get pending recoveries
    getPendingRecoveries() {
        return Array.from(this.pendingRecoveries.values());
    }

    // Cleanup and destroy
    async destroy() {
        // Clear sensitive data from memory
        for (const [_, share] of this.recoveryShares.entries()) {
            if (share.encryptedShare && share.encryptedShare.data) {
                sodium.memzero(share.encryptedShare.data);
            }
        }
        
        this.recoveryShares.clear();
        this.pendingRecoveries.clear();

        console.log('🗑️ Recovery manager destroyed');
    }
}