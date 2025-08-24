// CipherWave Identity Manager - Handles persistent user identity and authentication
// Extends SecurityManager to provide decentralized user authentication

import sodium from 'libsodium-wrappers';
import { SecurityManager } from './security-manager.js';

export class IdentityManager extends SecurityManager {
    constructor() {
        super();
        this.userIdentity = null;
        this.isLoggedIn = false;
        this.storageKey = 'cipherwave_identity';
        this.trustedContacts = new Map();
        this.deviceId = null;
        
        // Password-based key derivation settings
        this.pbkdf2Settings = {
            iterations: 100000,
            keyLength: 32,
            algorithm: 'SHA-256'
        };
    }

    async initialize() {
        await super.initialize();
        this.deviceId = await this.generateDeviceId();
        console.log('🆔 Identity manager initialized');
    }

    // Generate or load existing user identity
    async createIdentity(password, displayName = 'Anonymous') {
        if (!this.isInitialized) {
            throw new Error('Identity manager not initialized');
        }

        try {
            const startTime = performance.now();

            // Generate long-term Ed25519 identity keys
            const identityKeyPair = sodium.crypto_sign_keypair();
            
            // Create identity object
            this.userIdentity = {
                identityKeyPair,
                profileData: {
                    displayName,
                    publicKey: sodium.to_hex(identityKeyPair.publicKey),
                    created: Date.now(),
                    deviceId: this.deviceId
                },
                deviceKeys: [this.ephemeralKeys], // Current session keys
                trustedContacts: new Map()
            };

            // Encrypt and store identity
            await this.storeIdentitySecurely(password);
            
            this.isLoggedIn = true;
            
            const duration = performance.now() - startTime;
            console.log(`✅ Identity created (${duration.toFixed(2)}ms)`);
            
            return {
                publicKey: this.userIdentity.profileData.publicKey,
                displayName: this.userIdentity.profileData.displayName,
                deviceId: this.deviceId
            };
            
        } catch (error) {
            console.error('❌ Failed to create identity:', error);
            throw new Error(`Identity creation failed: ${error.message}`);
        }
    }

