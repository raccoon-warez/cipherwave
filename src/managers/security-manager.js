// CipherWave Security Manager - Optimized with single crypto library
// Uses only libsodium-wrappers for better performance and smaller bundle size

import sodium from 'libsodium-wrappers';

export class SecurityManager {
    constructor() {
        this.isInitialized = false;
        this.identityKeys = null;
        this.ephemeralKeys = null;
        this.sessionKey = null;
        this.peerPublicKey = null;
        this.currentCipher = 'chacha20-poly1305';
        
        // Supported ciphers (all using libsodium)
        this.supportedCiphers = {
            'chacha20-poly1305': {
                keyLength: 32,
                nonceLength: 12,
                encrypt: this.encryptChaCha20Poly1305.bind(this),
                decrypt: this.decryptChaCha20Poly1305.bind(this)
            },
            'aes': {
                keyLength: 32,
                nonceLength: 12,
                encrypt: this.encryptAES256GCM.bind(this),
                decrypt: this.decryptAES256GCM.bind(this)
            }
        };
        
        // Performance metrics
        this.metrics = {
            encryptionTime: 0,
            decryptionTime: 0,
            keyGenerationTime: 0
        };
    }
    
    async initialize() {
        console.log('🔐 Initializing security manager with libsodium...');
        const startTime = performance.now();
        
        try {
            // Wait for libsodium to be ready
            await sodium.ready;
            
            // Generate identity keys (Ed25519 for signing)
            this.identityKeys = sodium.crypto_sign_keypair();
            
            // Generate ephemeral keys (X25519 for key exchange)
            this.ephemeralKeys = sodium.crypto_box_keypair();
            
            this.isInitialized = true;
            
            this.metrics.keyGenerationTime = performance.now() - startTime;
            console.log(`✅ Security manager initialized (${this.metrics.keyGenerationTime.toFixed(2)}ms)`);
            
        } catch (error) {
            console.error('❌ Failed to initialize security manager:', error);
            throw new Error(`Security initialization failed: ${error.message}`);
        }
    }
    
    async setCipher(cipherName) {
        if (!this.supportedCiphers[cipherName]) {
            throw new Error(`Unsupported cipher: ${cipherName}`);
        }
        
        this.currentCipher = cipherName;
        console.log(`🔒 Switched to cipher: ${cipherName}`);
    }
    
    // Key exchange using X25519
    async performKeyExchange(peerPublicKey) {
        if (!this.isInitialized) {
            throw new Error('Security manager not initialized');
        }
        
        try {
            // Convert peer public key if it's a string
            const peerKey = typeof peerPublicKey === 'string' 
                ? sodium.from_hex(peerPublicKey)
                : peerPublicKey;
            
            // Perform ECDH key exchange
            const sharedSecret = sodium.crypto_box_beforenm(
                peerKey,
                this.ephemeralKeys.privateKey
            );
            
            // Derive session key using HKDF
            this.sessionKey = sodium.crypto_kdf_derive_from_key(
                32, // 256-bit key
                1,  // subkey ID
                'CipherWv', // context (8 bytes)
                sharedSecret
            );
            
            this.peerPublicKey = peerKey;
            
            console.log('🤝 Key exchange completed');
            return sodium.to_hex(this.ephemeralKeys.publicKey);
            
        } catch (error) {
            console.error('Key exchange failed:', error);
            throw new Error(`Key exchange failed: ${error.message}`);
        }
    }
    
