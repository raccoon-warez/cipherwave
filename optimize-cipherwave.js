// CipherWave Performance Optimization Script
// This script implements various optimizations to improve the performance of the CipherWave application

// 1. Message batching to reduce DOM updates
class MessageBatcher {
    constructor(batchSize = 10, interval = 100) {
        this.batchSize = batchSize;
        this.interval = interval;
        this.messageQueue = [];
        this.batchTimer = null;
    }
    
    addMessage(message, type, messageId = null) {
        this.messageQueue.push({ message, type, messageId });
        
        // If we've reached batch size, process immediately
        if (this.messageQueue.length >= this.batchSize) {
            this.processBatch();
        } else if (!this.batchTimer) {
            // Otherwise, set a timer to process the batch
            this.batchTimer = setTimeout(() => {
                this.processBatch();
            }, this.interval);
        }
    }
    
    processBatch() {
        if (this.messageQueue.length === 0) return;
        
        // Clear the timer if it exists
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        
        // Process all messages in the queue
        const fragment = document.createDocumentFragment();
        
        this.messageQueue.forEach(({ message, type, messageId }) => {
            const messageElement = this.createMessageElement(message, type, messageId);
            fragment.appendChild(messageElement);
        });
        
        // Add all messages to the DOM at once
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.appendChild(fragment);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // Clear the queue
        this.messageQueue = [];
    }
    
    createMessageElement(message, type, messageId) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        
        if (messageId) {
            messageElement.setAttribute('data-message-id', messageId);
        }
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = message;
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = timeString;
        
        // Add delivery status indicator for sent messages
        if (type === 'sent') {
            const statusElement = document.createElement('span');
            statusElement.className = 'message-status';
            statusElement.textContent = '✓';
            messageTime.appendChild(statusElement);
        }
        
        messageElement.appendChild(messageContent);
        messageElement.appendChild(messageTime);
        
        return messageElement;
    }
}

// 2. Connection pooling for WebSocket connections
class ConnectionPool {
    constructor(maxConnections = 5) {
        this.maxConnections = maxConnections;
        this.connections = [];
        this.availableConnections = [];
    }
    
    async getConnection(url) {
        // Try to get an available connection
        if (this.availableConnections.length > 0) {
            return this.availableConnections.pop();
        }
        
        // If we haven't reached the max, create a new connection
        if (this.connections.length < this.maxConnections) {
            const connection = new WebSocket(url);
            this.connections.push(connection);
            return new Promise((resolve) => {
                connection.onopen = () => resolve(connection);
            });
        }
        
        // Wait for a connection to become available
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.availableConnections.length > 0) {
                    clearInterval(checkInterval);
                    resolve(this.availableConnections.pop());
                }
            }, 100);
        });
    }
    
    releaseConnection(connection) {
        if (connection.readyState === WebSocket.OPEN) {
            this.availableConnections.push(connection);
        }
    }
}

// 3. Memory management for large message histories
class MessageHistoryManager {
    constructor(maxMessages = 100) {
        this.maxMessages = maxMessages;
        this.messages = [];
    }
    
    addMessage(messageData) {
        this.messages.push(messageData);
        
        // If we've exceeded the max, remove the oldest messages
        if (this.messages.length > this.maxMessages) {
            const excess = this.messages.length - this.maxMessages;
            this.messages.splice(0, excess);
            
            // Also remove excess messages from the DOM
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                while (messagesContainer.children.length > this.maxMessages) {
                    messagesContainer.removeChild(messagesContainer.firstChild);
                }
            }
        }
    }
    
    getMessages() {
        return [...this.messages];
    }
    
    clear() {
        this.messages = [];
    }
}

// 4. Lazy loading for avatars and images
class LazyLoader {
    constructor() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '50px'
        });
    }
    
    loadImage(img) {
        const src = img.dataset.src;
        if (src) {
            img.src = src;
            img.classList.remove('lazy');
        }
    }
    
    observe(img) {
        this.observer.observe(img);
    }
}