    // Login with existing identity
    async loginWithPassword(password) {
        if (!this.isInitialized) {
            throw new Error('Identity manager not initialized');
        }

        try {
            const encryptedData = localStorage.getItem(this.storageKey);
            if (!encryptedData) {
                throw new Error('No stored identity found');
            }

            // Decrypt stored identity
            this.userIdentity = await this.decryptStoredIdentity(password, encryptedData);
            this.isLoggedIn = true;

            // Regenerate ephemeral keys for this session
            this.ephemeralKeys = sodium.crypto_box_keypair();
            this.userIdentity.deviceKeys = [this.ephemeralKeys];

            console.log('🔓 Successfully logged in');
            
            return {
                publicKey: this.userIdentity.profileData.publicKey,
                displayName: this.userIdentity.profileData.displayName,
                deviceId: this.deviceId
            };

        } catch (error) {
            console.error('❌ Login failed:', error);
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    // Enhanced key exchange with identity verification
    async performAuthenticatedKeyExchange(peerPublicKey, peerIdentityKey) {
        if (!this.isLoggedIn) {
            throw new Error('User not logged in');
        }

        try {
            // Perform standard key exchange
            const ourPublicKey = await super.performKeyExchange(peerPublicKey);

            // Create and sign challenge for peer verification
            const challenge = sodium.randombytes_buf(32);
            const challengeHex = sodium.to_hex(challenge);
            const challengeSignature = this.signWithIdentity(challengeHex);

            // Return data for peer verification
            return {
                ephemeralPublicKey: ourPublicKey,
                identityPublicKey: this.userIdentity.profileData.publicKey,
                challenge: challengeHex,
                challengeSignature: sodium.to_hex(challengeSignature),
                displayName: this.userIdentity.profileData.displayName
            };

        } catch (error) {
            console.error('Authenticated key exchange failed:', error);
            throw new Error(`Authenticated key exchange failed: ${error.message}`);
        }
    }

    // Verify peer's identity during key exchange
    async verifyPeerIdentity(peerData) {
        if (!peerData.identityPublicKey || !peerData.challenge || !peerData.challengeSignature) {
            throw new Error('Incomplete peer identity data');
        }

        try {
            // Verify peer's challenge signature
            const isValid = this.verifySignature(
                peerData.challenge,
                peerData.challengeSignature,
                peerData.identityPublicKey
            );

            if (!isValid) {
                throw new Error('Invalid peer identity signature');
            }

            // Check if this peer is trusted
            const trustLevel = this.trustedContacts.get(peerData.identityPublicKey) || 0;

            console.log(`✅ Peer identity verified (trust level: ${trustLevel})`);
            
            return {
                verified: true,
                identityKey: peerData.identityPublicKey,
                displayName: peerData.displayName || 'Unknown',
                trustLevel
            };

        } catch (error) {
            console.error('Peer identity verification failed:', error);
            return {
                verified: false,
                error: error.message
            };
        }
    }

    // Sign data with user's identity key
    signWithIdentity(data) {
        if (!this.userIdentity) {
            throw new Error('No user identity available');
        }

        const message = typeof data === 'string' ? sodium.from_string(data) : data;
        return sodium.crypto_sign_detached(message, this.userIdentity.identityKeyPair.privateKey);
    }

    // Add or update trusted contact
    addTrustedContact(identityKey, displayName, initialTrust = 10) {
        if (!this.isLoggedIn) {
            throw new Error('User not logged in');
        }

        this.trustedContacts.set(identityKey, {
            displayName,
            trustLevel: Math.min(100, Math.max(0, initialTrust)),
            firstContact: Date.now(),
            lastInteraction: Date.now(),
            interactionCount: 1
        });

        this.userIdentity.trustedContacts = this.trustedContacts;
        console.log(`👥 Added trusted contact: ${displayName} (trust: ${initialTrust})`);
    }

    // Update trust level based on interaction
    updateTrustLevel(identityKey, delta) {
        const contact = this.trustedContacts.get(identityKey);
        if (!contact) {
            return false;
        }

        contact.trustLevel = Math.min(100, Math.max(0, contact.trustLevel + delta));
        contact.lastInteraction = Date.now();
        contact.interactionCount++;
        
        this.trustedContacts.set(identityKey, contact);
        return true;
    }

    // Store identity securely with password-based encryption
    async storeIdentitySecurely(password) {
        try {
            // Derive key from password
            const salt = sodium.randombytes_buf(16);
            const key = await this.deriveKeyFromPassword(password, salt);

            // Serialize identity data
            const identityData = {
                identityKeyPair: {
                    publicKey: sodium.to_hex(this.userIdentity.identityKeyPair.publicKey),
                    privateKey: sodium.to_hex(this.userIdentity.identityKeyPair.privateKey)
                },
                profileData: this.userIdentity.profileData,
                trustedContacts: Array.from(this.userIdentity.trustedContacts.entries())
            };

            const plaintext = JSON.stringify(identityData);
            const nonce = sodium.randombytes_buf(12);
            
            // Encrypt with AES-256-GCM
            const ciphertext = sodium.crypto_aead_aes256gcm_encrypt(
                plaintext,
                null,
                null,
                nonce,
                key
            );

            // Store encrypted data
            const encryptedPackage = {
                ciphertext: sodium.to_base64(ciphertext),
                nonce: sodium.to_base64(nonce),
                salt: sodium.to_base64(salt),
                version: '1.0'
            };

            localStorage.setItem(this.storageKey, JSON.stringify(encryptedPackage));

            // Clear key from memory
            sodium.memzero(key);

        } catch (error) {
            throw new Error(`Failed to store identity: ${error.message}`);
        }
    }

    // Decrypt stored identity
    async decryptStoredIdentity(password, encryptedData) {
        try {
            const package_ = JSON.parse(encryptedData);
            const salt = sodium.from_base64(package_.salt);
            const nonce = sodium.from_base64(package_.nonce);
            const ciphertext = sodium.from_base64(package_.ciphertext);

            // Derive key from password
            const key = await this.deriveKeyFromPassword(password, salt);

            // Decrypt data
            const plaintext = sodium.crypto_aead_aes256gcm_decrypt(
                null,
                ciphertext,
                null,
                nonce,
                key
            );

            // Parse identity data
            const identityData = JSON.parse(sodium.to_string(plaintext));
            
            // Reconstruct identity object
            const identity = {
                identityKeyPair: {
                    publicKey: sodium.from_hex(identityData.identityKeyPair.publicKey),
                    privateKey: sodium.from_hex(identityData.identityKeyPair.privateKey)
                },
                profileData: identityData.profileData,
                trustedContacts: new Map(identityData.trustedContacts)
            };

            // Load trusted contacts
            this.trustedContacts = identity.trustedContacts;

            // Clear key from memory
            sodium.memzero(key);

            return identity;

        } catch (error) {
            throw new Error(`Failed to decrypt identity: ${error.message}`);
        }
    }

    // Derive encryption key from password using PBKDF2
    async deriveKeyFromPassword(password, salt) {
        const encoder = new TextEncoder();
        const passwordBytes = encoder.encode(password);

        const importedKey = await crypto.subtle.importKey(
            'raw',
            passwordBytes,
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.pbkdf2Settings.iterations,
                hash: this.pbkdf2Settings.algorithm
            },
            importedKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        const keyBytes = await crypto.subtle.exportKey('raw', derivedKey);
        return new Uint8Array(keyBytes);
    }

    // Generate unique device identifier
    async generateDeviceId() {
        // Try to get existing device ID from localStorage
        let deviceId = localStorage.getItem('cipherwave_device_id');
        
        if (!deviceId) {
            // Generate new device ID using secure random
            const randomBytes = sodium.randombytes_buf(16);
            deviceId = sodium.to_hex(randomBytes);
            localStorage.setItem('cipherwave_device_id', deviceId);
        }
        
        return deviceId;
    }

    // Check if identity exists in storage
    hasStoredIdentity() {
        return localStorage.getItem(this.storageKey) !== null;
    }

    // Logout and clear session
    logout() {
        this.userIdentity = null;
        this.isLoggedIn = false;
        this.trustedContacts.clear();
        
        // Clear session keys but keep identity stored
        if (this.sessionKey) {
            sodium.memzero(this.sessionKey);
            this.sessionKey = null;
        }

        console.log('🔒 Logged out');
    }

    // Delete stored identity permanently
    deleteIdentity() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem('cipherwave_device_id');
        this.logout();
        console.log('🗑️ Identity deleted permanently');
    }

    // Get user profile information
    getUserProfile() {
        if (!this.isLoggedIn) {
            return null;
        }

        return {
            publicKey: this.userIdentity.profileData.publicKey,
            displayName: this.userIdentity.profileData.displayName,
            deviceId: this.deviceId,
            created: this.userIdentity.profileData.created,
            trustedContactsCount: this.trustedContacts.size
        };
    }

    // Enhanced destroy method
    destroy() {
        this.logout();
        super.destroy();
        console.log('🗑️ Identity manager destroyed');
    }
}