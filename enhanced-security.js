// Enhanced Security Module for CipherWave
// This module adds additional security features to the application

// 1. Secure Random Number Generator
class SecureRandom {
    // Generate cryptographically secure random bytes
    static getRandomBytes(length) {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint8Array(length);
            window.crypto.getRandomValues(array);
            return array;
        } else if (typeof require !== 'undefined') {
            // Node.js environment
            const crypto = require('crypto');
            return crypto.randomBytes(length);
        } else {
            // Fallback (less secure)
            console.warn('Using insecure random number generator');
            const array = new Array(length);
            for (let i = 0; i < length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
            return array;
        }
    }
    
    // Generate random string of specified length
    static getRandomString(length, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        let result = '';
        const bytes = this.getRandomBytes(length);
        for (let i = 0; i < length; i++) {
            result += charset[bytes[i] % charset.length];
        }
        return result;
    }
    
    // Generate secure room ID
    static generateSecureRoomId() {
        return this.getRandomString(32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_');
    }
}

// 2. Message Authentication
class MessageAuthenticator {
    // Create HMAC for message integrity
    static createHMAC(message, key) {
        if (typeof CryptoJS !== 'undefined') {
            return CryptoJS.HmacSHA256(message, key).toString();
        } else {
            console.warn('CryptoJS not available for HMAC generation');
            return '';
        }
    }
    
    // Verify message integrity
    static verifyHMAC(message, key, hmac) {
        const computedHMAC = this.createHMAC(message, key);
        return computedHMAC === hmac;
    }
    
    // Sign a message with HMAC
    static signMessage(message, key) {
        const hmac = this.createHMAC(message, key);
        return {
            message: message,
            hmac: hmac,
            timestamp: Date.now()
        };
    }
    
    // Verify signed message
    static verifyMessage(signedMessage, key, maxAge = 300000) { // 5 minutes default
        // Check timestamp
        if (Date.now() - signedMessage.timestamp > maxAge) {
            console.warn('Message expired');
            return false;
        }
        
        // Verify HMAC
        return this.verifyHMAC(signedMessage.message, key, signedMessage.hmac);
    }
}

// 3. Key Derivation
class KeyDerivation {
    // PBKDF2 key derivation
    static deriveKey(password, salt, iterations = 100000, keyLength = 32) {
        if (typeof CryptoJS !== 'undefined') {
            return CryptoJS.PBKDF2(password, salt, {
                keySize: keyLength / 4, // CryptoJS works with words (4 bytes each)
                iterations: iterations
            }).toString();
        } else {
            console.warn('CryptoJS not available for key derivation');
            return '';
        }
    }
    
    // Generate key from password
    static generateKeyFromPassword(password, salt = null) {
        if (!salt) {
            salt = CryptoJS.lib.WordArray.random(128/8).toString();
        }
        
        const key = this.deriveKey(password, salt);
        return {
            key: key,
            salt: salt
        };
    }
}

// 4. Secure Storage
class SecureStorage {
    // Encrypt and store data in localStorage
    static setEncryptedItem(key, data, encryptionKey) {
        try {
            if (typeof CryptoJS !== 'undefined') {
                const jsonData = JSON.stringify(data);
                const encrypted = CryptoJS.AES.encrypt(jsonData, encryptionKey).toString();
                localStorage.setItem(key, encrypted);
                return true;
            } else {
                console.warn('CryptoJS not available for secure storage');
                return false;
            }
        } catch (error) {
            console.error('Error storing encrypted data:', error);
            return false;
        }
    }
    
    // Retrieve and decrypt data from localStorage
    static getEncryptedItem(key, encryptionKey) {
        try {
            const encrypted = localStorage.getItem(key);
            if (!encrypted) return null;
            
            if (typeof CryptoJS !== 'undefined') {
                const decrypted = CryptoJS.AES.decrypt(encrypted, encryptionKey);
                const jsonData = decrypted.toString(CryptoJS.enc.Utf8);
                return JSON.parse(jsonData);
            } else {
                console.warn('CryptoJS not available for secure retrieval');
                return null;
            }
        } catch (error) {
            console.error('Error retrieving encrypted data:', error);
            return null;
        }
    }
    
