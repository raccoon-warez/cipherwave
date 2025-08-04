// Chat Component for CipherWave - Message Display and Management
// Handles message rendering, chat UI, and real-time updates

class ChatComponent extends BaseComponent {
    constructor(container, options = {}) {
        super(container, options);
        
        this.state = {
            isVisible: false,
            peerInfo: {
                name: 'Unknown Peer',
                status: 'Offline',
                avatar: '/cipherwave.png'
            },
            connectionStatus: 'disconnected',
            messages: [],
            isScrolledToBottom: true,
            isTyping: false
        };
        
        this.messageManager = null;
        this.messagesContainer = null;
        this.intersectionObserver = null;
        
        if (this.options.autoRender) {
            this.render();
        }
    }
    
    getDefaultOptions() {
        return {
            ...super.getDefaultOptions(),
            className: 'chat-overlay',
            showWelcomeMessage: true,
            maxMessages: 1000,
            enableVirtualScrolling: true,
            animateMessages: true,
            showMessageStatus: true,
            showTypingIndicator: true
        };
    }
    
    createTemplate() {
        return `
            <div class="${this.options.className} ${this.state.isVisible ? '' : 'hidden'}">
                <div class="chat-window">
                    ${this.createChatHeader()}
                    ${this.createMessagesContainer()}
                    ${this.createMessageInput()}
                </div>
            </div>
        `;
    }
    
    createChatHeader() {
        const statusConfig = {
            connected: { text: 'Connected', icon: 'fas fa-check-circle', color: '#4CAF50' },
            connecting: { text: 'Connecting...', icon: 'fas fa-spinner fa-spin', color: '#FF9800' },
            disconnected: { text: 'Disconnected', icon: 'fas fa-times-circle', color: '#F44336' }
        };
        
        const config = statusConfig[this.state.connectionStatus] || statusConfig.disconnected;
        
        return `
            <div class="chat-header">
                <button class="back-btn" type="button" aria-label="Close chat">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <div class="chat-info">
                    <img src="${this.state.peerInfo.avatar}" alt="${this.state.peerInfo.name}" class="peer-avatar">
                    <div class="peer-details">
                        <h3>${this.escapeHTML(this.state.peerInfo.name)}</h3>
                        <p style="color: ${config.color}">
                            <i class="${config.icon}"></i>
                            ${config.text}
                        </p>
                    </div>
                </div>
                <div class="chat-actions">
                    <button class="action-btn" type="button" aria-label="Chat options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    createMessagesContainer() {
        return `
            <div class="messages-container" id="messages-container">
                ${this.options.showWelcomeMessage ? this.createWelcomeMessage() : ''}
                <div class="messages-list" id="messages-list">
                    ${this.state.messages.map(message => this.createMessageElement(message)).join('')}
                </div>
                ${this.state.isTyping ? this.createTypingIndicator() : ''}
            </div>
        `;
    }
    
    createWelcomeMessage() {
        return `
            <div class="welcome-message">
                <i class="fas fa-lock"></i>
                <span>Messages are end-to-end encrypted. Only you and the recipient can read them.</span>
            </div>
        `;
    }
    
    createTypingIndicator() {
        if (!this.options.showTypingIndicator) return '';
        
        return `
            <div class="typing-indicator">
                <div class="typing-animation">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span class="typing-text">Peer is typing...</span>
            </div>
        `;
    }
    
    createMessageElement(message) {
        const messageClass = `message ${message.type} ${this.options.animateMessages ? 'animated' : ''}`;
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="${messageClass}" data-message-id="${message.id || ''}">
                <div class="message-bubble">
                    <div class="message-content">${this.escapeHTML(message.content)}</div>
                    <div class="message-meta">
                        <span class="message-time">${timestamp}</span>
                        ${this.options.showMessageStatus && message.type === 'sent' ? 
                            `<span class="message-status ${message.status || 'pending'}">
                                ${this.getStatusIcon(message.status)}
                            </span>` : ''
                        }
                    </div>
                </div>
            </div>
        `;
    }
    
    getStatusIcon(status) {
        const icons = {
            pending: '<i class="fas fa-clock"></i>',
            delivered: '<i class="fas fa-check"></i>',
            read: '<i class="fas fa-check-double"></i>',
            failed: '<i class="fas fa-exclamation-triangle"></i>'
        };
        return icons[status] || icons.pending;
    }
    
