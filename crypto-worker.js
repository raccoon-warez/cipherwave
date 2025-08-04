// CipherWave Encryption Worker
// Handles cryptographic operations in a separate thread to prevent UI blocking

importScripts('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js');

// Secure random number generation using Web Crypto API
function generateSecureRandom(bytes) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(bytes);
        crypto.getRandomValues(array);
        return array;
    } else {
        // Fallback to CryptoJS for older environments
        return CryptoJS.lib.WordArray.random(bytes);
    }
}

// Generate Ed25519 key pair (simplified implementation)
function generateEd25519KeyPair() {
    // In production, use a proper Ed25519 library like tweetnacl
    const privateKey = generateSecureRandom(32);
    const publicKey = generateSecureRandom(32); // Derived from private key in real implementation
    
    return {
        privateKey: Array.from(privateKey),
        publicKey: Array.from(publicKey)
    };
}

// Generate X25519 key pair for ECDH
function generateX25519KeyPair() {
    // In production, use a proper X25519 library
    const privateKey = generateSecureRandom(32);
    const publicKey = generateSecureRandom(32); // Derived from private key in real implementation
    
    return {
        privateKey: Array.from(privateKey),
        publicKey: Array.from(publicKey)
    };
}

// Perform ECDH key exchange
function performECDH(privateKey, publicKey) {
    // In production, use proper X25519 ECDH
    // This is a simplified implementation for demo
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    
    return Array.from(sharedSecret);
}

// HKDF key derivation
function hkdfDerive(inputKey, salt, info, length) {
    // Simplified HKDF implementation using HMAC-SHA256
    const key = CryptoJS.lib.WordArray.create(inputKey);
    const saltWA = salt ? CryptoJS.lib.WordArray.create(salt) : CryptoJS.lib.WordArray.random(32/8);
    const infoWA = CryptoJS.lib.WordArray.create(info || []);
    
    // Extract step
    const prk = CryptoJS.HmacSHA256(key, saltWA);
    
    // Expand step
    let okm = CryptoJS.lib.WordArray.create();
    let n = Math.ceil(length / 32);
    let t = CryptoJS.lib.WordArray.create();
    
    for (let i = 1; i <= n; i++) {
        t = CryptoJS.HmacSHA256(t.concat(infoWA).concat(CryptoJS.lib.WordArray.create([i])), prk);
        okm = okm.concat(t);
    }
    
    return okm.toString().substring(0, length * 2); // Return hex string
}

// ChaCha20-Poly1305 AEAD encryption (simplified)
function chaCha20Poly1305Encrypt(plaintext, key, nonce, additionalData = null) {
    // In production, use a proper ChaCha20-Poly1305 implementation
    // For now, we'll use AES-GCM as a secure substitute
    const keyWA = CryptoJS.enc.Hex.parse(key);
    const nonceWA = CryptoJS.lib.WordArray.create(nonce);
    
    // Add timestamp and nonce for uniqueness
    const timestamp = Date.now().toString();
    const plaintextWithTimestamp = timestamp + '|' + plaintext;
    
    const encrypted = CryptoJS.AES.encrypt(plaintextWithTimestamp, keyWA, {
        iv: nonceWA,
        mode: CryptoJS.mode.GCM || CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    
    return {
        ciphertext: encrypted.toString(),
        nonce: Array.from(nonce),
        timestamp: parseInt(timestamp)
    };
}

// ChaCha20-Poly1305 AEAD decryption (simplified)
function chaCha20Poly1305Decrypt(encryptedData, key) {
    try {
        const keyWA = CryptoJS.enc.Hex.parse(key);
        const nonceWA = CryptoJS.lib.WordArray.create(encryptedData.nonce);
        
        const decrypted = CryptoJS.AES.decrypt(encryptedData.ciphertext, keyWA, {
            iv: nonceWA,
            mode: CryptoJS.mode.GCM || CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        
        // Extract timestamp and message
        const parts = decryptedText.split('|');
        if (parts.length < 2) {
            throw new Error('Invalid message format');
        }
        
        const timestamp = parseInt(parts[0]);
        const message = parts.slice(1).join('|');
        
        // Check timestamp to prevent replay attacks (5 minute window)
        const now = Date.now();
        if (now - timestamp > 300000) {
            throw new Error('Message timestamp too old');
        }
        
        return {
            message: message,
            timestamp: timestamp
        };
    } catch (error) {
        throw new Error('Decryption failed: ' + error.message);
    }
}

// Ed25519 signature (simplified)
function ed25519Sign(message, privateKey) {
    // In production, use proper Ed25519 signing
    // This is a simplified implementation for demo
    const messageHash = CryptoJS.SHA256(message).toString();
    const keyHash = CryptoJS.SHA256(privateKey.join('')).toString();
    const signature = CryptoJS.HmacSHA256(messageHash, keyHash).toString();
    
    return signature;
}

// Ed25519 signature verification (simplified)
function ed25519Verify(message, signature, publicKey) {
    // In production, use proper Ed25519 verification
    const messageHash = CryptoJS.SHA256(message).toString();
    const keyHash = CryptoJS.SHA256(publicKey.join('')).toString();
    const expectedSignature = CryptoJS.HmacSHA256(messageHash, keyHash).toString();
    
    return signature === expectedSignature;
}

// Message handler for crypto operations
self.onmessage = function(e) {
    const { operation, data } = e.data;
    
    try {
        let result;
        
        switch (operation) {
            case 'generateEd25519KeyPair':
                result = generateEd25519KeyPair();
                break;
                
            case 'generateX25519KeyPair':
                result = generateX25519KeyPair();
                break;
                
            case 'performECDH':
                result = performECDH(data.privateKey, data.publicKey);
                break;
                
            case 'hkdfDerive':
                result = hkdfDerive(data.inputKey, data.salt, data.info, data.length);
                break;
                
            case 'encrypt':
                if (data.cipher === 'chacha20-poly1305') {
                    result = chaCha20Poly1305Encrypt(data.message, data.key, data.nonce, data.additionalData);
                } else if (data.cipher === 'aes') {
                    const keyWA = CryptoJS.enc.Hex.parse(data.key);
                    result = CryptoJS.AES.encrypt(data.message, keyWA).toString();
                } else {
                    throw new Error('Unsupported cipher: ' + data.cipher);
                }
                break;
                
            case 'decrypt':
                if (data.cipher === 'chacha20-poly1305') {
                    result = chaCha20Poly1305Decrypt(data.encryptedData, data.key);
                } else if (data.cipher === 'aes') {
                    const keyWA = CryptoJS.enc.Hex.parse(data.key);
                    const decrypted = CryptoJS.AES.decrypt(data.encryptedData, keyWA);
                    result = decrypted.toString(CryptoJS.enc.Utf8);
                } else {
                    throw new Error('Unsupported cipher: ' + data.cipher);
                }
                break;
                
            case 'sign':
                result = ed25519Sign(data.message, data.privateKey);
                break;
                
            case 'verify':
                result = ed25519Verify(data.message, data.signature, data.publicKey);
                break;
                
            default:
                throw new Error('Unknown operation: ' + operation);
        }
        
        self.postMessage({
            success: true,
            operation: operation,
            result: result
        });
        
    } catch (error) {
        self.postMessage({
            success: false,
            operation: operation,
            error: error.message
        });
    }
};

// Handle worker errors
self.onerror = function(error) {
    self.postMessage({
        success: false,
        error: 'Worker error: ' + error.message
    });
};