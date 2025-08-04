// CipherWave Security Manager
// Handles secure key exchange, authentication, and cryptographic operations

class SecurityManager {
    constructor() {
        this.worker = null;
        this.identityKeys = null; // Ed25519 key pair for identity
        this.ephemeralKeys = null; // X25519 key pair for ECDH
        this.sessionKey = null; // Derived session key
        this.peerPublicKey = null; // Peer's public key
        this.isInitialized = false;
        
        this.initializeWorker();
    }
    
    initializeWorker() {
        try {
            this.worker = new Worker('/crypto-worker.js');
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
            this.worker.onerror = this.handleWorkerError.bind(this);
        } catch (error) {
            console.error('Failed to initialize crypto worker:', error);
            // Fallback to main thread operations
            this.worker = null;
        }
    }
    
    handleWorkerMessage(event) {
        const { success, operation, result, error } = event.data;
        
        if (success) {
            this.resolveWorkerOperation(operation, result);
        } else {
            this.rejectWorkerOperation(operation, error);
        }
    }
    
    handleWorkerError(error) {
        console.error('Crypto worker error:', error);
    }
    
    // Initialize cryptographic keys
    async initialize() {
        try {
            // Generate long-term identity keys (Ed25519)
            this.identityKeys = await this.performCryptoOperation('generateEd25519KeyPair');
            
            // Generate ephemeral keys for this session (X25519)
            this.ephemeralKeys = await this.performCryptoOperation('generateX25519KeyPair');
            
            this.isInitialized = true;
            console.log('Security manager initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize security manager:', error);
            return false;
        }
    }
    
    // Perform cryptographic operation (worker or main thread)
    performCryptoOperation(operation, data = null) {
        return new Promise((resolve, reject) => {
            if (this.worker) {
                // Store resolve/reject for worker callback
                this.workerOperations = this.workerOperations || new Map();
                this.workerOperations.set(operation, { resolve, reject });
                
                this.worker.postMessage({ operation, data });
            } else {
                // Fallback to main thread (not recommended for production)
                this.performMainThreadOperation(operation, data)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }
    
    resolveWorkerOperation(operation, result) {
        if (this.workerOperations && this.workerOperations.has(operation)) {
            const { resolve } = this.workerOperations.get(operation);
            this.workerOperations.delete(operation);
            resolve(result);
        }
    }
    
    rejectWorkerOperation(operation, error) {
        if (this.workerOperations && this.workerOperations.has(operation)) {
            const { reject } = this.workerOperations.get(operation);
            this.workerOperations.delete(operation);
            reject(new Error(error));
        }
    }
    
    // Fallback main thread operations (simplified)
    async performMainThreadOperation(operation, data) {
        switch (operation) {
            case 'generateEd25519KeyPair':
                // Simplified key generation for fallback
                const privateKey = new Uint8Array(32);
                const publicKey = new Uint8Array(32);
                if (window.crypto && window.crypto.getRandomValues) {
                    window.crypto.getRandomValues(privateKey);
                    window.crypto.getRandomValues(publicKey);
                }
                return {
                    privateKey: Array.from(privateKey),
                    publicKey: Array.from(publicKey)
                };
                
            case 'generateX25519KeyPair':
                const x25519Private = new Uint8Array(32);
                const x25519Public = new Uint8Array(32);
                if (window.crypto && window.crypto.getRandomValues) {
                    window.crypto.getRandomValues(x25519Private);
                    window.crypto.getRandomValues(x25519Public);
                }
                return {
                    privateKey: Array.from(x25519Private),
                    publicKey: Array.from(x25519Public)
                };
                
            default:
                throw new Error('Unsupported main thread operation: ' + operation);
        }
    }
    
    // Generate authentication challenge
    generateChallenge() {
        const challenge = new Uint8Array(32);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(challenge);
        }
        return Array.from(challenge);
    }
    
    // Sign authentication challenge
    async signChallenge(challenge) {
        if (!this.identityKeys) {
            throw new Error('Identity keys not initialized');
        }
        
        const challengeString = challenge.join(',');
        return await this.performCryptoOperation('sign', {
            message: challengeString,
            privateKey: this.identityKeys.privateKey
        });
    }
    
    // Verify peer's signature
    async verifySignature(challenge, signature, publicKey) {
        const challengeString = challenge.join(',');
        return await this.performCryptoOperation('verify', {
            message: challengeString,
            signature: signature,
            publicKey: publicKey
        });
    }
    
    // Perform ECDH key exchange
    async performKeyExchange(peerPublicKey) {
        if (!this.ephemeralKeys) {
            throw new Error('Ephemeral keys not initialized');
        }
        
        // Perform ECDH
        const sharedSecret = await this.performCryptoOperation('performECDH', {
            privateKey: this.ephemeralKeys.privateKey,
            publicKey: peerPublicKey
        });
        
        // Derive session key using HKDF
        const info = 'CipherWave-Session-Key-v1';
        this.sessionKey = await this.performCryptoOperation('hkdfDerive', {
            inputKey: sharedSecret,
            salt: null,
            info: Array.from(new TextEncoder().encode(info)),
            length: 32
        });
        
        this.peerPublicKey = peerPublicKey;
        return this.sessionKey;
    }
    
    // Encrypt message with current session
    async encryptMessage(message) {
        if (!this.sessionKey) {
            throw new Error('Session key not established');
        }
        
        // Generate random nonce
        const nonce = new Uint8Array(12);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(nonce);
        }
        
        return await this.performCryptoOperation('encrypt', {
            message: message,
            key: this.sessionKey,
            nonce: Array.from(nonce),
            cipher: 'chacha20-poly1305'
        });
    }
    
    // Decrypt message with current session
    async decryptMessage(encryptedData) {
        if (!this.sessionKey) {
            throw new Error('Session key not established');
        }
        
        const result = await this.performCryptoOperation('decrypt', {
            encryptedData: encryptedData,
            key: this.sessionKey,
            cipher: 'chacha20-poly1305'
        });
        
        return result.message;
    }
    
    // Get public keys for sharing
    getPublicKeys() {
        if (!this.isInitialized) {
            throw new Error('Security manager not initialized');
        }
        
        return {
            identity: this.identityKeys.publicKey,
            ephemeral: this.ephemeralKeys.publicKey
        };
    }
    
    // Validate input to prevent injection attacks
    static validateInput(input, maxLength = 1000) {
        if (typeof input !== 'string') {
            throw new Error('Input must be a string');
        }
        
        if (input.length > maxLength) {
            throw new Error(`Input exceeds maximum length of ${maxLength}`);
        }
        
        // Check for potential XSS patterns
        const xssPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /data:text\/html/gi,
            /vbscript:/gi,
            /onload\s*=/gi,
            /onerror\s*=/gi
        ];
        
        for (const pattern of xssPatterns) {
            if (pattern.test(input)) {
                throw new Error('Input contains potentially malicious content');
            }
        }
        
        return true;
    }
    
    // Sanitize message content
    static sanitizeMessage(message) {
        // Validate input first
        this.validateInput(message, 5000);
        
        // Remove any HTML tags and encode special characters
        return message
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
    
    // Clean up sensitive data
    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        
        // Clear sensitive data
        this.identityKeys = null;
        this.ephemeralKeys = null;
        this.sessionKey = null;
        this.peerPublicKey = null;
        this.isInitialized = false;
        
        if (this.workerOperations) {
            this.workerOperations.clear();
        }
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityManager;
} else {
    window.SecurityManager = SecurityManager;
}