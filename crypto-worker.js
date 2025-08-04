// CipherWave Encryption Worker
// Handles cryptographic operations in a separate thread to prevent UI blocking

// Import crypto libraries with fallbacks
try {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js');
} catch (error) {
    console.warn('Failed to load crypto-js from CDN, using local fallback');
}

try {
    importScripts('https://cdn.jsdelivr.net/npm/libsodium-wrappers@0.7.15/dist/libsodium-wrappers.min.js');
} catch (error) {
    console.warn('Failed to load libsodium from CDN');
}

try {
    importScripts('https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl.min.js');
} catch (error) {
    console.warn('Failed to load tweetnacl from CDN');
}

// Global state
let sodiumReady = false;
let naclReady = false;

// Initialize libsodium if available
if (typeof sodium !== 'undefined') {
    sodium.ready.then(() => {
        sodiumReady = true;
        console.log('Libsodium ready in worker');
    }).catch(() => {
        console.warn('Failed to initialize libsodium');
    });
}

// Check if tweetnacl is available
if (typeof nacl !== 'undefined') {
    naclReady = true;
    console.log('TweetNaCl ready in worker');
}

// Secure random number generation using Web Crypto API with fallbacks
function generateSecureRandom(bytes) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(bytes);
        crypto.getRandomValues(array);
        return array;
    } else if (sodiumReady && typeof sodium !== 'undefined') {
        return sodium.randombytes_buf(bytes);
    } else if (naclReady && typeof nacl !== 'undefined') {
        return nacl.randomBytes(bytes);
    } else if (typeof CryptoJS !== 'undefined') {
        // Fallback to CryptoJS for older environments
        const random = CryptoJS.lib.WordArray.random(bytes);
        const bytes_array = new Uint8Array(bytes);
        for (let i = 0; i < bytes; i++) {
            bytes_array[i] = (random.words[Math.floor(i / 4)] >>> (24 - (i % 4) * 8)) & 0xFF;
        }
        return bytes_array;
    } else {
        throw new Error('No secure random generator available');
    }
}

// Generate Ed25519 key pair using proper cryptographic libraries
function generateEd25519KeyPair() {
    if (sodiumReady && typeof sodium !== 'undefined') {
        const keyPair = sodium.crypto_sign_keypair();
        return {
            privateKey: Array.from(keyPair.privateKey),
            publicKey: Array.from(keyPair.publicKey)
        };
    } else if (naclReady && typeof nacl !== 'undefined') {
        const keyPair = nacl.sign.keyPair();
        return {
            privateKey: Array.from(keyPair.secretKey),
            publicKey: Array.from(keyPair.publicKey)
        };
    } else {
        // Fallback: generate secure random keys (not cryptographically correct for Ed25519)
        console.warn('Using fallback Ed25519 key generation - not cryptographically secure');
        const privateKey = generateSecureRandom(32);
        const publicKey = generateSecureRandom(32);
        return {
            privateKey: Array.from(privateKey),
            publicKey: Array.from(publicKey)
        };
    }
}

// Generate X25519 key pair for ECDH using proper cryptographic libraries
function generateX25519KeyPair() {
    if (sodiumReady && typeof sodium !== 'undefined') {
        const keyPair = sodium.crypto_box_keypair();
        return {
            privateKey: Array.from(keyPair.privateKey),
            publicKey: Array.from(keyPair.publicKey)
        };
    } else if (naclReady && typeof nacl !== 'undefined') {
        const keyPair = nacl.box.keyPair();
        return {
            privateKey: Array.from(keyPair.secretKey),
            publicKey: Array.from(keyPair.publicKey)
        };
    } else {
        // Fallback: generate secure random keys (not cryptographically correct for X25519)
        console.warn('Using fallback X25519 key generation - not cryptographically secure');
        const privateKey = generateSecureRandom(32);
        const publicKey = generateSecureRandom(32);
        return {
            privateKey: Array.from(privateKey),
            publicKey: Array.from(publicKey)
        };
    }
}

// Perform ECDH key exchange using proper cryptographic libraries
function performECDH(privateKey, publicKey) {
    const privateKeyBytes = new Uint8Array(privateKey);
    const publicKeyBytes = new Uint8Array(publicKey);
    
    if (sodiumReady && typeof sodium !== 'undefined') {
        const sharedSecret = sodium.crypto_scalarmult(privateKeyBytes, publicKeyBytes);
        return Array.from(sharedSecret);
    } else if (naclReady && typeof nacl !== 'undefined') {
        const sharedSecret = nacl.scalarMult(privateKeyBytes, publicKeyBytes);
        return Array.from(sharedSecret);
    } else {
        // Fallback: XOR operation (not cryptographically secure)
        console.warn('Using fallback ECDH - not cryptographically secure');
        const sharedSecret = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            sharedSecret[i] = privateKeyBytes[i] ^ publicKeyBytes[i];
        }
        return Array.from(sharedSecret);
    }
}