    // Securely clear data
    static clearItem(key) {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                // Overwrite with random data before deleting
                const randomData = SecureRandom.getRandomString(data.length);
                localStorage.setItem(key, randomData);
                localStorage.removeItem(key);
            }
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }
}

// 5. Session Management
class SecureSession {
    constructor(sessionId = null) {
        this.sessionId = sessionId || SecureRandom.generateSecureRoomId();
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.encryptionKey = CryptoJS.lib.WordArray.random(256/8).toString();
    }
    
    // Update last activity timestamp
    updateActivity() {
        this.lastActivity = Date.now();
    }
    
    // Check if session is still valid
    isValid(maxAge = 3600000) { // 1 hour default
        return (Date.now() - this.createdAt) < maxAge;
    }
    
    // Check if session is active
    isActive(maxInactivity = 900000) { // 15 minutes default
        return (Date.now() - this.lastActivity) < maxInactivity;
    }
    
    // Serialize session for storage
    serialize() {
        return {
            sessionId: this.sessionId,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity
            // Note: encryptionKey should never be serialized
        };
    }
    
    // Restore session from serialized data
    static deserialize(data, encryptionKey) {
        const session = new SecureSession(data.sessionId);
        session.createdAt = data.createdAt;
        session.lastActivity = data.lastActivity;
        session.encryptionKey = encryptionKey;
        return session;
    }
}

// 6. Security Event Logging
class SecurityLogger {
    constructor() {
        this.events = [];
    }
    
    // Log security event
    logEvent(eventType, details = {}) {
        const event = {
            timestamp: Date.now(),
            type: eventType,
            details: details
        };
        
        this.events.push(event);
        console.log(`[SECURITY] ${eventType}:`, details);
        
        // Keep only last 100 events
        if (this.events.length > 100) {
            this.events.shift();
        }
    }
    
    // Get recent security events
    getRecentEvents(count = 10) {
        return this.events.slice(-count);
    }
    
    // Check for suspicious activity
    checkForSuspiciousActivity() {
        const now = Date.now();
        const recentEvents = this.events.filter(event => 
            now - event.timestamp < 300000 // Last 5 minutes
        );
        
        // Check for excessive failed attempts
        const failedAttempts = recentEvents.filter(event => 
            event.type === 'AUTH_FAILED' || event.type === 'ENCRYPTION_ERROR'
        );
        
        if (failedAttempts.length > 5) {
            this.logEvent('SUSPICIOUS_ACTIVITY', {
                reason: 'Too many failed attempts',
                count: failedAttempts.length
            });
            return true;
        }
        
        return false;
    }
}

// 7. Input Sanitization
class InputSanitizer {
    // Sanitize user input to prevent XSS
    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#x27;');
    }
    
    // Validate room ID format
    static validateRoomId(roomId) {
        if (typeof roomId !== 'string') return false;
        if (roomId.length < 1 || roomId.length > 100) return false;
        // Allow alphanumeric, hyphens, and underscores
        return /^[a-zA-Z0-9_-]+$/.test(roomId);
    }
    
    // Validate message content
    static validateMessage(message) {
        if (typeof message !== 'string') return false;
        if (message.length > 10000) return false; // 10KB limit
        return true;
    }
}

// 8. Export all security classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SecureRandom,
        MessageAuthenticator,
        KeyDerivation,
        SecureStorage,
        SecureSession,
        SecurityLogger,
        InputSanitizer
    };
}

// Make available in browser environment
if (typeof window !== 'undefined') {
    window.CipherWaveSecurity = {
        SecureRandom,
        MessageAuthenticator,
        KeyDerivation,
        SecureStorage,
        SecureSession,
        SecurityLogger,
        InputSanitizer
    };
}
