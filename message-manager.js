// CipherWave Message Manager
// Handles message batching, memory management, and UI optimization

class MessageManager {
    constructor(container, options = {}) {
        this.container = container;
        this.maxMessages = options.maxMessages || 1000;
        this.cleanupThreshold = options.cleanupThreshold || 1200;
        this.batchSize = options.batchSize || 10;
        this.batchInterval = options.batchInterval || 100;
        
        this.messages = [];
        this.messageElements = new Map();
        this.pendingBatch = [];
        this.batchTimeout = null;
        this.isScrolledToBottom = true;
        this.observer = null;
        
        this.initializeIntersectionObserver();
        this.setupScrollListener();
    }
    
    initializeIntersectionObserver() {
        // Use Intersection Observer to detect when user scrolls away from bottom
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.target === this.container.lastElementChild) {
                        this.isScrolledToBottom = entry.isIntersecting;
                    }
                });
            }, {
                root: this.container,
                threshold: 0.1
            });
        }
    }
    
    setupScrollListener() {
        // Throttled scroll listener for scroll position tracking
        let scrollTimeout;
        this.container.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const { scrollTop, scrollHeight, clientHeight } = this.container;
                this.isScrolledToBottom = scrollTop + clientHeight >= scrollHeight - 10;
            }, 100);
        }, { passive: true });
    }
    
    // Add message to batch for processing
    addMessage(message, type, messageId = null) {
        const messageData = {
            message: SecurityManager.sanitizeMessage(message),
            type: type,
            messageId: messageId,
            timestamp: Date.now()
        };
        
        this.pendingBatch.push(messageData);
        
        // Process immediately if batch is full
        if (this.pendingBatch.length >= this.batchSize) {
            this.processBatch();
        } else if (!this.batchTimeout) {
            // Set timeout for partial batch
            this.batchTimeout = setTimeout(() => {
                this.processBatch();
            }, this.batchInterval);
        }
    }
    
    // Process batch of messages
    processBatch() {
        if (this.pendingBatch.length === 0) return;
        
        // Clear timeout
        this.clearBatchTimeout();
        
        // Create document fragment for efficient DOM updates
        const fragment = document.createDocumentFragment();
        const batch = this.pendingBatch.splice(0);
        
        // Check if we need cleanup before adding new messages
        this.performCleanupIfNeeded();
        
        // Process each message in the batch
        batch.forEach(messageData => {
            const element = this.createMessageElement(messageData);
            fragment.appendChild(element);
            
            // Store reference for cleanup
            if (messageData.messageId) {
                this.messageElements.set(messageData.messageId, element);
            }
            
            // Add to messages array
            this.messages.push(messageData);
        });
        
        // Single DOM update for entire batch
        requestAnimationFrame(() => {
            this.container.appendChild(fragment);
            
            // Observe last message for scroll detection
            if (this.observer && this.container.lastElementChild) {
                this.observer.observe(this.container.lastElementChild);
            }
            
            // Auto-scroll if user was at bottom
            if (this.isScrolledToBottom) {
                this.scrollToBottom();
            }
            
            // Update unread count if not scrolled to bottom
            if (!this.isScrolledToBottom) {
                this.updateUnreadCount(batch.length);
            }
        });
    }
    
    // Create message element with security measures
    createMessageElement(messageData) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${messageData.type}`;
        
        if (messageData.messageId) {
            messageElement.setAttribute('data-message-id', messageData.messageId);
        }
        
        // Create message structure
        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        // Use textContent to prevent XSS - already sanitized by SecurityManager
        messageContent.textContent = messageData.message;
        
        const messageMeta = document.createElement('div');
        messageMeta.className = 'message-meta';
        
        const messageTime = document.createElement('span');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date(messageData.timestamp).toLocaleTimeString();
        messageMeta.appendChild(messageTime);
        
        // Add delivery status for sent messages
        if (messageData.type === 'sent') {
            const statusElement = document.createElement('span');
            statusElement.className = 'message-status pending';
            statusElement.textContent = '✓';
            statusElement.setAttribute('aria-label', 'Message sent');
            messageMeta.appendChild(statusElement);
        }
        
        // Assemble message structure
        messageBubble.appendChild(messageContent);
        messageBubble.appendChild(messageMeta);
        messageElement.appendChild(messageBubble);
        
        return messageElement;
    }
    
    // Cleanup old messages to prevent memory leaks
    performCleanupIfNeeded() {
        if (this.messages.length >= this.cleanupThreshold) {
            const messagesToRemove = this.messages.length - this.maxMessages;
            this.cleanup(messagesToRemove);
        }
    }
    
    cleanup(count = null) {
        const removeCount = count || (this.messages.length - this.maxMessages);
        if (removeCount <= 0) return;
        
        // Remove old messages from array
        const removedMessages = this.messages.splice(0, removeCount);
        
        // Remove corresponding DOM elements
        removedMessages.forEach(messageData => {
            if (messageData.messageId) {
                const element = this.messageElements.get(messageData.messageId);
                if (element && element.parentNode) {
                    // Unobserve before removing
                    if (this.observer) {
                        this.observer.unobserve(element);
                    }
                    element.parentNode.removeChild(element);
                }
                this.messageElements.delete(messageData.messageId);
            }
        });
        
        // Remove orphaned DOM elements (fallback)
        while (this.container.children.length > this.maxMessages) {
            const firstChild = this.container.firstElementChild;
            if (firstChild) {
                if (this.observer) {
                    this.observer.unobserve(firstChild);
                }
                this.container.removeChild(firstChild);
            }
        }
        
        console.log(`Cleaned up ${removeCount} old messages`);
    }
    
    // Update message delivery status
    updateMessageStatus(messageId, status) {
        const element = this.messageElements.get(messageId);
        if (element) {
            const statusElement = element.querySelector('.message-status');
            if (statusElement) {
                switch (status) {
                    case 'delivered':
                        statusElement.textContent = '✓✓';
                        statusElement.className = 'message-status delivered';
                        statusElement.setAttribute('aria-label', 'Message delivered');
                        break;
                    case 'failed':
                        statusElement.textContent = '⚠';
                        statusElement.className = 'message-status failed';
                        statusElement.setAttribute('aria-label', 'Message failed');
                        break;
                    case 'read':
                        statusElement.textContent = '✓✓';
                        statusElement.className = 'message-status read';
                        statusElement.setAttribute('aria-label', 'Message read');
                        break;
                }
            }
        }
    }
    
    // Smooth scroll to bottom
    scrollToBottom() {
        if (this.container.scrollTo) {
            this.container.scrollTo({
                top: this.container.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            // Fallback for older browsers
            this.container.scrollTop = this.container.scrollHeight;
        }
    }
    
    // Update unread message count
    updateUnreadCount(increment = 1) {
        const unreadElement = document.getElementById('unread-count');
        if (unreadElement) {
            let currentCount = parseInt(unreadElement.textContent) || 0;
            currentCount += increment;
            
            if (currentCount > 0) {
                unreadElement.textContent = currentCount > 99 ? '99+' : currentCount.toString();
                unreadElement.style.display = 'inline-block';
            } else {
                unreadElement.style.display = 'none';
            }
        }
    }
    
    // Clear unread count when user scrolls to bottom
    clearUnreadCount() {
        const unreadElement = document.getElementById('unread-count');
        if (unreadElement) {
            unreadElement.style.display = 'none';
            unreadElement.textContent = '0';
        }
    }
    
    // Clear all messages
    clearAllMessages() {
        this.clearBatchTimeout();
        
        // Clear DOM
        while (this.container.firstChild) {
            const child = this.container.firstChild;
            if (this.observer) {
                this.observer.unobserve(child);
            }
            this.container.removeChild(child);
        }
        
        // Clear data structures
        this.messages = [];
        this.messageElements.clear();
        this.pendingBatch = [];
        this.clearUnreadCount();
    }
    
    // Get message statistics
    getStats() {
        return {
            totalMessages: this.messages.length,
            domElements: this.container.children.length,
            pendingBatch: this.pendingBatch.length,
            memoryUsage: this.messageElements.size
        };
    }
    
    // Clear batch timeout
    clearBatchTimeout() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
    }
    
    // Destroy and cleanup
    destroy() {
        this.clearBatchTimeout();
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        this.clearAllMessages();
        this.container = null;
    }
}

// Virtual scrolling for very large message lists
class VirtualMessageManager extends MessageManager {
    constructor(container, options = {}) {
        super(container, options);
        this.itemHeight = options.itemHeight || 60;
        this.visibleItems = Math.ceil(container.clientHeight / this.itemHeight) + 5;
        this.bufferSize = options.bufferSize || 5;
        this.startIndex = 0;
        this.endIndex = this.visibleItems;
        
        this.setupVirtualScrolling();
    }
    
    setupVirtualScrolling() {
        this.container.addEventListener('scroll', () => {
            this.updateVisibleRange();
        }, { passive: true });
        
        // Update visible range on resize
        window.addEventListener('resize', () => {
            this.visibleItems = Math.ceil(this.container.clientHeight / this.itemHeight) + 5;
            this.updateVisibleRange();
        }, { passive: true });
    }
    
    updateVisibleRange() {
        const scrollTop = this.container.scrollTop;
        const newStartIndex = Math.floor(scrollTop / this.itemHeight);
        const newEndIndex = Math.min(
            newStartIndex + this.visibleItems + this.bufferSize * 2,
            this.messages.length
        );
        
        if (newStartIndex !== this.startIndex || newEndIndex !== this.endIndex) {
            this.startIndex = Math.max(0, newStartIndex - this.bufferSize);
            this.endIndex = newEndIndex;
            this.renderVisibleMessages();
        }
    }
    
    renderVisibleMessages() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create spacer for messages before visible range
        if (this.startIndex > 0) {
            const topSpacer = document.createElement('div');
            topSpacer.style.height = `${this.startIndex * this.itemHeight}px`;
            this.container.appendChild(topSpacer);
        }
        
        // Render visible messages
        const fragment = document.createDocumentFragment();
        for (let i = this.startIndex; i < this.endIndex && i < this.messages.length; i++) {
            const messageData = this.messages[i];
            const element = this.createMessageElement(messageData);
            fragment.appendChild(element);
        }
        this.container.appendChild(fragment);
        
        // Create spacer for messages after visible range
        if (this.endIndex < this.messages.length) {
            const bottomSpacer = document.createElement('div');
            bottomSpacer.style.height = `${(this.messages.length - this.endIndex) * this.itemHeight}px`;
            this.container.appendChild(bottomSpacer);
        }
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MessageManager, VirtualMessageManager };
} else {
    window.MessageManager = MessageManager;
    window.VirtualMessageManager = VirtualMessageManager;
}