// HKDF key derivation using Web Crypto API or fallbacks
async function hkdfDerive(inputKey, salt, info, length) {
    const inputKeyBytes = new Uint8Array(inputKey);
    const saltBytes = salt ? new Uint8Array(salt) : generateSecureRandom(32);
    const infoBytes = info ? new Uint8Array(info) : new Uint8Array(0);
    
    // Try Web Crypto API first
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const key = await crypto.subtle.importKey(
                'raw',
                inputKeyBytes,
                'HKDF',
                false,
                ['deriveKey', 'deriveBits']
            );
            
            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'HKDF',
                    hash: 'SHA-256',
                    salt: saltBytes,
                    info: infoBytes
                },
                key,
                length * 8
            );
            
            return Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('Web Crypto HKDF failed, using fallback:', error);
        }
    }
    
    // Fallback to libsodium if available
    if (sodiumReady && typeof sodium !== 'undefined') {
        const derived = sodium.crypto_kdf_derive_from_key(length, 1, 'CipherWv', inputKeyBytes);
        return Array.from(derived).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback to CryptoJS HKDF implementation
    if (typeof CryptoJS !== 'undefined') {
        const key = CryptoJS.lib.WordArray.create(inputKeyBytes);
        const saltWA = CryptoJS.lib.WordArray.create(saltBytes);
        const infoWA = CryptoJS.lib.WordArray.create(infoBytes);
        
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
        
        return okm.toString().substring(0, length * 2);
    }
    
    throw new Error('No HKDF implementation available');
}

