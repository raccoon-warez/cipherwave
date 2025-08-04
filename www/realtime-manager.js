// Enhanced Real-time Features Manager - Complete messaging experience
class RealtimeManager {
    constructor() {
        // Core state management
        this.typingIndicators = new Map();
        this.typingTimeout = null;
        this.isTyping = false;
        this.lastTypingTime = 0;
        this.typingThrottle = 1500; // 1.5 seconds
        
        // Enhanced emoji support with categories
        this.reactionEmojis = {
            popular: ['❤️', '👍', '😊', '😢', '😮', '😡'],
            faces: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
            hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💖', '💕', '💓', '💗', '💘', '💝'],
            gestures: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👏', '🙌', '👐', '🤲', '🤝', '🙏']
        };
        
        this.userReactions = new Map();
        this.reactionAnimations = new Set();
        
        // Enhanced read receipts with multiple states
        this.readReceipts = new Map();
        this.messageStatuses = new Map();
        this.deliveryConfirmations = new Map();
        
        // Activity and presence tracking
        this.activityIndicators = new Map();
        this.userPresence = new Map();
        this.connectionQuality = new Map();
        this.bandwidthUsage = { sent: 0, received: 0 };
        
        // User management
        this.currentUser = {
            id: this.generateUserId(),
            name: 'You',
            avatar: '/cipherwave.png',
            status: 'online',
            customStatus: '',
            lastSeen: Date.now()
        };
        
        // Performance optimization
        this.debounceTimers = new Map();
        this.animationQueue = [];
        this.isProcessingAnimations = false;
        
        // Mobile optimization
        this.isMobile = window.innerWidth <= 768;
        this.touchStartTime = 0;
        this.longPressThreshold = 500;
        
        // Accessibility
        this.screenReaderAnnouncements = [];
        this.isHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Security
        this.messageEncryption = true;
        this.dataIntegrityChecks = new Map();
    }

    async setup() {
        console.log('⚡ Setting up enhanced real-time features...');
        
        try {
            await this.initializeComponents();
            this.setupEventListeners();
            this.setupPerformanceMonitoring();
            this.setupAccessibilityFeatures();
            this.setupSecurityFeatures();
            
            console.log('✅ Enhanced real-time features initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize real-time features:', error);
        }
    }

    async initializeComponents() {
        // Initialize all components in parallel for better performance
        await Promise.all([
            this.setupTypingIndicators(),
            this.setupMessageReactions(),
            this.setupReadReceipts(),
            this.setupActivityIndicators(),
            this.setupPresenceTracking(),
            this.setupLiveActivityFeatures()
        ]);
        
        this.hookIntoMessageSystem();
        this.createRealtimeStyles();
    }

