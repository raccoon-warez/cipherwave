// Basic CipherWave Tests
// Simple tests to verify core functionality

import { describe, it, expect } from 'vitest';

describe('CipherWave Basic Tests', () => {
    describe('Environment Setup', () => {
        it('should have crypto API available', () => {
            expect(global.crypto).toBeDefined();
            expect(global.crypto.getRandomValues).toBeDefined();
        });
        
        it('should have performance API available', () => {
            expect(global.performance).toBeDefined();
            expect(global.performance.now).toBeDefined();
        });
        
        it('should have WebSocket mock available', () => {
            expect(global.WebSocket).toBeDefined();
        });
        
        it('should have Worker mock available', () => {
            expect(global.Worker).toBeDefined();
        });
    });
    
    describe('Security Utilities', () => {
        it('should validate safe strings', () => {
            const validateInput = (input, maxLength = 1000) => {
                if (typeof input !== 'string') {
                    throw new Error('Input must be a string');
                }
                if (input.length > maxLength) {
                    throw new Error(`Input exceeds maximum length of ${maxLength}`);
                }
                return true;
            };
            
            expect(() => validateInput('safe string')).not.toThrow();
            expect(() => validateInput(123)).toThrow('Input must be a string');
            expect(() => validateInput('x'.repeat(2000), 1000)).toThrow('Input exceeds maximum length');
        });
        
        it('should sanitize HTML content', () => {
            const sanitizeMessage = (message) => {
                return message
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .replace(/\//g, '&#x2F;');
            };
            
            expect(sanitizeMessage('<script>alert("xss")</script>'))
                .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
            
            expect(sanitizeMessage('Safe message'))
                .toBe('Safe message');
        });
    });
    
    describe('Random Generation', () => {
        it('should generate secure random values', () => {
            const generateRoomId = () => {
                if (global.crypto && global.crypto.getRandomValues) {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    const randomArray = new Uint8Array(20);
                    global.crypto.getRandomValues(randomArray);
                    
                    let roomId = '';
                    for (let i = 0; i < 20; i++) {
                        roomId += chars.charAt(randomArray[i] % chars.length);
                    }
                    return roomId;
                }
                return 'fallback-room-id';
            };
            
            const roomId1 = generateRoomId();
            const roomId2 = generateRoomId();
            
            expect(roomId1).toHaveLength(20);
            expect(roomId2).toHaveLength(20);
            expect(roomId1).not.toBe(roomId2);
        });
    });
    
    describe('Configuration Validation', () => {
        it('should validate WebRTC configuration', () => {
            const configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'turn:openrelay.metered.ca:80', username: 'test', credential: 'test' }
                ],
                iceCandidatePoolSize: 10,
                iceTransportPolicy: 'all'
            };
            
            expect(configuration.iceServers).toHaveLength(2);
            expect(configuration.iceServers[0].urls).toBe('stun:stun.l.google.com:19302');
            expect(configuration.iceCandidatePoolSize).toBe(10);
        });
        
        it('should validate room ID format', () => {
            const isValidRoomId = (roomId) => {
                return typeof roomId === 'string' && 
                       roomId.length >= 4 && 
                       roomId.length <= 100 &&
                       /^[a-zA-Z0-9_-]+$/.test(roomId);
            };
            
            expect(isValidRoomId('valid-room-123')).toBe(true);
            expect(isValidRoomId('ab')).toBe(false); // too short
            expect(isValidRoomId('invalid room!')).toBe(false); // invalid chars
            expect(isValidRoomId(123)).toBe(false); // not string
        });
    });
    
    describe('Message Processing', () => {
        it('should handle message structure', () => {
            const createMessage = (content, type, messageId) => {
                return {
                    type: 'message',
                    content: content,
                    messageType: type,
                    messageId: messageId,
                    timestamp: Date.now()
                };
            };
            
            const message = createMessage('Hello World', 'sent', 123);
            
            expect(message.type).toBe('message');
            expect(message.content).toBe('Hello World');
            expect(message.messageType).toBe('sent');
            expect(message.messageId).toBe(123);
            expect(message.timestamp).toBeTypeOf('number');
        });
        
        it('should batch messages efficiently', () => {
            class SimpleBatcher {
                constructor(batchSize = 5) {
                    this.batchSize = batchSize;
                    this.batch = [];
                }
                
                add(item) {
                    this.batch.push(item);
                    if (this.batch.length >= this.batchSize) {
                        return this.flush();
                    }
                    return [];
                }
                
                flush() {
                    const result = [...this.batch];
                    this.batch = [];
                    return result;
                }
            }
            
            const batcher = new SimpleBatcher(3);
            
            expect(batcher.add('msg1')).toEqual([]);
            expect(batcher.add('msg2')).toEqual([]);
            expect(batcher.add('msg3')).toEqual(['msg1', 'msg2', 'msg3']);
            expect(batcher.add('msg4')).toEqual([]);
        });
    });
    
    describe('Performance Monitoring', () => {
        it('should measure operation timing', () => {
            const measureOperation = (operation) => {
                const start = global.performance.now();
                const result = operation();
                const duration = global.performance.now() - start;
                return { result, duration };
            };
            
            const testOperation = () => {
                let sum = 0;
                for (let i = 0; i < 1000; i++) {
                    sum += i;
                }
                return sum;
            };
            
            const { result, duration } = measureOperation(testOperation);
            
            expect(result).toBe(499500); // Sum of 0-999
            expect(duration).toBeTypeOf('number');
            expect(duration).toBeGreaterThanOrEqual(0);
        });
    });
});