// 5. Web Workers for encryption/decryption
class EncryptionWorker {
    constructor() {
        this.worker = null;
        this.messageId = 0;
        this.callbacks = new Map();
        
        try {
            // Create a web worker for encryption tasks
            const workerCode = `
                self.addEventListener('message', function(e) {
                    const { id, action, data, key } = e.data;
                    
                    try {
                        let result;
                        switch (action) {
                            case 'encrypt':
                                // In a real implementation, we would use the actual encryption
                                // For now, we'll just simulate the work
                                result = data; // Placeholder
                                break;
                            case 'decrypt':
                                // In a real implementation, we would use the actual decryption
                                // For now, we'll just simulate the work
                                result = data; // Placeholder
                                break;
                            default:
                                throw new Error('Unknown action: ' + action);
                        }
                        
                        self.postMessage({ id, result });
                    } catch (error) {
                        self.postMessage({ id, error: error.message });
                    }
                });
            `;
            
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));
            
            this.worker.addEventListener('message', (e) => {
                const { id, result, error } = e.data;
                const callback = this.callbacks.get(id);
                if (callback) {
                    if (error) {
                        callback.reject(new Error(error));
                    } else {
                        callback.resolve(result);
                    }
                    this.callbacks.delete(id);
                }
            });
        } catch (error) {
            console.warn('Web Workers not supported, falling back to main thread encryption');
        }
    }
    
    encrypt(data, key) {
        return this.executeTask('encrypt', data, key);
    }
    
    decrypt(data, key) {
        return this.executeTask('decrypt', data, key);
    }
    
    executeTask(action, data, key) {
        if (!this.worker) {
            // Fallback to synchronous execution
            return Promise.resolve(data);
        }
        
        return new Promise((resolve, reject) => {
            const id = ++this.messageId;
            this.callbacks.set(id, { resolve, reject });
            
            this.worker.postMessage({ id, action, data, key });
        });
    }
}

// 6. Debouncing for input events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 7. Throttling for scroll events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 8. Performance monitoring
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            messageRenderTime: [],
            encryptionTime: [],
            connectionTime: [],
            memoryUsage: []
        };
    }
    
    startTimer(name) {
        return performance.now();
    }
    
    endTimer(name, startTime) {
        const elapsed = performance.now() - startTime;
        if (this.metrics[name]) {
            this.metrics[name].push(elapsed);
        }
    }
    
    getAverage(name) {
        const times = this.metrics[name];
        if (!times || times.length === 0) return 0;
        return times.reduce((a, b) => a + b, 0) / times.length;
    }
    
    getMetrics() {
        return {
            messageRenderTime: this.getAverage('messageRenderTime'),
            encryptionTime: this.getAverage('encryptionTime'),
            connectionTime: this.getAverage('connectionTime')
        };
    }
}

// 9. Initialize optimizations when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize message batcher
    window.messageBatcher = new MessageBatcher(5, 50);
    
    // Override the displayMessage function to use batching
    const originalDisplayMessage = window.displayMessage;
    window.displayMessage = function(message, type, messageId = null) {
        if (window.messageBatcher) {
            window.messageBatcher.addMessage(message, type, messageId);
        } else if (originalDisplayMessage) {
            originalDisplayMessage.call(this, message, type, messageId);
        }
    };
    
    // Initialize lazy loader
    window.lazyLoader = new LazyLoader();
    
    // Initialize performance monitor
    window.performanceMonitor = new PerformanceMonitor();
    
    // Add lazy loading to existing images
    const lazyImages = document.querySelectorAll('img.lazy');
    lazyImages.forEach(img => {
        window.lazyLoader.observe(img);
    });
    
    console.log('CipherWave optimizations initialized');
});

// 10. Export optimization classes for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MessageBatcher,
        ConnectionPool,
        MessageHistoryManager,
        LazyLoader,
        EncryptionWorker,
        PerformanceMonitor,
        debounce,
        throttle
    };
}