    // TYPING INDICATORS SYSTEM
    setupTypingIndicators() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) return;

        // Enhanced typing detection with better throttling
        let compositionInProgress = false;
        
        messageInput.addEventListener('compositionstart', () => {
            compositionInProgress = true;
        });
        
        messageInput.addEventListener('compositionend', () => {
            compositionInProgress = false;
            this.handleTyping();
        });

        messageInput.addEventListener('input', (e) => {
            if (!compositionInProgress) {
                this.handleTyping();
            }
        });

        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                this.stopTyping(true);
            } else if (e.key === 'Escape') {
                this.stopTyping();
            }
        });

        messageInput.addEventListener('blur', () => {
            this.stopTyping();
        });

        messageInput.addEventListener('focus', () => {
            this.sendPresenceUpdate('active');
        });

        this.createTypingIndicatorContainer();
        this.setupTypingAnimations();
    }

    createTypingIndicatorContainer() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        const typingContainer = document.createElement('div');
        typingContainer.className = 'typing-indicators-container';
        typingContainer.setAttribute('role', 'status');
        typingContainer.setAttribute('aria-live', 'polite');
        typingContainer.setAttribute('aria-label', 'Typing indicators');

        messagesContainer.appendChild(typingContainer);
    }

    setupTypingAnimations() {
        // Create CSS animations for typing indicators
        const style = document.createElement('style');
        style.id = 'typing-animations';
        style.textContent = `
            .typing-indicator {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 16px;
                background: ${this.isHighContrast ? '#000' : 'rgba(0, 0, 0, 0.05)'};
                border-radius: 20px;
                margin-bottom: 8px;
                animation: ${this.prefersReducedMotion ? 'none' : 'typingSlideIn 0.3s ease'};
                font-size: 14px;
                color: var(--tg-text-secondary);
                max-width: 280px;
            }

            .typing-indicator.multiple-users {
                background: rgba(86, 130, 163, 0.1);
                border: 1px solid rgba(86, 130, 163, 0.2);
            }

            .typing-avatars {
                display: flex;
                margin-right: 8px;
            }

            .typing-avatar {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid white;
                margin-left: -8px;
                flex-shrink: 0;
            }

            .typing-avatar:first-child {
                margin-left: 0;
            }

            .typing-text {
                flex: 1;
                font-weight: 500;
            }

            .typing-animation {
                display: flex;
                gap: 3px;
                align-items: center;
                min-width: 30px;
            }

            .typing-dot {
                width: 6px;
                height: 6px;
                background: var(--tg-primary);
                border-radius: 50%;
                animation: ${this.prefersReducedMotion ? 'none' : 'typingPulse 1.4s infinite ease-in-out'};
            }

            .typing-dot:nth-child(2) { animation-delay: 0.2s; }
            .typing-dot:nth-child(3) { animation-delay: 0.4s; }

            @keyframes typingPulse {
                0%, 60%, 100% {
                    opacity: 0.3;
                    transform: scale(1);
                }
                30% {
                    opacity: 1;
                    transform: scale(1.2);
                }
            }

            @keyframes typingSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .typing-indicator.fade-out {
                animation: typingFadeOut 0.3s ease forwards;
            }

            @keyframes typingFadeOut {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(-10px);
                }
            }
        `;
        document.head.appendChild(style);
    }

    handleTyping() {
        const now = Date.now();
        const messageInput = document.getElementById('message-input');
        
        if (!messageInput || messageInput.value.trim().length === 0) {
            this.stopTyping();
            return;
        }
        
        // Debounced typing detection
        if (now - this.lastTypingTime < this.typingThrottle && this.isTyping) {
            this.resetTypingTimeout();
            return;
        }

        if (!this.isTyping) {
            this.isTyping = true;
            this.sendTypingStatus(true);
            this.lastTypingTime = now;
        }

        this.resetTypingTimeout();
    }

    resetTypingTimeout() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 3000);
    }

    stopTyping(messageSent = false) {
        if (this.isTyping) {
            this.isTyping = false;
            this.sendTypingStatus(false);
        }

        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    }

    sendTypingStatus(isTyping) {
        const typingData = {
            type: 'typing-status',
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            userAvatar: this.currentUser.avatar,
            isTyping: isTyping,
            timestamp: Date.now()
        };

        this.sendRealtimeData(typingData);
    }

    handleIncomingTypingStatus(data) {
        if (data.userId === this.currentUser.id) return;

        if (data.isTyping) {
            this.addTypingIndicator(data);
        } else {
            this.removeTypingIndicator(data.userId);
        }
    }

    addTypingIndicator(userData) {
        const container = document.querySelector('.typing-indicators-container');
        if (!container) return;

        // Remove existing indicator for this user
        this.removeTypingIndicator(userData.userId);

        const existingUsers = Array.from(this.typingIndicators.values());
        this.typingIndicators.set(userData.userId, userData);

        // Group multiple typing users
        if (existingUsers.length > 0) {
            this.updateGroupTypingIndicator();
        } else {
            this.createSingleTypingIndicator(userData);
        }

        // Auto-remove after timeout
        setTimeout(() => {
            this.removeTypingIndicator(userData.userId);
        }, 5000);

        this.scrollToBottom();
        this.announceToScreenReader(`${userData.userName} is typing`);
    }

    createSingleTypingIndicator(userData) {
        const container = document.querySelector('.typing-indicators-container');
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.dataset.userId = userData.userId;
        indicator.innerHTML = `
            <div class="typing-avatars">
                <img src="${userData.userAvatar}" alt="${userData.userName}" class="typing-avatar">
            </div>
            <span class="typing-text">${userData.userName} is typing</span>
            <div class="typing-animation">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        container.appendChild(indicator);
    }

    updateGroupTypingIndicator() {
        const container = document.querySelector('.typing-indicators-container');
        const users = Array.from(this.typingIndicators.values());
        
        // Clear existing indicators
        container.innerHTML = '';
        
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator multiple-users';
        
        const avatarsHtml = users.slice(0, 3).map(user => 
            `<img src="${user.userAvatar}" alt="${user.userName}" class="typing-avatar">`
        ).join('');
        
        let textContent;
        if (users.length === 1) {
            textContent = `${users[0].userName} is typing`;
        } else if (users.length === 2) {
            textContent = `${users[0].userName} and ${users[1].userName} are typing`;
        } else if (users.length === 3) {
            textContent = `${users[0].userName}, ${users[1].userName} and ${users[2].userName} are typing`;
        } else {
            textContent = `${users[0].userName}, ${users[1].userName} and ${users.length - 2} others are typing`;
        }
        
        indicator.innerHTML = `
            <div class="typing-avatars">${avatarsHtml}</div>
            <span class="typing-text">${textContent}</span>
            <div class="typing-animation">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        container.appendChild(indicator);
    }

    removeTypingIndicator(userId) {
        const indicator = document.querySelector(`[data-user-id="${userId}"]`);
        if (indicator) {
            indicator.classList.add('fade-out');
            setTimeout(() => {
                indicator.remove();
            }, 300);
        }

        this.typingIndicators.delete(userId);
        
        // Update group indicator if others are still typing
        if (this.typingIndicators.size > 0) {
            this.updateGroupTypingIndicator();
        }
    }

    // MESSAGE REACTIONS SYSTEM
    setupMessageReactions() {
        this.createReactionPanel();
        this.setupReactionEventListeners();
        this.createReactionStyles();
    }

    createReactionPanel() {
        const panel = document.createElement('div');
        panel.className = 'reaction-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Emoji reactions');
        
        // Create category tabs
        const categories = Object.keys(this.reactionEmojis);
        const tabsHtml = categories.map(cat => 
            `<button class="reaction-tab ${cat === 'popular' ? 'active' : ''}" data-category="${cat}" role="tab">
                ${this.getCategoryIcon(cat)}
            </button>`
        ).join('');
        
        panel.innerHTML = `
            <div class="reaction-header">
                <div class="reaction-tabs" role="tablist">
                    ${tabsHtml}
                </div>
                <button class="reaction-close" aria-label="Close reactions">×</button>
            </div>
            <div class="reaction-content">
                ${categories.map(cat => 
                    `<div class="reaction-category ${cat === 'popular' ? 'active' : ''}" data-category="${cat}" role="tabpanel">
                        ${this.reactionEmojis[cat].map(emoji => 
                            `<button class="reaction-emoji" data-emoji="${emoji}" aria-label="React with ${emoji}">${emoji}</button>`
                        ).join('')}
                    </div>`
                ).join('')}
            </div>
            <div class="reaction-search">
                <input type="text" placeholder="Search emojis..." class="reaction-search-input" aria-label="Search emojis">
            </div>
        `;

        document.body.appendChild(panel);
        this.setupReactionPanelEvents(panel);
    }

    getCategoryIcon(category) {
        const icons = {
            popular: '⭐',
            faces: '😊',
            hearts: '❤️',
            gestures: '👍'
        };
        return icons[category] || '😊';
    }

    setupReactionPanelEvents(panel) {
        // Tab switching
        panel.querySelectorAll('.reaction-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.switchReactionCategory(category);
            });
        });

        // Emoji selection
        panel.addEventListener('click', (e) => {
            const emojiElement = e.target.closest('.reaction-emoji');
            const closeBtn = e.target.closest('.reaction-close');
            
            if (emojiElement) {
                const emoji = emojiElement.dataset.emoji;
                this.addReaction(this.currentReactionMessage, emoji);
                this.hideReactionPanel();
                this.triggerHaptic('light');
            } else if (closeBtn) {
                this.hideReactionPanel();
            }
        });

        // Search functionality
        const searchInput = panel.querySelector('.reaction-search-input');
        searchInput.addEventListener('input', (e) => {
            this.filterEmojis(e.target.value);
        });

        // Keyboard navigation
        panel.addEventListener('keydown', (e) => {
            this.handleReactionPanelKeyboard(e);
        });
    }

    switchReactionCategory(category) {
        const panel = document.querySelector('.reaction-panel');
        
        // Update tabs
        panel.querySelectorAll('.reaction-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        
        // Update content
        panel.querySelectorAll('.reaction-category').forEach(cat => {
            cat.classList.toggle('active', cat.dataset.category === category);
        });
    }

    setupReactionEventListeners() {
        // Double-tap for quick heart reaction
        let lastTap = 0;
        document.addEventListener('touchend', (e) => {
            const currentTime = Date.now();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 500 && tapLength > 0) {
                const message = e.target.closest('.message');
                if (message) {
                    this.showQuickReaction(message, e);
                    e.preventDefault();
                }
            }
            lastTap = currentTime;
        });

        // Long press for reaction panel
        let longPressTimer = null;
        let touchMoved = false;

        document.addEventListener('touchstart', (e) => {
            const message = e.target.closest('.message');
            if (message) {
                this.touchStartTime = Date.now();
                touchMoved = false;
                
                longPressTimer = setTimeout(() => {
                    if (!touchMoved) {
                        this.showReactionPanel(message, e);
                        this.triggerHaptic('medium');
                    }
                }, this.longPressThreshold);
            }
        }, { passive: true });

        document.addEventListener('touchmove', () => {
            touchMoved = true;
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }, { passive: true });

        // Desktop right-click
        document.addEventListener('contextmenu', (e) => {
            const message = e.target.closest('.message');
            if (message) {
                e.preventDefault();
                this.showReactionPanel(message, e);
            }
        });

        // Hide panel when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.querySelector('.reaction-panel');
            if (panel && !panel.contains(e.target) && panel.classList.contains('visible')) {
                this.hideReactionPanel();
            }
        });
    }

    showQuickReaction(messageElement, event) {
        const heartEmoji = '❤️';
        this.addReaction(messageElement, heartEmoji);
        
        // Show floating animation
        const rect = messageElement.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        this.showReactionAnimation(x, y, heartEmoji);
    }

    showReactionPanel(messageElement, event) {
        const panel = document.querySelector('.reaction-panel');
        if (!panel) return;

        panel.classList.add('visible');
        this.currentReactionMessage = messageElement;

        // Position panel intelligently
        this.positionReactionPanel(panel, event || messageElement);
        
        // Focus management for accessibility
        const firstEmoji = panel.querySelector('.reaction-emoji');
        if (firstEmoji) {
            firstEmoji.focus();
        }

        this.announceToScreenReader('Reaction panel opened');
    }

    positionReactionPanel(panel, reference) {
        const rect = reference.getBoundingClientRect ? 
            reference.getBoundingClientRect() : 
            { left: reference.clientX, top: reference.clientY, width: 0, height: 0 };
        
        const panelRect = panel.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let x = rect.left + (rect.width / 2) - (panelRect.width / 2);
        let y = rect.top - panelRect.height - 15;

        // Adjust for viewport boundaries
        if (x < 10) x = 10;
        if (x + panelRect.width > viewportWidth - 10) {
            x = viewportWidth - panelRect.width - 10;
        }
        if (y < 10) y = rect.bottom + 15;
        if (y + panelRect.height > viewportHeight - 10) {
            y = viewportHeight - panelRect.height - 10;
        }

        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
    }

    hideReactionPanel() {
        const panel = document.querySelector('.reaction-panel');
        if (panel) {
            panel.classList.remove('visible');
        }
        this.currentReactionMessage = null;
        this.announceToScreenReader('Reaction panel closed');
    }

    addReaction(messageElement, emoji) {
        if (!messageElement) return;

        const messageId = this.getMessageId(messageElement);
        const userId = this.currentUser.id;

        // Update local reactions map
        if (!this.userReactions.has(messageId)) {
            this.userReactions.set(messageId, new Map());
        }

        const messageReactions = this.userReactions.get(messageId);
        
        // Toggle reaction logic
        if (messageReactions.has(emoji)) {
            const users = messageReactions.get(emoji);
            if (users.has(userId)) {
                users.delete(userId);
                if (users.size === 0) {
                    messageReactions.delete(emoji);
                }
            } else {
                users.add(userId);
            }
        } else {
            messageReactions.set(emoji, new Set([userId]));
        }

        // Update UI with animation
        this.updateMessageReactions(messageElement, messageId);
        
        // Send reaction data
        const reactionData = {
            type: 'message-reaction',
            messageId: messageId,
            emoji: emoji,
            userId: userId,
            userName: this.currentUser.name,
            userAvatar: this.currentUser.avatar,
            timestamp: Date.now(),
            action: messageReactions.has(emoji) && messageReactions.get(emoji).has(userId) ? 'add' : 'remove'
        };

        this.sendRealtimeData(reactionData);
        
        // Show reaction animation
        const rect = messageElement.getBoundingClientRect();
        this.showReactionAnimation(rect.left + rect.width / 2, rect.top + rect.height / 2, emoji);
        
        this.announceToScreenReader(`${reactionData.action === 'add' ? 'Added' : 'Removed'} ${emoji} reaction`);
    }

    handleIncomingReaction(data) {
        const messageElement = this.findMessageElement(data.messageId);
        if (!messageElement) return;

        // Update reactions map
        if (!this.userReactions.has(data.messageId)) {
            this.userReactions.set(data.messageId, new Map());
        }

        const messageReactions = this.userReactions.get(data.messageId);
        
        if (!messageReactions.has(data.emoji)) {
            messageReactions.set(data.emoji, new Set());
        }

        const users = messageReactions.get(data.emoji);
        if (data.action === 'add') {
            users.add(data.userId);
        } else if (data.action === 'remove') {
            users.delete(data.userId);
            if (users.size === 0) {
                messageReactions.delete(data.emoji);
            }
        }

        // Update UI
        this.updateMessageReactions(messageElement, data.messageId);
        
        // Show animation for incoming reactions
        if (data.action === 'add') {
            const rect = messageElement.getBoundingClientRect();
            this.showReactionAnimation(rect.left + rect.width / 2, rect.top + rect.height / 2, data.emoji, true);
        }
    }

    updateMessageReactions(messageElement, messageId) {
        const reactions = this.userReactions.get(messageId);
        
        // Remove existing reactions container
        let container = messageElement.querySelector('.message-reactions');
        if (container) {
            container.remove();
        }

        if (!reactions || reactions.size === 0) return;

        // Create new reactions container
        container = document.createElement('div');
        container.className = 'message-reactions';
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', 'Message reactions');

        reactions.forEach((users, emoji) => {
            if (users.size === 0) return;

            const reactionElement = document.createElement('button');
            reactionElement.className = 'message-reaction';
            reactionElement.setAttribute('aria-label', `${emoji} reaction by ${users.size} user${users.size > 1 ? 's' : ''}`);
            
            if (users.has(this.currentUser.id)) {
                reactionElement.classList.add('own-reaction');
            }

            // Create reaction tooltip
            const userNames = Array.from(users).map(userId => {
                if (userId === this.currentUser.id) return 'You';
                const userData = this.userPresence.get(userId);
                return userData ? userData.userName : 'Unknown';
            });

            const tooltipText = users.size === 1 ? 
                userNames[0] : 
                userNames.slice(0, -1).join(', ') + ' and ' + userNames[userNames.length - 1];

            reactionElement.innerHTML = `
                <span class="message-reaction-emoji">${emoji}</span>
                <span class="message-reaction-count">${users.size}</span>
                <div class="reaction-tooltip">${tooltipText}</div>
            `;

            reactionElement.addEventListener('click', () => {
                this.addReaction(messageElement, emoji);
            });

            container.appendChild(reactionElement);
        });

        messageElement.appendChild(container);
    }

    showReactionAnimation(x, y, emoji, isIncoming = false) {
        if (this.prefersReducedMotion) return;

        const animation = document.createElement('div');
        animation.className = `reaction-float ${isIncoming ? 'incoming' : 'outgoing'}`;
        animation.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            font-size: 24px;
            z-index: 4000;
            pointer-events: none;
            animation: reactionFloat 1.2s ease-out forwards;
            transform-origin: center;
        `;
        animation.textContent = emoji;

        document.body.appendChild(animation);
        this.reactionAnimations.add(animation);

        setTimeout(() => {
            animation.remove();
            this.reactionAnimations.delete(animation);
        }, 1200);
    }

    // READ RECEIPTS & MESSAGE STATUS SYSTEM
    setupReadReceipts() {
        this.setupIntersectionObserver();
        this.setupMessageStatusTracking();
        this.createReadReceiptStyles();
    }

    setupIntersectionObserver() {
        if (!window.IntersectionObserver) return;

        this.messageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
                    const messageElement = entry.target;
                    const messageId = this.getMessageId(messageElement);
                    
                    // Only mark received messages as read
                    if (messageId && messageElement.classList.contains('received')) {
                        this.markMessageAsRead(messageId);
                    }
                }
            });
        }, { 
            threshold: [0.5, 0.7, 1.0],
            rootMargin: '0px 0px -10% 0px'
        });
    }

    setupMessageStatusTracking() {
        // Hook into existing message display function
        const originalDisplayMessage = window.displayMessage;
        window.displayMessage = (message, type, messageId) => {
            const messageElement = originalDisplayMessage ? 
                originalDisplayMessage(message, type, messageId) : 
                this.createMessageElement(message, type, messageId);
            
            if (messageElement) {
                // Add message status indicators
                if (type === 'sent' && messageId) {
                    this.addMessageStatusIndicator(messageElement, messageId);
                    this.trackMessageDelivery(messageId);
                }
                
                // Observe for read receipts
                if (this.messageObserver) {
                    this.messageObserver.observe(messageElement);
                }
                
                // Add message ID if not present
                if (!messageElement.dataset.messageId) {
                    messageElement.dataset.messageId = messageId || this.generateMessageId();
                }
            }
            
            return messageElement;
        };
    }

    addMessageStatusIndicator(messageElement, messageId) {
        const timeContainer = messageElement.querySelector('.message-time');
        if (!timeContainer) return;

        const statusElement = document.createElement('div');
        statusElement.className = 'message-status';
        statusElement.setAttribute('aria-label', 'Message status');
        statusElement.innerHTML = '<i class="fas fa-clock" title="Sending..."></i>';
        
        timeContainer.appendChild(statusElement);
        
        // Set initial status
        this.updateMessageStatus(messageId, 'sending');
        
        // Simulate message sending process
        setTimeout(() => {
            this.updateMessageStatus(messageId, 'sent');
        }, 500);
    }

    updateMessageStatus(messageId, status) {
        const messageElement = this.findMessageElement(messageId);
        if (!messageElement) return;

        const statusElement = messageElement.querySelector('.message-status');
        if (!statusElement) return;

        this.messageStatuses.set(messageId, { status, timestamp: Date.now() });

        const statusIcons = {
            sending: '<i class="fas fa-clock" title="Sending..."></i>',
            sent: '<i class="fas fa-check" title="Sent"></i>',
            delivered: '<i class="fas fa-check-double" title="Delivered"></i>',
            read: '<i class="fas fa-check-double message-read" title="Read"></i>',
            failed: '<i class="fas fa-exclamation-triangle" title="Failed to send"></i>'
        };

        statusElement.innerHTML = statusIcons[status] || statusIcons.sent;
        statusElement.className = `message-status status-${status}`;

        // Announce status change to screen readers
        const statusTexts = {
            sending: 'Message sending',
            sent: 'Message sent',
            delivered: 'Message delivered',
            read: 'Message read',
            failed: 'Message failed to send'
        };

        this.announceToScreenReader(statusTexts[status]);
    }

    trackMessageDelivery(messageId) {
        // Send delivery confirmation request
        const deliveryData = {
            type: 'delivery-request',
            messageId: messageId,
            timestamp: Date.now()
        };

        this.sendRealtimeData(deliveryData);

        // Set timeout for delivery confirmation
        setTimeout(() => {
            if (!this.deliveryConfirmations.has(messageId)) {
                this.updateMessageStatus(messageId, 'failed');
            }
        }, 30000); // 30 seconds timeout
    }

    markMessageAsRead(messageId) {
        if (this.readReceipts.has(messageId)) return;

        this.readReceipts.set(messageId, {
            userId: this.currentUser.id,
            timestamp: Date.now()
        });

        const readReceiptData = {
            type: 'read-receipt',
            messageId: messageId,
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            timestamp: Date.now()
        };

        this.sendRealtimeData(readReceiptData);
    }

    handleIncomingReadReceipt(data) {
        const messageElement = this.findMessageElement(data.messageId);
        if (!messageElement) return;

        // Update message status to read
        this.updateMessageStatus(data.messageId, 'read');
        
        // Store read receipt data
        this.readReceipts.set(data.messageId, data);
    }

    handleDeliveryConfirmation(data) {
        this.deliveryConfirmations.set(data.messageId, data);
        this.updateMessageStatus(data.messageId, 'delivered');
    }

    // PRESENCE & ACTIVITY INDICATORS SYSTEM
    setupPresenceTracking() {
        this.createPresenceIndicators();
        this.setupActivityTracking();
        this.startPresenceHeartbeat();
    }

    createPresenceIndicators() {
        // Add presence indicators to existing avatars
        document.querySelectorAll('.chat-avatar, .contact-avatar, .user-avatar').forEach(avatar => {
            this.addPresenceIndicatorToAvatar(avatar);
        });
    }

    addPresenceIndicatorToAvatar(avatar) {
        if (avatar.parentElement.querySelector('.presence-indicator')) return;

        const indicator = document.createElement('div');
        indicator.className = 'presence-indicator';
        indicator.setAttribute('aria-label', 'User presence status');
        
        // Make parent relative if needed
        const parent = avatar.parentElement;
        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }
        
        parent.appendChild(indicator);
        
        // Set initial status
        this.updatePresenceIndicator(indicator, 'online');
    }

    updatePresenceIndicator(indicator, status) {
        const statusClasses = {
            online: 'presence-online',
            away: 'presence-away',
            busy: 'presence-busy',
            offline: 'presence-offline'
        };

        indicator.className = `presence-indicator ${statusClasses[status] || statusClasses.offline}`;
        indicator.setAttribute('title', status.charAt(0).toUpperCase() + status.slice(1));
    }

    setupActivityTracking() {
        // Track various user activities
        this.trackScrollActivity();
        this.trackFocusActivity();
        this.trackMouseActivity();
        this.trackTypingActivity();
    }

    trackScrollActivity() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        let scrollTimeout = null;
        messagesContainer.addEventListener('scroll', () => {
            if (!scrollTimeout) {
                this.sendActivityStatus('scrolling');
            }

            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.sendActivityStatus('idle');
                scrollTimeout = null;
            }, 2000);
        }, { passive: true });
    }

    trackFocusActivity() {
        let focusTimeout = null;

        window.addEventListener('focus', () => {
            this.sendPresenceUpdate('online');
            this.sendActivityStatus('active');
        });

        window.addEventListener('blur', () => {
            // Delay setting away status to avoid flickering
            focusTimeout = setTimeout(() => {
                this.sendPresenceUpdate('away');
                this.sendActivityStatus('away');
            }, 5000);
        });

        window.addEventListener('focus', () => {
            if (focusTimeout) {
                clearTimeout(focusTimeout);
                focusTimeout = null;
            }
        });

        // Page visibility API
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.sendPresenceUpdate('away');
                this.sendActivityStatus('away');
            } else {
                this.sendPresenceUpdate('online');
                this.sendActivityStatus('active');
            }
        });
    }

    trackMouseActivity() {
        let mouseTimeout = null;
        let isMouseActive = false;

        const resetMouseTimer = () => {
            if (!isMouseActive) {
                isMouseActive = true;
                this.sendActivityStatus('active');
            }

            clearTimeout(mouseTimeout);
            mouseTimeout = setTimeout(() => {
                isMouseActive = false;
                this.sendActivityStatus('idle');
            }, 30000); // 30 seconds of inactivity
        };

        document.addEventListener('mousemove', resetMouseTimer, { passive: true });
        document.addEventListener('click', resetMouseTimer, { passive: true });
    }

    startPresenceHeartbeat() {
        // Send presence updates every 30 seconds
        setInterval(() => {
            this.sendPresenceUpdate();
        }, 30000);

        // Send initial presence
        this.sendPresenceUpdate();
    }

    sendPresenceUpdate(status = null) {
        const presenceData = {
            type: 'presence-update',
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            userAvatar: this.currentUser.avatar,
            status: status || this.getUserStatus(),
            customStatus: this.currentUser.customStatus,
            timestamp: Date.now(),
            lastSeen: this.currentUser.lastSeen
        };

        this.sendRealtimeData(presenceData);
    }

    getUserStatus() {
        if (document.hidden) return 'away';
        if (this.isTyping) return 'online';
        
        // Check last activity
        const lastActivity = Date.now() - this.lastTypingTime;
        if (lastActivity < 300000) return 'online'; // 5 minutes
        if (lastActivity < 1800000) return 'away'; // 30 minutes
        
        return 'offline';
    }

    sendActivityStatus(activity) {
        const activityData = {
            type: 'activity-status',
            userId: this.currentUser.id,
            activity: activity,
            timestamp: Date.now()
        };

        this.sendRealtimeData(activityData);
    }

    handleIncomingPresence(data) {
        if (data.userId === this.currentUser.id) return;

        this.userPresence.set(data.userId, data);
        this.updateAllPresenceIndicators();
        
        // Show presence change notification
        this.showPresenceNotification(data);
    }

    handleIncomingActivity(data) {
        if (data.userId === this.currentUser.id) return;

        this.activityIndicators.set(data.userId, data);
        this.showActivityNotification(data);
    }

    updateAllPresenceIndicators() {
        document.querySelectorAll('.presence-indicator').forEach(indicator => {
            const avatar = indicator.parentElement.querySelector('img');
            if (avatar && avatar.dataset.userId) {
                const userId = avatar.dataset.userId;
                const presence = this.userPresence.get(userId);
                if (presence) {
                    this.updatePresenceIndicator(indicator, presence.status);
                }
            }
        });
    }

    showPresenceNotification(data) {
        // Only show significant presence changes
        if (data.status === 'online') {
            this.showNotification(`${data.userName} is now online`, 'presence');
        }
    }

    showActivityNotification(data) {
        const activityMessages = {
            'scrolling': `${data.userName || 'User'} is browsing messages`,
            'active': `${data.userName || 'User'} is active`,
            'away': `${data.userName || 'User'} is away`
        };

        const message = activityMessages[data.activity];
        if (message && data.activity !== 'away') {
            this.showNotification(message, 'activity', 2000);
        }
    }

    // LIVE ACTIVITY FEATURES
    setupLiveActivityFeatures() {
        this.setupConnectionQualityMonitoring();
        this.setupBandwidthMonitoring();
        this.setupMessageEditing();
        this.createNotificationSystem();
    }

    setupConnectionQualityMonitoring() {
        // Monitor WebRTC connection quality
        setInterval(() => {
            this.checkConnectionQuality();
        }, 5000);
    }

    checkConnectionQuality() {
        if (!window.peerConnection) return;

        window.peerConnection.getStats().then(stats => {
            stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    const quality = this.calculateConnectionQuality(report);
                    this.updateConnectionQuality(quality);
                }
            });
        }).catch(error => {
            console.warn('Failed to get connection stats:', error);
        });
    }

    calculateConnectionQuality(report) {
        const rtt = report.currentRoundTripTime || 0;
        const packetsLost = report.packetsLost || 0;
        const packetsSent = report.packetsSent || 1;
        
        const lossRate = packetsLost / packetsSent;
        
        if (rtt < 0.1 && lossRate < 0.01) return 'excellent';
        if (rtt < 0.3 && lossRate < 0.05) return 'good';
        if (rtt < 0.5 && lossRate < 0.1) return 'fair';
        return 'poor';
    }

    updateConnectionQuality(quality) {
        const indicator = document.getElementById('connection-quality-indicator');
        if (!indicator) {
            this.createConnectionQualityIndicator();
            return;
        }

        const qualityInfo = {
            excellent: { icon: '📶', color: '#4CAF50', text: 'Excellent' },
            good: { icon: '📶', color: '#8BC34A', text: 'Good' },
            fair: { icon: '📶', color: '#FF9800', text: 'Fair' },
            poor: { icon: '📶', color: '#F44336', text: 'Poor' }
        };

        const info = qualityInfo[quality];
        indicator.innerHTML = `${info.icon} ${info.text}`;
        indicator.style.color = info.color;
        indicator.title = `Connection quality: ${info.text}`;
    }

    createConnectionQualityIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'connection-quality-indicator';
        indicator.className = 'connection-quality-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 4px;
        `;
        
        document.body.appendChild(indicator);
    }

    setupBandwidthMonitoring() {
        // Monitor data usage
        setInterval(() => {
            this.updateBandwidthUsage();
        }, 10000);
    }

    updateBandwidthUsage() {
        // This would integrate with actual bandwidth monitoring
        // For now, simulate bandwidth tracking
        const usage = document.getElementById('bandwidth-usage');
        if (usage) {
            const sent = (this.bandwidthUsage.sent / 1024).toFixed(1);
            const received = (this.bandwidthUsage.received / 1024).toFixed(1);
            usage.textContent = `↑ ${sent}KB ↓ ${received}KB`;
        }
    }

    // UTILITY METHODS & INTEGRATION
    createRealtimeStyles() {
        const style = document.createElement('style');
        style.id = 'realtime-styles';
        style.textContent = `
            /* Reaction Panel Styles */
            .reaction-panel {
                position: fixed;
                background: white;
                border-radius: 16px;
                padding: 0;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                z-index: 3000;
                display: none;
                max-width: 320px;
                max-height: 400px;
                border: 1px solid #e0e0e0;
                overflow: hidden;
            }

            .reaction-panel.visible {
                display: block;
                animation: ${this.prefersReducedMotion ? 'none' : 'reactionPanelIn 0.2s ease'};
            }

            .reaction-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8f9fa;
            }

            .reaction-tabs {
                display: flex;
                gap: 8px;
            }

            .reaction-tab {
                background: none;
                border: none;
                padding: 8px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 18px;
                transition: background 0.2s;
            }

            .reaction-tab:hover,
            .reaction-tab.active {
                background: #e3f2fd;
            }

            .reaction-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                color: #666;
            }

            .reaction-close:hover {
                background: #f0f0f0;
            }

            .reaction-content {
                padding: 12px;
                max-height: 280px;
                overflow-y: auto;
            }

            .reaction-category {
                display: none;
                grid-template-columns: repeat(8, 1fr);
                gap: 8px;
            }

            .reaction-category.active {
                display: grid;
            }

            .reaction-emoji {
                background: none;
                border: none;
                font-size: 24px;
                padding: 8px;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.2s;
                aspect-ratio: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .reaction-emoji:hover {
                background: #f0f0f0;
                transform: scale(1.2);
            }

            .reaction-search {
                padding: 12px;
                border-top: 1px solid #e0e0e0;
            }

            .reaction-search-input {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 20px;
                outline: none;
                font-size: 14px;
            }

            .reaction-search-input:focus {
                border-color: var(--tg-primary);
            }

            /* Message Reactions */
            .message-reactions {
                display: flex;
                gap: 4px;
                margin-top: 8px;
                flex-wrap: wrap;
            }

            .message-reaction {
                background: rgba(0, 0, 0, 0.05);
                border: 1px solid rgba(0, 0, 0, 0.1);
                border-radius: 16px;
                padding: 4px 8px;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                transition: all 0.2s;
                user-select: none;
                position: relative;
            }

            .message-reaction:hover {
                background: rgba(0, 0, 0, 0.1);
                transform: scale(1.05);
            }

            .message-reaction.own-reaction {
                background: rgba(86, 130, 163, 0.2);
                border-color: var(--tg-primary);
                color: var(--tg-primary);
            }

            .reaction-tooltip {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s;
                margin-bottom: 4px;
            }

            .message-reaction:hover .reaction-tooltip {
                opacity: 1;
            }

            /* Floating Reactions */
            @keyframes reactionFloat {
                0% {
                    opacity: 0;
                    transform: scale(0.5) translateY(0);
                }
                15% {
                    opacity: 1;
                    transform: scale(1.2) translateY(-10px);
                }
                100% {
                    opacity: 0;
                    transform: scale(0.8) translateY(-50px);
                }
            }

            .reaction-float.incoming {
                animation: reactionFloatIncoming 1.2s ease-out forwards;
            }

            @keyframes reactionFloatIncoming {
                0% {
                    opacity: 0;
                    transform: scale(0.3) translateY(20px);
                }
                15% {
                    opacity: 1;
                    transform: scale(1.3) translateY(0);
                }
                100% {
                    opacity: 0;
                    transform: scale(0.8) translateY(-30px);
                }
            }

            /* Message Status */
            .message-status {
                display: inline-flex;
                align-items: center;
                margin-left: 4px;
                font-size: 10px;
                color: var(--tg-text-secondary);
            }

            .message-status.status-sending {
                color: #999;
            }

            .message-status.status-sent {
                color: var(--tg-text-secondary);
            }

            .message-status.status-delivered {
                color: var(--tg-primary);
            }

            .message-status.status-read .message-read,
            .message-status.status-read {
                color: var(--tg-online);
            }

            .message-status.status-failed {
                color: var(--tg-danger, #F44336);
            }

            /* Presence Indicators */
            .presence-indicator {
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 2px solid white;
                z-index: 10;
            }

            .presence-indicator.presence-online {
                background: var(--tg-online);
                box-shadow: 0 0 0 1px var(--tg-online);
            }

            .presence-indicator.presence-away {
                background: var(--tg-away);
            }

            .presence-indicator.presence-busy {
                background: #ff4444;
            }

            .presence-indicator.presence-offline {
                background: #999;
            }

            /* Notifications */
            .realtime-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--tg-primary);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 2000;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                animation: ${this.prefersReducedMotion ? 'none' : 'slideInRight 0.3s ease'};
            }

            .realtime-notification.presence {
                background: var(--tg-online);
            }

            .realtime-notification.activity {
                background: var(--tg-info, #2196F3);
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes reactionPanelIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            /* Mobile Optimizations */
            @media (max-width: 768px) {
                .reaction-panel {
                    max-width: 90vw;
                    max-height: 60vh;
                }

                .reaction-category {
                    grid-template-columns: repeat(6, 1fr);
                }

                .reaction-emoji {
                    font-size: 20px;
                    padding: 12px 8px;
                }

                .typing-indicator {
                    max-width: 240px;
                    font-size: 13px;
                }

                .message-reactions {
                    margin-top: 6px;
                }

                .message-reaction {
                    font-size: 11px;
                    padding: 3px 6px;
                }
            }

            /* High Contrast Mode */
            @media (prefers-contrast: high) {
                .reaction-panel {
                    border: 2px solid #000;
                }

                .message-reaction {
                    border: 1px solid #000;
                }

                .typing-indicator {
                    border: 1px solid #000;
                    background: #fff;
                    color: #000;
                }
            }

            /* Reduced Motion */
            @media (prefers-reduced-motion: reduce) {
                .reaction-panel.visible,
                .typing-indicator,
                .message-reaction,
                .reaction-float,
                .realtime-notification {
                    animation: none;
                }

                .reaction-emoji:hover,
                .message-reaction:hover {
                    transform: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    createNotificationSystem() {
        // Create notification container
        const container = document.createElement('div');
        container.id = 'realtime-notifications';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2000;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    showNotification(message, type = 'default', duration = 3000) {
        const container = document.getElementById('realtime-notifications');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `realtime-notification ${type}`;
        notification.textContent = message;
        notification.style.pointerEvents = 'auto';

        container.appendChild(notification);

        // Auto-remove notification
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);

        // Add click to dismiss
        notification.addEventListener('click', () => {
            notification.remove();
        });
    }

    setupPerformanceMonitoring() {
        // Monitor performance metrics
        this.performanceMetrics = {
            messagesSent: 0,
            messagesReceived: 0,
            reactionsAdded: 0,
            typingEvents: 0,
            memoryUsage: 0
        };

        // Clean up animations periodically
        setInterval(() => {
            this.cleanupAnimations();
        }, 30000);
    }

    cleanupAnimations() {
        // Remove completed animations
        this.reactionAnimations.forEach(animation => {
            if (!document.body.contains(animation)) {
                this.reactionAnimations.delete(animation);
            }
        });

        // Clear old debounce timers
        this.debounceTimers.forEach((timer, key) => {
            if (Date.now() - timer.created > 60000) {
                clearTimeout(timer.id);
                this.debounceTimers.delete(key);
            }
        });
    }

    setupAccessibilityFeatures() {
        // Enhanced screen reader support
        this.createScreenReaderRegion();
        
        // Keyboard navigation improvements
        this.setupKeyboardNavigation();
        
        // High contrast mode support
        if (this.isHighContrast) {
            document.body.classList.add('high-contrast');
        }
    }

    createScreenReaderRegion() {
        const region = document.createElement('div');
        region.id = 'realtime-announcements';
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'true');
        region.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(region);
    }

    announceToScreenReader(message) {
        const region = document.getElementById('realtime-announcements');
        if (!region) return;

        // Clear previous announcement
        region.textContent = '';
        
        // Add new announcement after a brief delay
        setTimeout(() => {
            region.textContent = message;
        }, 100);

        // Clear after announcement
        setTimeout(() => {
            region.textContent = '';
        }, 3000);
    }

    setupKeyboardNavigation() {
        // Enhanced keyboard navigation for reaction panel
        document.addEventListener('keydown', (e) => {
            const panel = document.querySelector('.reaction-panel.visible');
            if (!panel) return;

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    this.hideReactionPanel();
                    break;
                case 'Tab':
                    this.handleReactionPanelTab(e);
                    break;
                case 'Enter':
                case ' ':
                    const focused = document.activeElement;
                    if (focused.classList.contains('reaction-emoji')) {
                        e.preventDefault();
                        focused.click();
                    }
                    break;
            }
        });
    }

    handleReactionPanelTab(event) {
        const panel = document.querySelector('.reaction-panel.visible');
        if (!panel) return;

        const focusableElements = panel.querySelectorAll(
            'button, input, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    }

    setupSecurityFeatures() {
        // Message integrity checking
        this.setupMessageIntegrityChecks();
        
        // Rate limiting for real-time events
        this.setupRateLimiting();
    }

    setupMessageIntegrityChecks() {
        // Add checksums to real-time data
        this.originalSendRealtimeData = this.sendRealtimeData;
        this.sendRealtimeData = (data) => {
            if (this.messageEncryption) {
                data.checksum = this.calculateChecksum(JSON.stringify(data));
                data.timestamp = Date.now();
            }
            this.originalSendRealtimeData(data);
        };
    }

    calculateChecksum(data) {
        // Simple checksum calculation (in production, use proper cryptographic hash)
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    setupRateLimiting() {
        this.rateLimits = {
            'typing-status': { max: 10, window: 60000, count: 0, reset: Date.now() },
            'message-reaction': { max: 50, window: 60000, count: 0, reset: Date.now() },
            'activity-status': { max: 20, window: 60000, count: 0, reset: Date.now() }
        };
    }

    checkRateLimit(type) {
        const limit = this.rateLimits[type];
        if (!limit) return true;

        const now = Date.now();
        if (now > limit.reset + limit.window) {
            limit.count = 0;
            limit.reset = now;
        }

        if (limit.count >= limit.max) {
            console.warn(`Rate limit exceeded for ${type}`);
            return false;
        }

        limit.count++;
        return true;
    }

    // CORE INTEGRATION METHODS
    hookIntoMessageSystem() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        // Observe for new messages
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('message')) {
                        // Add message ID if not present
                        if (!node.dataset.messageId) {
                            node.dataset.messageId = this.generateMessageId();
                        }
                        
                        // Start observing for read receipts
                        if (this.messageObserver) {
                            this.messageObserver.observe(node);
                        }
                    }
                });
            });
        });

        observer.observe(messagesContainer, { childList: true });
    }

    sendRealtimeData(data) {
        // Check rate limiting
        if (!this.checkRateLimit(data.type)) {
            return;
        }

        // Add security features
        if (this.messageEncryption) {
            data.checksum = this.calculateChecksum(JSON.stringify(data));
        }

        // Update bandwidth tracking
        this.bandwidthUsage.sent += JSON.stringify(data).length;

        // Send via WebRTC data channel if available
        if (window.dataChannel && window.dataChannel.readyState === 'open') {
            try {
                window.dataChannel.send(JSON.stringify(data));
                this.performanceMetrics.messagesSent++;
            } catch (error) {
                console.error('Failed to send real-time data:', error);
            }
        }
    }

    handleIncomingRealtimeData(data) {
        // Verify integrity if encryption is enabled
        if (this.messageEncryption && data.checksum) {
            const originalChecksum = data.checksum;
            delete data.checksum;
            const calculatedChecksum = this.calculateChecksum(JSON.stringify(data));
            
            if (originalChecksum !== calculatedChecksum) {
                console.warn('Data integrity check failed');
                return;
            }
        }

        // Update bandwidth tracking
        this.bandwidthUsage.received += JSON.stringify(data).length;
        this.performanceMetrics.messagesReceived++;

        // Route to appropriate handler
        switch (data.type) {
            case 'typing-status':
                this.handleIncomingTypingStatus(data);
                break;
            case 'message-reaction':
                this.handleIncomingReaction(data);
                this.performanceMetrics.reactionsAdded++;
                break;
            case 'read-receipt':
                this.handleIncomingReadReceipt(data);
                break;
            case 'delivery-request':
                this.handleDeliveryRequest(data);
                break;
            case 'delivery-confirmation':
                this.handleDeliveryConfirmation(data);
                break;
            case 'activity-status':
                this.handleIncomingActivity(data);
                break;
            case 'presence-update':
                this.handleIncomingPresence(data);
                break;
            default:
                console.log('Unknown real-time data type:', data.type);
        }
    }

    handleDeliveryRequest(data) {
        // Send delivery confirmation
        const confirmationData = {
            type: 'delivery-confirmation',
            messageId: data.messageId,
            timestamp: Date.now()
        };
        
        this.sendRealtimeData(confirmationData);
    }

    // UTILITY METHODS
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getMessageId(messageElement) {
        return messageElement.dataset.messageId || 
               messageElement.getAttribute('data-message-id') ||
               this.generateMessageId();
    }

    findMessageElement(messageId) {
        return document.querySelector(`[data-message-id="${messageId}"]`);
    }

    scrollToBottom() {
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: this.prefersReducedMotion ? 'auto' : 'smooth'
            });
        }
    }

    triggerHaptic(intensity = 'light') {
        if (!navigator.vibrate) return;

        const patterns = {
            light: [20],
            medium: [50],
            heavy: [100, 50, 100]
        };

        navigator.vibrate(patterns[intensity] || patterns.light);
    }

    debounce(func, wait, key) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key).id);
        }

        const timerId = setTimeout(() => {
            func();
            this.debounceTimers.delete(key);
        }, wait);

        this.debounceTimers.set(key, { id: timerId, created: Date.now() });
    }

    // PUBLIC API
    getCurrentUser() {
        return { ...this.currentUser };
    }

    updateCurrentUser(userData) {
        this.currentUser = { ...this.currentUser, ...userData };
        this.sendPresenceUpdate();
    }

    getTypingUsers() {
        return Array.from(this.typingIndicators.values());
    }

    getMessageReactions(messageId) {
        return this.userReactions.get(messageId) || new Map();
    }

    getUserPresence(userId) {
        return this.userPresence.get(userId);
    }

    isUserTyping(userId) {
        return this.typingIndicators.has(userId);
    }

    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    getBandwidthUsage() {
        return { ...this.bandwidthUsage };
    }

    // Additional methods for missing functionality
    setupMessageEditing() {
        // Setup live message editing indicators
        this.setupLiveMessageEditing();
    }
    
    setupLiveMessageEditing() {
        // Track message editing in real-time
        let editTimeout = null;
        
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('message-edit-input')) {
                clearTimeout(editTimeout);
                
                // Show editing indicator
                this.showEditingIndicator(e.target);
                
                editTimeout = setTimeout(() => {
                    this.hideEditingIndicator(e.target);
                }, 2000);
            }
        });
    }
    
    showEditingIndicator(input) {
        const messageElement = input.closest('.message');
        if (!messageElement) return;
        
        let indicator = messageElement.querySelector('.editing-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'editing-indicator';
            indicator.innerHTML = '<i class="fas fa-edit"></i> Editing...';
            messageElement.appendChild(indicator);
        }
        
        indicator.style.display = 'block';
    }
    
    hideEditingIndicator(input) {
        const messageElement = input.closest('.message');
        if (!messageElement) return;
        
        const indicator = messageElement.querySelector('.editing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    filterEmojis(searchTerm) {
        const panel = document.querySelector('.reaction-panel');
        if (!panel) return;

        const searchLower = searchTerm.toLowerCase();
        const allEmojis = panel.querySelectorAll('.reaction-emoji');
        
        allEmojis.forEach(emoji => {
            const emojiText = emoji.dataset.emoji;
            const shouldShow = !searchTerm || 
                emojiText.includes(searchTerm) || 
                this.getEmojiName(emojiText).toLowerCase().includes(searchLower);
            
            emoji.style.display = shouldShow ? 'flex' : 'none';
        });
    }

    getEmojiName(emoji) {
        // Simple emoji name mapping (expand as needed)
        const emojiNames = {
            '❤️': 'heart love',
            '👍': 'thumbs up like',
            '😊': 'smile happy',
            '😢': 'sad cry',
            '😮': 'surprised wow',
            '😡': 'angry mad',
            '🔥': 'fire hot',
            '👏': 'clap applause'
        };
        return emojiNames[emoji] || emoji;
    }

    handleReactionPanelKeyboard(e) {
        const panel = document.querySelector('.reaction-panel.visible');
        if (!panel) return;

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this.hideReactionPanel();
                break;
            case 'Tab':
                this.handleReactionPanelTab(e);
                break;
            case 'Enter':
            case ' ':
                const focused = document.activeElement;
                if (focused && focused.classList.contains('reaction-emoji')) {
                    e.preventDefault();
                    focused.click();
                }
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'ArrowUp':
            case 'ArrowDown':
                this.handleReactionNavigation(e);
                break;
        }
    }

    handleReactionNavigation(e) {
        const focused = document.activeElement;
        if (!focused || !focused.classList.contains('reaction-emoji')) return;

        const container = focused.parentElement;
        const emojis = Array.from(container.querySelectorAll('.reaction-emoji:not([style*="none"])'));
        const currentIndex = emojis.indexOf(focused);
        
        let nextIndex = currentIndex;
        const cols = 8; // Grid columns

        switch (e.key) {
            case 'ArrowLeft':
                nextIndex = Math.max(0, currentIndex - 1);
                break;
            case 'ArrowRight':
                nextIndex = Math.min(emojis.length - 1, currentIndex + 1);
                break;
            case 'ArrowUp':
                nextIndex = Math.max(0, currentIndex - cols);
                break;
            case 'ArrowDown':
                nextIndex = Math.min(emojis.length - 1, currentIndex + cols);
                break;
        }

        if (nextIndex !== currentIndex && emojis[nextIndex]) {
            e.preventDefault();
            emojis[nextIndex].focus();
        }
    }

    createReadReceiptStyles() {
        // Additional styles for read receipts are included in createRealtimeStyles()
        // This method exists to maintain the API contract
    }

    trackTypingActivity() {
        // Typing activity is already tracked in the main typing system
        // This method exists to maintain the API contract
    }

    // Clean up resources
    destroy() {
        // Clear timers
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        this.debounceTimers.forEach(timer => {
            clearTimeout(timer.id);
        });

        // Clean up observers
        if (this.messageObserver) {
            this.messageObserver.disconnect();
        }

        // Remove event listeners
        document.removeEventListener('keydown', this.handleReactionPanelKeyboard);
        
        // Clear animations
        this.reactionAnimations.forEach(animation => {
            animation.remove();
        });

        console.log('🧹 Real-time manager cleaned up');
    }
}

// Export for use in other modules
window.RealtimeManager = RealtimeManager;

// Auto-initialize if CipherWave context is available
if (typeof window !== 'undefined' && window.cipherWaveAdvanced) {
    window.cipherWaveAdvanced.realtimeManager = new RealtimeManager();
}