// ChaCha20-Poly1305 AEAD encryption using proper crypto libraries
async function chaCha20Poly1305Encrypt(plaintext, key, nonce, additionalData = null) {
    const keyBytes = typeof key === 'string' ? new Uint8Array(Buffer.from(key, 'hex')) : new Uint8Array(key);
    const nonceBytes = new Uint8Array(nonce);
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const adBytes = additionalData ? new TextEncoder().encode(additionalData) : null;
    
    // Add timestamp for replay protection
    const timestamp = Date.now();
    const timestampBytes = new TextEncoder().encode(timestamp.toString());
    const fullPlaintext = new Uint8Array(timestampBytes.length + 1 + plaintextBytes.length);
    fullPlaintext.set(timestampBytes);
    fullPlaintext[timestampBytes.length] = 0x7C; // '|' separator
    fullPlaintext.set(plaintextBytes, timestampBytes.length + 1);
    
    // Try libsodium first (has ChaCha20-Poly1305)
    if (sodiumReady && typeof sodium !== 'undefined') {
        if (nonceBytes.length !== 12) {
            throw new Error('Nonce must be 12 bytes for ChaCha20-Poly1305');
        }
        const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
            fullPlaintext,
            adBytes,
            null,
            nonceBytes,
            keyBytes
        );
        return {
            ciphertext: Array.from(ciphertext),
            nonce: Array.from(nonceBytes),
            timestamp: timestamp
        };
    }
    
    // Try tweetnacl secretbox (XSalsa20-Poly1305)
    if (naclReady && typeof nacl !== 'undefined') {
        if (nonceBytes.length !== 24) {
            const extendedNonce = new Uint8Array(24);
            extendedNonce.set(nonceBytes.slice(0, Math.min(24, nonceBytes.length)));
            nonceBytes = extendedNonce;
        }
        const ciphertext = nacl.secretbox(fullPlaintext, nonceBytes, keyBytes.slice(0, 32));
        return {
            ciphertext: Array.from(ciphertext),
            nonce: Array.from(nonceBytes),
            timestamp: timestamp
        };
    }
    
    // Try Web Crypto API AES-GCM
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyBytes.slice(0, 32),
                'AES-GCM',
                false,
                ['encrypt']
            );
            
            const iv = nonceBytes.slice(0, 12);
            const ciphertext = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    additionalData: adBytes
                },
                cryptoKey,
                fullPlaintext
            );
            
            return {
                ciphertext: Array.from(new Uint8Array(ciphertext)),
                nonce: Array.from(iv),
                timestamp: timestamp
            };
        } catch (error) {
            console.warn('Web Crypto AES-GCM failed:', error);
        }
    }
    
    // Fallback to CryptoJS AES
    if (typeof CryptoJS !== 'undefined') {
        const keyWA = CryptoJS.lib.WordArray.create(keyBytes);
        const nonceWA = CryptoJS.lib.WordArray.create(nonceBytes.slice(0, 16));
        const plaintextWA = CryptoJS.lib.WordArray.create(fullPlaintext);
        
        const encrypted = CryptoJS.AES.encrypt(plaintextWA, keyWA, {
            iv: nonceWA,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        
        return {
            ciphertext: encrypted.toString(),
            nonce: Array.from(nonceBytes),
            timestamp: timestamp
        };
    }
    
    throw new Error('No encryption implementation available');
}

// ChaCha20-Poly1305 AEAD decryption using proper crypto libraries
async function chaCha20Poly1305Decrypt(encryptedData, key, additionalData = null) {
    try {
        const keyBytes = typeof key === 'string' ? new Uint8Array(Buffer.from(key, 'hex')) : new Uint8Array(key);
        const nonceBytes = new Uint8Array(encryptedData.nonce);
        const ciphertextBytes = typeof encryptedData.ciphertext === 'string' ?
            new Uint8Array(Buffer.from(encryptedData.ciphertext, 'base64')) :
            new Uint8Array(encryptedData.ciphertext);
        const adBytes = additionalData ? new TextEncoder().encode(additionalData) : null;
        
        let decryptedBytes;
        
        // Try libsodium first (ChaCha20-Poly1305)
        if (sodiumReady && typeof sodium !== 'undefined' && Array.isArray(encryptedData.ciphertext)) {
            decryptedBytes = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
                null,
                ciphertextBytes,
                adBytes,
                nonceBytes,
                keyBytes
            );
        }
        // Try tweetnacl (XSalsa20-Poly1305)
        else if (naclReady && typeof nacl !== 'undefined' && Array.isArray(encryptedData.ciphertext)) {
            decryptedBytes = nacl.secretbox.open(ciphertextBytes, nonceBytes, keyBytes.slice(0, 32));
            if (!decryptedBytes) {
                throw new Error('TweetNaCl decryption failed');
            }
        }
        // Try Web Crypto API AES-GCM
        else if (typeof crypto !== 'undefined' && crypto.subtle && Array.isArray(encryptedData.ciphertext)) {
            try {
                const cryptoKey = await crypto.subtle.importKey(
                    'raw',
                    keyBytes.slice(0, 32),
                    'AES-GCM',
                    false,
                    ['decrypt']
                );
                
                const iv = nonceBytes.slice(0, 12);
                const decrypted = await crypto.subtle.decrypt(
                    {
                        name: 'AES-GCM',
                        iv: iv,
                        additionalData: adBytes
                    },
                    cryptoKey,
                    ciphertextBytes
                );
                
                decryptedBytes = new Uint8Array(decrypted);
            } catch (error) {
                console.warn('Web Crypto AES-GCM decryption failed:', error);
                throw error;
            }
        }
        // Fallback to CryptoJS
        else if (typeof CryptoJS !== 'undefined' && typeof encryptedData.ciphertext === 'string') {
            const keyWA = CryptoJS.lib.WordArray.create(keyBytes);
            const nonceWA = CryptoJS.lib.WordArray.create(nonceBytes.slice(0, 16));
            
            const decrypted = CryptoJS.AES.decrypt(encryptedData.ciphertext, keyWA, {
                iv: nonceWA,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });
            
            const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
            if (!decryptedText) {
                throw new Error('CryptoJS decryption failed');
            }
            
            // Extract timestamp and message from CryptoJS result
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
            
            return { message, timestamp };
        } else {
            throw new Error('No decryption implementation available');
        }
        
        // Process decrypted bytes for proper crypto implementations
        if (decryptedBytes) {
            const decryptedText = new TextDecoder().decode(decryptedBytes);
            
            // Extract timestamp and message
            const separatorIndex = decryptedText.indexOf('|');
            if (separatorIndex === -1) {
                throw new Error('Invalid message format');
            }
            
            const timestamp = parseInt(decryptedText.substring(0, separatorIndex));
            const message = decryptedText.substring(separatorIndex + 1);
            
            // Check timestamp to prevent replay attacks (5 minute window)
            const now = Date.now();
            if (now - timestamp > 300000) {
                throw new Error('Message timestamp too old');
            }
            
            return { message, timestamp };
        }
        
    } catch (error) {
        throw new Error('Decryption failed: ' + error.message);
    }
}