    createMessageInput() {
        return `
            <div class="message-input-container">
                <div class="input-wrapper">
                    <button class="attachment-btn" type="button" aria-label="Attach file">
                        <i class="fas fa-paperclip"></i>
                    </button>
                    <input type="text" 
                           class="message-input" 
                           id="message-input"
                           placeholder="Type a message..." 
                           maxlength="5000"
                           autocomplete="off">
                    <button class="emoji-btn" type="button" aria-label="Add emoji">
                        <i class="fas fa-smile"></i>
                    </button>
                    <button class="send-btn" type="button" aria-label="Send message" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    attachEventListeners() {
        // Back button
        const backBtn = this.querySelector('.back-btn');
        if (backBtn) {
            this.addEventListener(backBtn, 'click', this.handleBack);
        }
        
        // Message input
        const messageInput = this.querySelector('.message-input');
        const sendBtn = this.querySelector('.send-btn');
        
        if (messageInput) {
            this.addEventListener(messageInput, 'input', this.handleInputChange);
            this.addEventListener(messageInput, 'keypress', this.handleKeyPress);
            this.addEventListener(messageInput, 'focus', this.handleInputFocus);
            this.addEventListener(messageInput, 'blur', this.handleInputBlur);
        }
        
        if (sendBtn) {
            this.addEventListener(sendBtn, 'click', this.handleSend);
        }
        
        // Attachment button
        const attachBtn = this.querySelector('.attachment-btn');
        if (attachBtn) {
            this.addEventListener(attachBtn, 'click', this.handleAttachment);
        }
        
        // Emoji button
        const emojiBtn = this.querySelector('.emoji-btn');
        if (emojiBtn) {
            this.addEventListener(emojiBtn, 'click', this.handleEmoji);
        }
        
        // Chat actions
        const actionsBtn = this.querySelector('.chat-actions .action-btn');
        if (actionsBtn) {
            this.addEventListener(actionsBtn, 'click', this.handleChatActions);
        }
        
        // Messages container scroll
        this.messagesContainer = this.querySelector('.messages-container');
        if (this.messagesContainer) {
            this.addEventListener(this.messagesContainer, 'scroll', this.handleScroll);
            this.setupIntersectionObserver();
        }
    }
    
    initializeSubComponents() {
        // Initialize message manager if available
        if (typeof MessageManager !== 'undefined' && this.messagesContainer) {
            this.messageManager = new MessageManager(this.querySelector('.messages-list'), {
                maxMessages: this.options.maxMessages,
                batchSize: 10,
                batchInterval: 100
            });
        }
    }
    
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window) || !this.messagesContainer) return;
        
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.target === this.messagesContainer.lastElementChild) {
                    this.setState({ isScrolledToBottom: entry.isIntersecting });
                }
            });
        }, {
            root: this.messagesContainer,
            threshold: 0.1
        });
        
        // Observe the last message
        const lastMessage = this.messagesContainer.lastElementChild;
        if (lastMessage) {
            this.intersectionObserver.observe(lastMessage);
        }
    }
    
    handleBack(event) {
        event.preventDefault();
        this.hide();
        this.emit('chatClose');
    }
    
    handleInputChange(event) {
        const input = event.target;
        const sendBtn = this.querySelector('.send-btn');
        
        if (sendBtn) {
            sendBtn.disabled = !input.value.trim();
        }
        
        // Emit typing events
        if (input.value.trim()) {
            this.emit('userTyping', { isTyping: true });
        } else {
            this.emit('userTyping', { isTyping: false });
        }
    }
    
    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSend();
        }
    }
    
    handleInputFocus() {
        // Handle mobile keyboard opening
        if (window.innerWidth <= 768) {
            this.element.classList.add('keyboard-open');
        }
    }
    
    handleInputBlur() {
        // Handle mobile keyboard closing
        if (window.innerWidth <= 768) {
            this.element.classList.remove('keyboard-open');
        }
        
        this.emit('userTyping', { isTyping: false });
    }
    
    handleSend() {
        const messageInput = this.querySelector('.message-input');
        if (!messageInput) return;
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // Create message object
        const messageObj = {
            id: Date.now().toString(),
            content: message,
            type: 'sent',
            timestamp: Date.now(),
            status: 'pending'
        };
        
        // Add to local messages
        this.addMessage(messageObj);
        
        // Clear input
        messageInput.value = '';
        const sendBtn = this.querySelector('.send-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
        }
        
        // Emit send event
        this.emit('messageSend', { message: messageObj });
        this.emit('userTyping', { isTyping: false });
    }
    
    handleAttachment() {
        this.emit('attachmentRequest');
    }
    
    handleEmoji() {
        this.emit('emojiRequest');
    }
    
    handleChatActions() {
        this.emit('chatActionsRequest');
    }
    
    handleScroll() {
        if (!this.messagesContainer) return;
        
        const { scrollTop, scrollHeight, clientHeight } = this.messagesContainer;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
        
        if (this.state.isScrolledToBottom !== isAtBottom) {
            this.setState({ isScrolledToBottom: isAtBottom });
        }
    }
    
    // Public API methods
    show() {
        this.setState({ isVisible: true });
        super.show();
        
        // Focus message input
        setTimeout(() => {
            const messageInput = this.querySelector('.message-input');
            if (messageInput) {
                messageInput.focus();
            }
        }, 100);
        
        this.emit('chatShow');
        return this;
    }
    
    hide() {
        this.setState({ isVisible: false });
        super.hide();
        this.emit('chatHide');
        return this;
    }
    
    addMessage(message) {
        // Add message to state
        const messages = [...this.state.messages, message];
        this.setState({ messages });
        
        // Use message manager if available
        if (this.messageManager) {
            this.messageManager.addMessage(message.content, message.type, message.id);
        } else {
            // Fallback: direct DOM manipulation
            this.appendMessageToDom(message);
        }
        
        // Auto-scroll if at bottom
        if (this.state.isScrolledToBottom) {
            this.scrollToBottom();
        }
        
        // Update intersection observer
        this.updateIntersectionObserver();
    }
    
    appendMessageToDom(message) {
        const messagesList = this.querySelector('.messages-list');
        if (!messagesList) return;
        
        const messageElement = this.createElement('div');
        messageElement.innerHTML = this.createMessageElement(message);
        messagesList.appendChild(messageElement.firstElementChild);
    }
    
    updateMessageStatus(messageId, status) {
        // Update in state
        const messages = this.state.messages.map(msg => 
            msg.id === messageId ? { ...msg, status } : msg
        );
        this.setState({ messages });
        
        // Update in DOM
        const messageElement = this.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status');
            if (statusElement) {
                statusElement.className = `message-status ${status}`;
                statusElement.innerHTML = this.getStatusIcon(status);
            }
        }
        
        // Use message manager if available
        if (this.messageManager && this.messageManager.updateMessageStatus) {
            this.messageManager.updateMessageStatus(messageId, status);
        }
    }
    
    clearMessages() {
        this.setState({ messages: [] });
        
        if (this.messageManager && this.messageManager.clearAllMessages) {
            this.messageManager.clearAllMessages();
        } else {
            const messagesList = this.querySelector('.messages-list');
            if (messagesList) {
                messagesList.innerHTML = '';
            }
        }
    }
    
    scrollToBottom(smooth = true) {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTo({
                top: this.messagesContainer.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }
    
    setPeerInfo(peerInfo) {
        this.setState({ peerInfo: { ...this.state.peerInfo, ...peerInfo } });
        this.updateChatHeader();
    }
    
    setConnectionStatus(status) {
        this.setState({ connectionStatus: status });
        this.updateChatHeader();
    }
    
    updateChatHeader() {
        const chatHeader = this.querySelector('.chat-header');
        if (chatHeader) {
            chatHeader.outerHTML = this.createChatHeader();
            
            // Re-attach header event listeners
            const backBtn = this.querySelector('.back-btn');
            if (backBtn) {
                this.addEventListener(backBtn, 'click', this.handleBack);
            }
            
            const actionsBtn = this.querySelector('.chat-actions .action-btn');
            if (actionsBtn) {
                this.addEventListener(actionsBtn, 'click', this.handleChatActions);
            }
        }
    }
    
    setTyping(isTyping) {
        if (this.state.isTyping !== isTyping) {
            this.setState({ isTyping });
            this.updateTypingIndicator();
        }
    }
    
    updateTypingIndicator() {
        const container = this.querySelector('.messages-container');
        if (!container) return;
        
        const existingIndicator = container.querySelector('.typing-indicator');
        
        if (this.state.isTyping && !existingIndicator) {
            const indicator = this.createElement('div');
            indicator.innerHTML = this.createTypingIndicator();
            container.appendChild(indicator.firstElementChild);
            
            // Auto-scroll if at bottom
            if (this.state.isScrolledToBottom) {
                this.scrollToBottom();
            }
        } else if (!this.state.isTyping && existingIndicator) {
            existingIndicator.remove();
        }
    }
    
    updateIntersectionObserver() {
        if (this.intersectionObserver && this.messagesContainer) {
            // Unobserve previous last element
            const previousLast = this.messagesContainer.querySelector('.message:last-child');
            if (previousLast) {
                this.intersectionObserver.unobserve(previousLast);
            }
            
            // Observe new last element
            setTimeout(() => {
                const lastMessage = this.messagesContainer.querySelector('.message:last-child');
                if (lastMessage) {
                    this.intersectionObserver.observe(lastMessage);
                }
            }, 50);
        }
    }
    
    getMessageCount() {
        return this.state.messages.length;
    }
    
    beforeDestroy() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        
        if (this.messageManager && this.messageManager.destroy) {
            this.messageManager.destroy();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatComponent;
} else if (typeof window !== 'undefined') {
    window.ChatComponent = ChatComponent;
}