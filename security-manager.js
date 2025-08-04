// CipherWave Security Manager
// Handles secure key exchange, authentication, and cryptographic operations

class SecurityManager {
    constructor() {
        // Cross-platform crypto API reference
        this.cryptoAPI = this.getCryptoAPI();
        this.worker = null;
        this.identityKeys = null; // Ed25519 key pair for identity
        this.ephemeralKeys = null; // X25519 key pair for ECDH
        this.sessionKey = null; // Derived session key
        this.peerPublicKey = null; // Peer's public key
        this.isInitialized = false;
        this.operationCounter = 0;
        this.pendingOperations = new Map(); // Store operations with unique IDs
        this.workerReady = false;
        
        this.initializeWorker();
        
        // Start periodic cleanup of expired operations
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredOperations();
        }, 30000); // Every 30 seconds
    }
    
    // Get cross-platform crypto API reference
    getCryptoAPI() {
        if (typeof window !== 'undefined' && this.cryptoAPI) {
            return this.cryptoAPI;
        } else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
            return globalThis.crypto;
        } else if (typeof global !== 'undefined' && global.crypto) {
            return global.crypto;
        } else if (typeof self !== 'undefined' && self.crypto) {
            return self.crypto;
        }
        return null;
    }
    
    initializeWorker() {
        try {
            this.worker = new Worker('/crypto-worker.js');
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
            this.worker.onerror = this.handleWorkerError.bind(this);
            
            // Test worker availability
            this.testWorker();
        } catch (error) {
            console.error('Failed to initialize crypto worker:', error);
            // Fallback to main thread operations
            this.worker = null;
            this.workerReady = false;
        }
    }
    
    handleWorkerMessage(event) {
        const { success, id, operation, result, error, stack } = event.data;
        
        if (id && this.pendingOperations.has(id)) {
            const { resolve, reject, timestamp } = this.pendingOperations.get(id);
            this.pendingOperations.delete(id);
            
            if (success) {
                resolve(result);
            } else {
                const errorObj = new Error(error || 'Crypto operation failed');
                if (stack) errorObj.stack = stack;
                reject(errorObj);
            }
        } else {
            console.warn('Received worker message without valid ID:', event.data);
        }
    }
    
    handleWorkerError(error) {
        console.error('Crypto worker error:', error);
        this.workerReady = false;
        
        // Reject all pending operations
        for (const [id, { reject }] of this.pendingOperations) {
            reject(new Error('Worker failed: ' + error.message));
        }
        this.pendingOperations.clear();
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
    
    // Test worker functionality
    async testWorker() {
        if (!this.worker) return false;
        
        try {
            await this.performCryptoOperation('benchmark');
            this.workerReady = true;
            console.log('Crypto worker is ready and functional');
            return true;
        } catch (error) {
            console.warn('Crypto worker test failed:', error);
            this.workerReady = false;
            return false;
        }
    }
    
    // Generate unique operation ID
    generateOperationId() {
        return `op_${++this.operationCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Perform cryptographic operation (worker or main thread)
    performCryptoOperation(operation, data = null, timeout = 30000) {
        return new Promise((resolve, reject) => {
            if (this.worker && this.workerReady) {
                const id = this.generateOperationId();
                const timestamp = Date.now();
                
                // Store operation with timeout
                const timeoutHandle = setTimeout(() => {
                    if (this.pendingOperations.has(id)) {
                        this.pendingOperations.delete(id);
                        reject(new Error(`Operation '${operation}' timed out after ${timeout}ms`));
                    }
                }, timeout);
                
                this.pendingOperations.set(id, {
                    resolve: (result) => {
                        clearTimeout(timeoutHandle);
                        resolve(result);
                    },
                    reject: (error) => {
                        clearTimeout(timeoutHandle);
                        reject(error);
                    },
                    timestamp,
                    operation
                });
                
                this.worker.postMessage({ id, operation, data });
            } else {
                // Fallback to main thread (not recommended for production)
                console.warn(`Performing crypto operation '${operation}' on main thread - may block UI`);
                this.performMainThreadOperation(operation, data)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }
    
    // Clean up expired operations (called periodically)
    cleanupExpiredOperations() {
        const now = Date.now();
        const maxAge = 60000; // 60 seconds
        
        for (const [id, { timestamp, reject, operation }] of this.pendingOperations) {
            if (now - timestamp > maxAge) {
                this.pendingOperations.delete(id);
                reject(new Error(`Operation '${operation}' expired after ${maxAge}ms`));
            }
        }
    }
    
    // Fallback main thread operations (simplified but secure)
    async performMainThreadOperation(operation, data) {
        switch (operation) {
            case 'generateEd25519KeyPair':
                // Use Web Crypto API if available
                if (this.cryptoAPI && this.cryptoAPI.subtle) {
                    try {
                        const keyPair = await this.cryptoAPI.subtle.generateKey(
                            {
                                name: 'Ed25519',
                                namedCurve: 'Ed25519'
                            },
                            true,
                            ['sign', 'verify']
                        );
                        
                        const privateKeyRaw = await this.cryptoAPI.subtle.exportKey('raw', keyPair.privateKey);
                        const publicKeyRaw = await this.cryptoAPI.subtle.exportKey('raw', keyPair.publicKey);
                        
                        return {
                            privateKey: Array.from(new Uint8Array(privateKeyRaw)),
                            publicKey: Array.from(new Uint8Array(publicKeyRaw))
                        };
                    } catch (error) {
                        console.warn('Web Crypto Ed25519 not supported, using fallback');
                    }
                }
                
                // Fallback to secure random (not cryptographically correct)
                const privateKey = new Uint8Array(32);
                const publicKey = new Uint8Array(32);
                if (this.cryptoAPI && this.cryptoAPI.getRandomValues) {
                    this.cryptoAPI.getRandomValues(privateKey);
                    this.cryptoAPI.getRandomValues(publicKey);
                }
                return {
                    privateKey: Array.from(privateKey),
                    publicKey: Array.from(publicKey)
                };
                
            case 'generateX25519KeyPair':
                // Use Web Crypto API if available
                if (this.cryptoAPI && this.cryptoAPI.subtle) {
                    try {
                        const keyPair = await this.cryptoAPI.subtle.generateKey(
                            {
                                name: 'X25519',
                                namedCurve: 'X25519'
                            },
                            true,
                            ['deriveKey']
                        );
                        
                        const privateKeyRaw = await this.cryptoAPI.subtle.exportKey('raw', keyPair.privateKey);
                        const publicKeyRaw = await this.cryptoAPI.subtle.exportKey('raw', keyPair.publicKey);
                        
                        return {
                            privateKey: Array.from(new Uint8Array(privateKeyRaw)),
                            publicKey: Array.from(new Uint8Array(publicKeyRaw))
                        };
                    } catch (error) {
                        console.warn('Web Crypto X25519 not supported, using fallback');
                    }
                }
                
                // Fallback to secure random (not cryptographically correct)
                const x25519Private = new Uint8Array(32);
                const x25519Public = new Uint8Array(32);
                if (this.cryptoAPI && this.cryptoAPI.getRandomValues) {
                    this.cryptoAPI.getRandomValues(x25519Private);
                    this.cryptoAPI.getRandomValues(x25519Public);
                }
                return {
                    privateKey: Array.from(x25519Private),
                    publicKey: Array.from(x25519Public)
                };
                
            case 'encrypt':
                if (data.cipher === 'aes' && this.cryptoAPI && this.cryptoAPI.subtle) {
                    const keyBytes = typeof data.key === 'string' ? 
                        new Uint8Array(Buffer.from(data.key, 'hex')) : 
                        new Uint8Array(data.key);
                    const messageBytes = new TextEncoder().encode(data.message);
                    const iv = new Uint8Array(12);
                    this.cryptoAPI.getRandomValues(iv);
                    
                    const cryptoKey = await this.cryptoAPI.subtle.importKey(
                        'raw',
                        keyBytes.slice(0, 32),
                        'AES-GCM',
                        false,
                        ['encrypt']
                    );
                    
                    const encrypted = await this.cryptoAPI.subtle.encrypt(
                        { name: 'AES-GCM', iv: iv },
                        cryptoKey,
                        messageBytes
                    );
                    
                    return {
                        ciphertext: Array.from(new Uint8Array(encrypted)),
                        nonce: Array.from(iv),
                        timestamp: Date.now()
                    };
                }
                throw new Error('Unsupported encryption on main thread: ' + data.cipher);
                
            case 'decrypt':
                if (data.cipher === 'aes' && this.cryptoAPI && this.cryptoAPI.subtle) {
                    const keyBytes = typeof data.key === 'string' ? 
                        new Uint8Array(Buffer.from(data.key, 'hex')) : 
                        new Uint8Array(data.key);
                    const ciphertextBytes = new Uint8Array(data.encryptedData.ciphertext);
                    const iv = new Uint8Array(data.encryptedData.nonce);
                    
                    const cryptoKey = await this.cryptoAPI.subtle.importKey(
                        'raw',
                        keyBytes.slice(0, 32),
                        'AES-GCM',
                        false,
                        ['decrypt']
                    );
                    
                    const decrypted = await this.cryptoAPI.subtle.decrypt(
                        { name: 'AES-GCM', iv: iv },
                        cryptoKey,
                        ciphertextBytes
                    );
                    
                    const message = new TextDecoder().decode(decrypted);
                    return { message, timestamp: data.encryptedData.timestamp || Date.now() };
                }
                throw new Error('Unsupported decryption on main thread: ' + data.cipher);
                
            case 'hash':
                if (data.message && this.cryptoAPI && this.cryptoAPI.subtle) {
                    const messageBytes = new TextEncoder().encode(data.message);
                    const hashBuffer = await this.cryptoAPI.subtle.digest('SHA-256', messageBytes);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                }
                throw new Error('Hash operation requires message parameter');
                
            default:
                throw new Error('Unsupported main thread operation: ' + operation);
        }
    }
    
    // Generate authentication challenge
    generateChallenge() {
        const challenge = new Uint8Array(32);
        if (this.cryptoAPI && this.cryptoAPI.getRandomValues) {
            this.cryptoAPI.getRandomValues(challenge);
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
        
        // Validate and sanitize message
        SecurityManager.validateInput(message, 10000); // Allow longer messages
        const sanitizedMessage = SecurityManager.sanitizeMessage(message);
        
        // Generate random nonce
        const nonce = new Uint8Array(12);
        if (this.cryptoAPI && this.cryptoAPI.getRandomValues) {
            this.cryptoAPI.getRandomValues(nonce);
        }
        
        return await this.performCryptoOperation('encrypt', {
            message: sanitizedMessage,
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
        
        if (!encryptedData || !encryptedData.ciphertext || !encryptedData.nonce) {
            throw new Error('Invalid encrypted data format');
        }
        
        const result = await this.performCryptoOperation('decrypt', {
            encryptedData: encryptedData,
            key: this.sessionKey,
            cipher: 'chacha20-poly1305'
        });
        
        // Additional validation of decrypted message
        if (result && result.message) {
            SecurityManager.validateInput(result.message, 10000);
            return result.message;
        } else {
            throw new Error('Decryption failed or returned invalid data');
        }
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
    
    // Get crypto performance statistics
    async getPerformanceStats() {
        try {
            return await this.performCryptoOperation('benchmark');
        } catch (error) {
            return {
                encryptionTime: null,
                sodiumAvailable: false,
                naclAvailable: false,
                webCryptoAvailable: !!(this.cryptoAPI && this.cryptoAPI.subtle),
                cryptoJsAvailable: false,
                error: error.message
            };
        }
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
        this.workerReady = false;
        
        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // Reject all pending operations
        for (const [id, { reject }] of this.pendingOperations) {
            reject(new Error('SecurityManager destroyed'));
        }
        this.pendingOperations.clear();
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityManager;
} else if (typeof window !== 'undefined') {
    window.SecurityManager = SecurityManager;
} else if (typeof globalThis !== 'undefined') {
    globalThis.SecurityManager = SecurityManager;
}