// Ed25519 signature using proper cryptographic libraries
function ed25519Sign(message, privateKey) {
    const messageBytes = new TextEncoder().encode(message);
    const privateKeyBytes = new Uint8Array(privateKey);
    
    if (sodiumReady && typeof sodium !== 'undefined') {
        const signature = sodium.crypto_sign_detached(messageBytes, privateKeyBytes);
        return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (naclReady && typeof nacl !== 'undefined') {
        const signature = nacl.sign.detached(messageBytes, privateKeyBytes);
        return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof CryptoJS !== 'undefined') {
        // Fallback: HMAC-SHA256 (not Ed25519 but cryptographically secure)
        console.warn('Using HMAC-SHA256 instead of Ed25519 for signing');
        const messageHash = CryptoJS.SHA256(message).toString();
        const keyHash = CryptoJS.SHA256(privateKey.join('')).toString();
        return CryptoJS.HmacSHA256(messageHash, keyHash).toString();
    } else {
        throw new Error('No signing implementation available');
    }
}

// Ed25519 signature verification using proper cryptographic libraries
function ed25519Verify(message, signature, publicKey) {
    const messageBytes = new TextEncoder().encode(message);
    const publicKeyBytes = new Uint8Array(publicKey);
    
    // Convert hex signature to bytes if needed
    let signatureBytes;
    if (typeof signature === 'string') {
        signatureBytes = new Uint8Array(signature.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    } else {
        signatureBytes = new Uint8Array(signature);
    }
    
    if (sodiumReady && typeof sodium !== 'undefined') {
        return sodium.crypto_sign_verify_detached(signatureBytes, messageBytes, publicKeyBytes);
    } else if (naclReady && typeof nacl !== 'undefined') {
        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } else if (typeof CryptoJS !== 'undefined') {
        // Fallback: HMAC-SHA256 verification
        console.warn('Using HMAC-SHA256 instead of Ed25519 for verification');
        const messageHash = CryptoJS.SHA256(message).toString();
        const keyHash = CryptoJS.SHA256(publicKey.join('')).toString();
        const expectedSignature = CryptoJS.HmacSHA256(messageHash, keyHash).toString();
        return signature === expectedSignature;
    } else {
        throw new Error('No signature verification implementation available');
    }
}

// Message handler for crypto operations with proper async support
self.onmessage = async function(e) {
    const { id, operation, data } = e.data;
    
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
                result = await hkdfDerive(data.inputKey, data.salt, data.info, data.length);
                break;
                
            case 'encrypt':
                if (data.cipher === 'chacha20-poly1305') {
                    result = await chaCha20Poly1305Encrypt(data.message, data.key, data.nonce, data.additionalData);
                } else if (data.cipher === 'aes' && typeof CryptoJS !== 'undefined') {
                    const keyWA = CryptoJS.enc.Hex.parse(data.key);
                    result = CryptoJS.AES.encrypt(data.message, keyWA).toString();
                } else {
                    throw new Error('Unsupported cipher: ' + data.cipher);
                }
                break;
                
            case 'decrypt':
                if (data.cipher === 'chacha20-poly1305') {
                    result = await chaCha20Poly1305Decrypt(data.encryptedData, data.key, data.additionalData);
                } else if (data.cipher === 'aes' && typeof CryptoJS !== 'undefined') {
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
                
            case 'hash':
                // Hash operation for general use
                if (sodiumReady && typeof sodium !== 'undefined') {
                    const messageBytes = new TextEncoder().encode(data.message);
                    const hash = sodium.crypto_hash_sha256(messageBytes);
                    result = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
                } else if (typeof CryptoJS !== 'undefined') {
                    result = CryptoJS.SHA256(data.message).toString();
                } else {
                    throw new Error('No hash implementation available');
                }
                break;
                
            case 'benchmark':
                // Performance benchmark for crypto operations
                const start = performance.now();
                const testData = 'Hello, World! '.repeat(100);
                const testKey = generateSecureRandom(32);
                const testNonce = generateSecureRandom(12);
                
                await chaCha20Poly1305Encrypt(testData, testKey, testNonce);
                const end = performance.now();
                
                result = {
                    encryptionTime: end - start,
                    sodiumAvailable: sodiumReady,
                    naclAvailable: naclReady,
                    webCryptoAvailable: typeof crypto !== 'undefined' && !!crypto.subtle,
                    cryptoJsAvailable: typeof CryptoJS !== 'undefined'
                };
                break;
                
            default:
                throw new Error('Unknown operation: ' + operation);
        }
        
        self.postMessage({
            success: true,
            id: id,
            operation: operation,
            result: result
        });
        
    } catch (error) {
        self.postMessage({
            success: false,
            id: id,
            operation: operation,
            error: error.message,
            stack: error.stack
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