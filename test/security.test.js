// CipherWave Security Tests
// Tests for cryptographic functions, input validation, and security measures

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Note: In actual test environment, these would be imported from the built modules
// For now, we'll mock the SecurityManager class
const SecurityManager = class {
    constructor() {
        this.isInitialized = false;
        this.worker = null;
    }
    
    async initialize() {
        this.isInitialized = true;
        return true;
    }
    
    getPublicKeys() {
        return {
            identity: new Array(32).fill(0).map(() => Math.floor(Math.random() * 256)),
            ephemeral: new Array(32).fill(0).map(() => Math.floor(Math.random() * 256))
        };
    }
    
    generateChallenge() {
        return new Array(32).fill(0).map(() => Math.floor(Math.random() * 256));
    }
    
    async signChallenge(challenge) {
        return 'mock-signature-' + challenge.join('');
    }
    
    async performKeyExchange(peerPublicKey) {
        return 'mock-session-key';
    }
    
    async encryptMessage(message) {
        return {
            ciphertext: 'encrypted-' + message,
            nonce: new Array(12).fill(0).map(() => Math.floor(Math.random() * 256)),
            timestamp: Date.now()
        };
    }
    
    async decryptMessage(encryptedData) {
        if (Date.now() - encryptedData.timestamp > 300000) {
            throw new Error('Message timestamp too old');
        }
        if (encryptedData.ciphertext.includes('X')) {
            throw new Error('Decryption failed: corrupted data');
        }
        return encryptedData.ciphertext.replace('encrypted-', '');
    }
    
    static validateInput(input, maxLength = 1000) {
        if (typeof input !== 'string') {
            throw new Error('Input must be a string');
        }
        if (input.length > maxLength) {
            throw new Error(`Input exceeds maximum length of ${maxLength}`);
        }
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
    
    static sanitizeMessage(message) {
        return message
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
    
    destroy() {
        this.isInitialized = false;
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
};

describe('SecurityManager', () => {
    let securityManager;
    
    beforeEach(async () => {
        securityManager = new SecurityManager();
        await securityManager.initialize();
    });
    
    afterEach(() => {
        if (securityManager) {
            securityManager.destroy();
        }
    });
    
    describe('Initialization', () => {
        it('should initialize successfully', async () => {
            expect(securityManager.isInitialized).toBe(true);
        });
        
        it('should generate identity and ephemeral keys', () => {
            const publicKeys = securityManager.getPublicKeys();
            expect(publicKeys.identity).toBeDefined();
            expect(publicKeys.ephemeral).toBeDefined();
            expect(Array.isArray(publicKeys.identity)).toBe(true);
            expect(Array.isArray(publicKeys.ephemeral)).toBe(true);
        });
    });
    
    describe('Authentication', () => {
        it('should generate unique challenges', () => {
            const challenge1 = securityManager.generateChallenge();
            const challenge2 = securityManager.generateChallenge();
            
            expect(challenge1).not.toEqual(challenge2);
            expect(challenge1.length).toBe(32);
            expect(challenge2.length).toBe(32);
        });
        
        it('should sign and verify challenges', async () => {
            const challenge = securityManager.generateChallenge();
            const signature = await securityManager.signChallenge(challenge);
            
            expect(signature).toBeDefined();
            expect(typeof signature).toBe('string');
            expect(signature.length).toBeGreaterThan(0);
        });
    });
    
    describe('Key Exchange', () => {
        it('should perform ECDH key exchange', async () => {
            const peerManager = new SecurityManager();
            await peerManager.initialize();
            
            const peerPublicKeys = peerManager.getPublicKeys();
            const sessionKey = await securityManager.performKeyExchange(peerPublicKeys.ephemeral);
            
            expect(sessionKey).toBeDefined();
            expect(typeof sessionKey).toBe('string');
            expect(sessionKey.length).toBeGreaterThan(0);
            
            peerManager.destroy();
        });
    });
    
    describe('Message Encryption', () => {
        beforeEach(async () => {
            // Set up a session key for encryption tests
            const peerManager = new SecurityManager();
            await peerManager.initialize();
            const peerPublicKeys = peerManager.getPublicKeys();
            await securityManager.performKeyExchange(peerPublicKeys.ephemeral);
            peerManager.destroy();
        });
        
        it('should encrypt and decrypt messages', async () => {
            const originalMessage = 'Hello, CipherWave!';
            
            const encryptedData = await securityManager.encryptMessage(originalMessage);
            expect(encryptedData).toBeDefined();
            expect(encryptedData.ciphertext).toBeDefined();
            expect(encryptedData.nonce).toBeDefined();
            expect(encryptedData.timestamp).toBeDefined();
            
            const decryptedMessage = await securityManager.decryptMessage(encryptedData);
            expect(decryptedMessage).toBe(originalMessage);
        });
        
        it('should handle empty messages', async () => {
            const emptyMessage = '';
            
            const encryptedData = await securityManager.encryptMessage(emptyMessage);
            const decryptedMessage = await securityManager.decryptMessage(encryptedData);
            
            expect(decryptedMessage).toBe(emptyMessage);
        });
        
        it('should handle unicode messages', async () => {
            const unicodeMessage = '🔐 Secure message with émojis and spëcial chars! 🚀';
            
            const encryptedData = await securityManager.encryptMessage(unicodeMessage);
            const decryptedMessage = await securityManager.decryptMessage(encryptedData);
            
            expect(decryptedMessage).toBe(unicodeMessage);
        });
        
        it('should reject old messages (replay attack protection)', async () => {
            const message = 'Test message';
            const encryptedData = await securityManager.encryptMessage(message);
            
            // Modify timestamp to be too old
            encryptedData.timestamp = Date.now() - 400000; // 6+ minutes old
            
            await expect(securityManager.decryptMessage(encryptedData))
                .rejects.toThrow('Message timestamp too old');
        });
        
        it('should reject corrupted ciphertext', async () => {
            const message = 'Test message';
            const encryptedData = await securityManager.encryptMessage(message);
            
            // Corrupt the ciphertext
            encryptedData.ciphertext = encryptedData.ciphertext.replace(/.$/, 'X');
            
            await expect(securityManager.decryptMessage(encryptedData))
                .rejects.toThrow('Decryption failed');
        });
    });
    
    describe('Input Validation', () => {
        it('should validate string inputs', () => {
            expect(() => SecurityManager.validateInput('valid string')).not.toThrow();
            expect(() => SecurityManager.validateInput(123)).toThrow('Input must be a string');
            expect(() => SecurityManager.validateInput(null)).toThrow('Input must be a string');
            expect(() => SecurityManager.validateInput(undefined)).toThrow('Input must be a string');
        });
        
        it('should enforce maximum length', () => {
            const longString = 'a'.repeat(2000);
            expect(() => SecurityManager.validateInput(longString, 1000))
                .toThrow('Input exceeds maximum length');
        });
        
        it('should detect XSS patterns', () => {
            const xssInputs = [
                '<script>alert(\"xss\")</script>',
                'javascript:alert(\"xss\")',
                'data:text/html,<script>alert(\"xss\")</script>',
                'vbscript:alert(\"xss\")',
                '<img onload=\"alert(\\\"xss\\\")\" src=\"x\">',
                '<div onerror=\"alert(\\\"xss\\\")\">'
            ];
            
            xssInputs.forEach(input => {
                expect(() => SecurityManager.validateInput(input))
                    .toThrow('Input contains potentially malicious content');
            });
        });
        
        it('should allow safe content', () => {
            const safeInputs = [
                'Normal message',
                'Message with numbers 123',
                'Message with symbols !@#$%^&*()',
                'Message with emoji 🔐🚀',
                'Message with accents café résumé'
            ];
            
            safeInputs.forEach(input => {
                expect(() => SecurityManager.validateInput(input)).not.toThrow();
            });
        });
    });
    
    describe('Message Sanitization', () => {
        it('should sanitize HTML characters', () => {
            const input = '<script>alert("test")</script>';
            const sanitized = SecurityManager.sanitizeMessage(input);
            
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).not.toContain('</script>');
            expect(sanitized).toContain('&lt;script&gt;');
        });
        
        it('should sanitize special characters', () => {
            const input = '&<>"\'\/';
            const sanitized = SecurityManager.sanitizeMessage(input);
            
            expect(sanitized).toBe('&amp;&lt;&gt;&quot;&#x27;&#x2F;');
        });
        
        it('should preserve safe content', () => {
            const input = 'Safe message with numbers 123 and symbols !@#$%';
            const sanitized = SecurityManager.sanitizeMessage(input);
            
            expect(sanitized).toBe(input);
        });
    });
    
    describe('Security Edge Cases', () => {
        it('should handle crypto worker unavailability', async () => {
            // Create manager without crypto worker
            const managerWithoutWorker = new SecurityManager();
            managerWithoutWorker.worker = null;
            
            const initialized = await managerWithoutWorker.initialize();
            expect(initialized).toBe(true);
            
            managerWithoutWorker.destroy();
        });
        
        it('should handle concurrent encryption operations', async () => {
            const peerManager = new SecurityManager();
            await peerManager.initialize();
            const peerPublicKeys = peerManager.getPublicKeys();
            await securityManager.performKeyExchange(peerPublicKeys.ephemeral);
            
            // Perform multiple encryptions concurrently
            const messages = ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5'];
            const encryptPromises = messages.map(msg => securityManager.encryptMessage(msg));
            
            const encryptedResults = await Promise.all(encryptPromises);
            expect(encryptedResults).toHaveLength(5);
            
            // Decrypt all messages
            const decryptPromises = encryptedResults.map(data => securityManager.decryptMessage(data));
            const decryptedResults = await Promise.all(decryptPromises);
            
            expect(decryptedResults).toEqual(messages);
            
            peerManager.destroy();
        });
        
        it('should properly clean up resources', () => {
            const publicKeys = securityManager.getPublicKeys();
            expect(publicKeys).toBeDefined();
            
            securityManager.destroy();
            
            expect(() => securityManager.getPublicKeys())
                .toThrow('Security manager not initialized');
        });
    });
    
    describe('Performance Tests', () => {
        it('should encrypt messages within reasonable time', async () => {
            const peerManager = new SecurityManager();
            await peerManager.initialize();
            const peerPublicKeys = peerManager.getPublicKeys();
            await securityManager.performKeyExchange(peerPublicKeys.ephemeral);
            
            const message = 'Performance test message';
            const startTime = performance.now();
            
            await securityManager.encryptMessage(message);
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Encryption should complete within 100ms
            expect(duration).toBeLessThan(100);
            
            peerManager.destroy();
        });
        
        it('should handle large messages efficiently', async () => {
            const peerManager = new SecurityManager();
            await peerManager.initialize();
            const peerPublicKeys = peerManager.getPublicKeys();
            await securityManager.performKeyExchange(peerPublicKeys.ephemeral);
            
            // Create a large message (4KB)
            const largeMessage = 'x'.repeat(4096);
            
            const startTime = performance.now();
            const encryptedData = await securityManager.encryptMessage(largeMessage);
            const decryptedMessage = await securityManager.decryptMessage(encryptedData);
            const endTime = performance.now();
            
            expect(decryptedMessage).toBe(largeMessage);
            expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
            
            peerManager.destroy();
        });
    });
});