// CipherWave Message Manager Tests
// Tests for message batching, memory management, and UI optimization

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageManager } from '../message-manager.js';

// Mock DOM elements
const createMockContainer = () => {
    const container = {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        children: [],
        firstChild: null,
        firstElementChild: null,
        lastElementChild: null,
        scrollTop: 0,
        scrollHeight: 1000,
        clientHeight: 500,
        addEventListener: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => [])
    };
    
    // Mock children array behavior
    Object.defineProperty(container, 'children', {
        get: () => container._children || [],
        set: (value) => { container._children = value; }
    });
    
    return container;
};

// Mock document methods
global.document = {
    createElement: vi.fn((tag) => ({
        tagName: tag.toUpperCase(),
        className: '',
        textContent: '',
        appendChild: vi.fn(),
        setAttribute: vi.fn(),
        querySelector: vi.fn(),
        style: {}
    })),
    createDocumentFragment: vi.fn(() => ({
        appendChild: vi.fn(),
        children: []
    })),
    getElementById: vi.fn()
};

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));

// Mock SecurityManager
global.SecurityManager = {
    sanitizeMessage: vi.fn((msg) => msg.replace(/[<>&"']/g, ''))
};

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
}));

describe('MessageManager', () => {
    let container;
    let messageManager;
    
    beforeEach(() => {
        container = createMockContainer();
        messageManager = new MessageManager(container, {
            maxMessages: 10,
            batchSize: 3,
            batchInterval: 50
        });
        
        // Reset mocks
        vi.clearAllMocks();
    });
    
    afterEach(() => {
        if (messageManager) {
            messageManager.destroy();
        }
    });
    
    describe('Initialization', () => {
        it('should initialize with default options', () => {
            const defaultManager = new MessageManager(container);
            
            expect(defaultManager.maxMessages).toBe(1000);
            expect(defaultManager.batchSize).toBe(10);
            expect(defaultManager.batchInterval).toBe(100);
            
            defaultManager.destroy();
        });
        
        it('should initialize with custom options', () => {
            expect(messageManager.maxMessages).toBe(10);
            expect(messageManager.batchSize).toBe(3);
            expect(messageManager.batchInterval).toBe(50);
        });
        
        it('should set up intersection observer', () => {
            expect(global.IntersectionObserver).toHaveBeenCalled();
        });
        
        it('should set up scroll listener', () => {
            expect(container.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
        });
    });
    
    describe('Message Batching', () => {
        it('should batch messages', async () => {
            messageManager.addMessage('Message 1', 'sent', 1);
            messageManager.addMessage('Message 2', 'received', 2);
            
            // Should not process immediately (batch size is 3)
            expect(container.appendChild).not.toHaveBeenCalled();
            
            messageManager.addMessage('Message 3', 'sent', 3);
            
            // Should process batch immediately when batch size is reached
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(container.appendChild).toHaveBeenCalled();
        });
        
        it('should process partial batch after timeout', async () => {
            messageManager.addMessage('Message 1', 'sent', 1);
            messageManager.addMessage('Message 2', 'received', 2);
            
            // Wait for batch timeout
            await new Promise(resolve => setTimeout(resolve, 60));
            
            expect(container.appendChild).toHaveBeenCalled();
        });
        
        it('should clear batch timeout when processing', () => {
            messageManager.addMessage('Message 1', 'sent', 1);
            expect(messageManager.batchTimeout).toBeDefined();
            
            // Add enough messages to trigger immediate processing
            messageManager.addMessage('Message 2', 'received', 2);
            messageManager.addMessage('Message 3', 'sent', 3);
            
            expect(messageManager.batchTimeout).toBeNull();
        });
    });
    
    describe('Message Creation', () => {
        it('should create message elements with correct structure', () => {
            const mockElement = document.createElement('div');
            const mockBubble = document.createElement('div');
            const mockContent = document.createElement('div');
            const mockMeta = document.createElement('div');
            const mockTime = document.createElement('span');
            
            document.createElement.mockReturnValueOnce(mockElement)
                              .mockReturnValueOnce(mockBubble)
                              .mockReturnValueOnce(mockContent)
                              .mockReturnValueOnce(mockMeta)
                              .mockReturnValueOnce(mockTime);
            
            const messageData = {
                message: 'Test message',
                type: 'sent',
                messageId: 123,
                timestamp: Date.now()
            };
            
            const element = messageManager.createMessageElement(messageData);
            
            expect(mockElement.className).toBe('message sent');
            expect(mockElement.setAttribute).toHaveBeenCalledWith('data-message-id', 123);
            expect(mockBubble.className).toBe('message-bubble');
            expect(mockContent.className).toBe('message-content');
            expect(mockContent.textContent).toBe('Test message');
        });
        
        it('should add delivery status for sent messages', () => {
            const mockStatusElement = document.createElement('span');
            document.createElement.mockReturnValue(mockStatusElement);
            
            const messageData = {
                message: 'Test message',
                type: 'sent',
                messageId: 123,
                timestamp: Date.now()
            };
            
            messageManager.createMessageElement(messageData);
            
            // Should create status element for sent messages
            expect(document.createElement).toHaveBeenCalledWith('span');
        });
        
        it('should sanitize message content', () => {
            const maliciousMessage = '<script>alert("xss")</script>';
            SecurityManager.sanitizeMessage.mockReturnValue('scriptalert("xss")/script');
            
            messageManager.addMessage(maliciousMessage, 'sent', 1);
            
            expect(SecurityManager.sanitizeMessage).toHaveBeenCalledWith(maliciousMessage);
        });
    });
    
    describe('Memory Management', () => {
        it('should cleanup old messages when threshold is reached', () => {
            // Set current message count to trigger cleanup
            container.children = new Array(12); // Above maxMessages (10)
            messageManager.messages = new Array(12);
            
            // Add messages to trigger cleanup check
            messageManager.addMessage('New message', 'sent', 1);
            
            // Should call cleanup
            expect(messageManager.messages.length).toBeLessThanOrEqual(messageManager.maxMessages);
        });
        
        it('should remove DOM elements during cleanup', () => {
            // Setup messages with DOM elements
            for (let i = 0; i < 15; i++) {
                const mockElement = { parentNode: container };
                messageManager.messages.push({ messageId: i });
                messageManager.messageElements.set(i, mockElement);
                container.children.push(mockElement);
            }
            
            messageManager.cleanup(5);
            
            // Should remove old messages
            expect(messageManager.messages.length).toBe(10);
            expect(messageManager.messageElements.size).toBe(10);
        });
        
        it('should handle cleanup of orphaned DOM elements', () => {
            // Setup container with more children than messages
            container.children = new Array(15);
            container.firstElementChild = { remove: vi.fn() };
            container.removeChild = vi.fn();
            messageManager.messages = new Array(8);
            
            messageManager.cleanup();
            
            // Should clean up orphaned elements
            expect(container.removeChild).toHaveBeenCalled();
        });
    });
    
    describe('Message Status Updates', () => {
        it('should update message delivery status', () => {
            const mockElement = {
                querySelector: vi.fn().mockReturnValue({
                    textContent: '✓',
                    className: 'message-status pending',
                    setAttribute: vi.fn()
                })
            };
            
            messageManager.messageElements.set(123, mockElement);
            
            messageManager.updateMessageStatus(123, 'delivered');
            
            expect(mockElement.querySelector).toHaveBeenCalledWith('.message-status');
        });
        
        it('should handle different status types', () => {
            const mockStatusElement = {
                textContent: '✓',
                className: 'message-status pending',
                setAttribute: vi.fn()
            };
            
            const mockElement = {
                querySelector: vi.fn().mockReturnValue(mockStatusElement)
            };
            
            messageManager.messageElements.set(123, mockElement);
            
            // Test delivered status
            messageManager.updateMessageStatus(123, 'delivered');
            expect(mockStatusElement.textContent).toBe('✓✓');
            expect(mockStatusElement.className).toBe('message-status delivered');
            
            // Test failed status
            messageManager.updateMessageStatus(123, 'failed');
            expect(mockStatusElement.textContent).toBe('⚠');
            expect(mockStatusElement.className).toBe('message-status failed');
            
            // Test read status
            messageManager.updateMessageStatus(123, 'read');
            expect(mockStatusElement.textContent).toBe('✓✓');
            expect(mockStatusElement.className).toBe('message-status read');
        });
    });
    
    describe('Scrolling Behavior', () => {
        it('should scroll to bottom when user is at bottom', () => {
            messageManager.isScrolledToBottom = true;
            container.scrollTo = vi.fn();
            
            messageManager.scrollToBottom();
            
            expect(container.scrollTo).toHaveBeenCalledWith({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        });
        
        it('should use fallback scroll for older browsers', () => {
            messageManager.isScrolledToBottom = true;
            container.scrollTo = undefined;
            
            messageManager.scrollToBottom();
            
            expect(container.scrollTop).toBe(container.scrollHeight);
        });
    });
    
    describe('Unread Count Management', () => {
        it('should update unread count', () => {
            const mockUnreadElement = {
                textContent: '0',
                style: { display: 'none' }
            };
            
            document.getElementById.mockReturnValue(mockUnreadElement);
            
            messageManager.updateUnreadCount(3);
            
            expect(mockUnreadElement.textContent).toBe('3');
            expect(mockUnreadElement.style.display).toBe('inline-block');
        });
        
        it('should handle large unread counts', () => {
            const mockUnreadElement = {
                textContent: '0',
                style: { display: 'none' }
            };
            
            document.getElementById.mockReturnValue(mockUnreadElement);
            
            messageManager.updateUnreadCount(150);
            
            expect(mockUnreadElement.textContent).toBe('99+');
        });
        
        it('should clear unread count', () => {
            const mockUnreadElement = {
                textContent: '5',
                style: { display: 'inline-block' }
            };
            
            document.getElementById.mockReturnValue(mockUnreadElement);
            
            messageManager.clearUnreadCount();
            
            expect(mockUnreadElement.textContent).toBe('0');
            expect(mockUnreadElement.style.display).toBe('none');
        });
    });
    
    describe('Statistics and Monitoring', () => {
        it('should provide message statistics', () => {
            messageManager.messages = new Array(5);
            container.children = new Array(5);
            messageManager.messageElements.set(1, {});
            messageManager.messageElements.set(2, {});
            messageManager.pendingBatch = ['msg1', 'msg2'];
            
            const stats = messageManager.getStats();
            
            expect(stats.totalMessages).toBe(5);
            expect(stats.domElements).toBe(5);
            expect(stats.pendingBatch).toBe(2);
            expect(stats.memoryUsage).toBe(2);
        });
    });
    
    describe('Cleanup and Destruction', () => {
        it('should clear all messages', () => {
            messageManager.messages = ['msg1', 'msg2'];
            messageManager.messageElements.set(1, {});
            messageManager.pendingBatch = ['pending'];
            container.firstChild = { remove: vi.fn() };
            
            messageManager.clearAllMessages();
            
            expect(messageManager.messages).toHaveLength(0);
            expect(messageManager.messageElements.size).toBe(0);
            expect(messageManager.pendingBatch).toHaveLength(0);
        });
        
        it('should destroy properly', () => {
            const mockObserver = { disconnect: vi.fn() };
            messageManager.observer = mockObserver;
            messageManager.batchTimeout = setTimeout(() => {}, 1000);
            
            messageManager.destroy();
            
            expect(mockObserver.disconnect).toHaveBeenCalled();
            expect(messageManager.container).toBeNull();
        });
    });
    
    describe('Performance Tests', () => {
        it('should handle rapid message addition', () => {
            const startTime = performance.now();
            
            // Add 100 messages rapidly
            for (let i = 0; i < 100; i++) {
                messageManager.addMessage(`Message ${i}`, 'sent', i);
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Should complete within reasonable time
            expect(duration).toBeLessThan(100);
        });
        
        it('should handle large message batches efficiently', async () => {
            // Set large batch size
            messageManager.batchSize = 50;
            
            const startTime = performance.now();
            
            // Add large batch
            for (let i = 0; i < 50; i++) {
                messageManager.addMessage(`Large batch message ${i}`, 'sent', i);
            }
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 20));
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(200);
            expect(container.appendChild).toHaveBeenCalled();
        });
    });
});