    // Encrypt message using current cipher
    async encryptMessage(plaintext) {
        if (!this.sessionKey) {
            throw new Error('No session key available');
        }
        
        const startTime = performance.now();
        
        try {
            const cipher = this.supportedCiphers[this.currentCipher];
            const result = await cipher.encrypt(plaintext);
            
            this.metrics.encryptionTime = performance.now() - startTime;
            
            return {
                ciphertext: sodium.to_base64(result.ciphertext),
                nonce: sodium.to_base64(result.nonce),
                cipher: this.currentCipher,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }
    
    // Decrypt message
    async decryptMessage(encryptedData) {
        if (!this.sessionKey) {
            throw new Error('No session key available');
        }
        
        const startTime = performance.now();
        
        try {
            const cipher = this.supportedCiphers[encryptedData.cipher];
            if (!cipher) {
                throw new Error(`Unsupported cipher: ${encryptedData.cipher}`);
            }
            
            const ciphertext = sodium.from_base64(encryptedData.ciphertext);
            const nonce = sodium.from_base64(encryptedData.nonce);
            
            const plaintext = await cipher.decrypt(ciphertext, nonce);
            
            this.metrics.decryptionTime = performance.now() - startTime;
            
            return {
                text: sodium.to_string(plaintext),
                timestamp: encryptedData.timestamp,
                cipher: encryptedData.cipher
            };
            
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }
    
    // ChaCha20-Poly1305 encryption (recommended)
    async encryptChaCha20Poly1305(plaintext) {
        const nonce = sodium.randombytes_buf(12); // 96-bit nonce
        const message = sodium.from_string(plaintext);
        
        const ciphertext = sodium.crypto_secretbox_easy(
            message,
            nonce,
            this.sessionKey
        );
        
        return { ciphertext, nonce };
    }
    
    async decryptChaCha20Poly1305(ciphertext, nonce) {
        return sodium.crypto_secretbox_open_easy(
            ciphertext,
            nonce,
            this.sessionKey
        );
    }
    
    // AES-256-GCM encryption (fallback)
    async encryptAES256GCM(plaintext) {
        const nonce = sodium.randombytes_buf(12); // 96-bit nonce
        const message = sodium.from_string(plaintext);
        
        const ciphertext = sodium.crypto_aead_aes256gcm_encrypt(
            message,
            null, // no additional data
            null, // no secret nonce
            nonce,
            this.sessionKey
        );
        
        return { ciphertext, nonce };
    }
    
    async decryptAES256GCM(ciphertext, nonce) {
        return sodium.crypto_aead_aes256gcm_decrypt(
            null, // no secret nonce
            ciphertext,
            null, // no additional data
            nonce,
            this.sessionKey
        );
    }
    
    // Utility methods
    generateNonce(length = 12) {
        return sodium.randombytes_buf(length);
    }
    
    generateRoomId() {
        return sodium.to_hex(sodium.randombytes_buf(16)).toUpperCase();
    }
    
    getPublicKey() {
        if (!this.ephemeralKeys) {
            throw new Error('Keys not generated');
        }
        return sodium.to_hex(this.ephemeralKeys.publicKey);
    }
    
    getIdentityPublicKey() {
        if (!this.identityKeys) {
            throw new Error('Identity keys not generated');
        }
        return sodium.to_hex(this.identityKeys.publicKey);
    }
    
    // Sign data with identity key
    signData(data) {
        if (!this.identityKeys) {
            throw new Error('Identity keys not available');
        }
        
        const message = typeof data === 'string' ? sodium.from_string(data) : data;
        return sodium.crypto_sign_detached(message, this.identityKeys.privateKey);
    }
    
    // Verify signature
    verifySignature(data, signature, publicKey) {
        const message = typeof data === 'string' ? sodium.from_string(data) : data;
        const sigBytes = typeof signature === 'string' ? sodium.from_hex(signature) : signature;
        const pubKey = typeof publicKey === 'string' ? sodium.from_hex(publicKey) : publicKey;
        
        return sodium.crypto_sign_verify_detached(sigBytes, message, pubKey);
    }
    
    // Get performance metrics
    getMetrics() {
        return { ...this.metrics };
    }
    
    // Clear sensitive data
    destroy() {
        if (this.sessionKey) {
            sodium.memzero(this.sessionKey);
            this.sessionKey = null;
        }
        
        if (this.ephemeralKeys) {
            sodium.memzero(this.ephemeralKeys.privateKey);
            this.ephemeralKeys = null;
        }
        
        if (this.identityKeys) {
            sodium.memzero(this.identityKeys.privateKey);
            this.identityKeys = null;
        }
        
        this.peerPublicKey = null;
        this.isInitialized = false;
        
        console.log('🗑️ Security manager destroyed');
    }
}