// CipherWave Advanced Features Module
// Advanced Gesture Controls, Adaptive UI, PWA Features, Voice Messages, Real-time Features

class CipherWaveAdvanced {
    constructor() {
        this.isInitialized = false;
        this.gestureManager = null;
        this.themeManager = null;
        this.pwaManager = null;
        this.voiceManager = null;
        this.realtimeManager = null;
        this.fileManager = null;
        this.threadManager = null;
        this.securityManager = null;
        
        // Feature flags
        this.features = {
            gestures: true,
            adaptiveTheme: true,
            pwa: true,
            voice: true,
            realtime: true,
            fileSharing: true,
            threading: true,
            security: true
        };
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            console.log('🚀 Initializing CipherWave Advanced Features...');
            
            // Initialize feature managers
            await this.initializeManagers();
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setupFeatures());
            } else {
                await this.setupFeatures();
            }
            
            this.isInitialized = true;
            console.log('✅ CipherWave Advanced Features initialized successfully');
            
            // Announce readiness
            this.announceToScreenReader('Advanced features enabled');
            
        } catch (error) {
            console.error('❌ Failed to initialize advanced features:', error);
        }
    }

    async initializeManagers() {
        // Initialize all feature managers
        this.gestureManager = new GestureManager();
        this.themeManager = new AdaptiveThemeManager();
        this.pwaManager = new PWAManager();
        this.voiceManager = new VoiceMessageManager();
        this.realtimeManager = new RealtimeManager();
        this.fileManager = new FileManager();
        this.threadManager = new ThreadManager();
        this.securityManager = new SecurityManager();
    }

    async setupFeatures() {
        const setupPromises = [];
        
        if (this.features.gestures) {
            setupPromises.push(this.gestureManager.setup());
        }
        
        if (this.features.adaptiveTheme) {
            setupPromises.push(this.themeManager.setup());
        }
        
        if (this.features.pwa) {
            setupPromises.push(this.pwaManager.setup());
        }
        
        if (this.features.voice) {
            setupPromises.push(this.voiceManager.setup());
        }
        
        if (this.features.realtime) {
            setupPromises.push(this.realtimeManager.setup());
        }
        
        if (this.features.fileSharing) {
            setupPromises.push(this.fileManager.setup());
        }
        
        if (this.features.threading) {
            setupPromises.push(this.threadManager.setup());
        }
        
        if (this.features.security) {
            setupPromises.push(this.securityManager.setup());
        }
        
        await Promise.allSettled(setupPromises);
    }

    // Utility method for accessibility announcements
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'visually-hidden';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // Public API for feature management
    enableFeature(featureName) {
        if (this.features.hasOwnProperty(featureName)) {
            this.features[featureName] = true;
            console.log(`✅ Feature enabled: ${featureName}`);
        }
    }

    disableFeature(featureName) {
        if (this.features.hasOwnProperty(featureName)) {
            this.features[featureName] = false;
            console.log(`❌ Feature disabled: ${featureName}`);
        }
    }

    getFeatureStatus() {
        return { ...this.features };
    }
}

// Advanced Gesture Controls Manager
class GestureManager {
    constructor() {
        this.isEnabled = true;
        this.touchStartPos = { x: 0, y: 0 };
        this.touchStartTime = 0;
        this.isLongPress = false;
        this.longPressTimer = null;
        this.swipeThreshold = 50;
        this.longPressDelay = 500;
        this.pinchStartDistance = 0;
        this.isContextMenuOpen = false;
        
        // Gesture state
        this.gestureState = {
            isPinching: false,
            isSwipingLeft: false,
            isSwipingRight: false,
            isSwipingDown: false,
            isPullingToRefresh: false
        };
        
        this.contextMenu = null;
    }

    async setup() {
        if (!this.isEnabled) return;
        
        console.log('🎯 Setting up gesture controls...');
        
        this.setupSwipeGestures();
        this.setupLongPressContextMenu();
        this.setupPinchToZoom();
        this.setupPullToRefresh();
        this.setupSwipeToReply();
        this.createContextMenu();
        
        // Add haptic feedback support
        this.setupHapticFeedback();
        
        console.log('✅ Gesture controls ready');
    }

    setupSwipeGestures() {
        const sidebar = document.querySelector('.tg-sidebar');
        const messagesContainer = document.querySelector('.messages-container');
        const modals = document.querySelectorAll('.modal');
        
        // Sidebar swipe navigation
        if (sidebar) {
            this.addSwipeListeners(sidebar, {
                onSwipeLeft: () => this.handleSidebarSwipe('left'),
                onSwipeRight: () => this.handleSidebarSwipe('right')
            });
        }
        
        // Message container swipe
        if (messagesContainer) {
            this.addSwipeListeners(messagesContainer, {
                onSwipeLeft: (e) => this.handleChatSwipe('left', e),
                onSwipeRight: (e) => this.handleChatSwipe('right', e),
                onSwipeDown: (e) => this.handleChatSwipe('down', e)
            });
        }
        
        // Modal swipe to close
        modals.forEach(modal => {
            this.addSwipeListeners(modal, {
                onSwipeDown: () => this.handleModalSwipe(modal)
            });
        });
    }

    addSwipeListeners(element, handlers) {
        let startX = 0, startY = 0, startTime = 0;
        
        element.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                startTime = Date.now();
            }
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const endTime = Date.now();
                
                const deltaX = endX - startX;
                const deltaY = endY - startY;
                const deltaTime = endTime - startTime;
                
                // Check if it's a valid swipe (fast enough and long enough)
                if (deltaTime < 300 && (Math.abs(deltaX) > this.swipeThreshold || Math.abs(deltaY) > this.swipeThreshold)) {
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        // Horizontal swipe
                        if (deltaX > 0 && handlers.onSwipeRight) {
                            handlers.onSwipeRight(e);
                            this.triggerHaptic('light');
                        } else if (deltaX < 0 && handlers.onSwipeLeft) {
                            handlers.onSwipeLeft(e);
                            this.triggerHaptic('light');
                        }
                    } else {
                        // Vertical swipe
                        if (deltaY > 0 && handlers.onSwipeDown) {
                            handlers.onSwipeDown(e);
                            this.triggerHaptic('light');
                        }
                    }
                }
            }
        }, { passive: true });
    }

    handleSidebarSwipe(direction) {
        const sidebar = document.querySelector('.tg-sidebar');
        if (!sidebar) return;
        
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) return;
        
        if (direction === 'right') {
            // Expand sidebar
            sidebar.classList.add('mobile-expanded');
            this.announceGesture('Navigation menu expanded');
        } else if (direction === 'left') {
            // Collapse sidebar
            sidebar.classList.remove('mobile-expanded');
            this.announceGesture('Navigation menu collapsed');
        }
    }

    handleChatSwipe(direction, event) {
        if (direction === 'left' || direction === 'right') {
            // Navigate between chats
            this.navigateChats(direction);
        } else if (direction === 'down') {
            // Pull to refresh or close keyboard
            this.handlePullToRefresh();
        }
    }

    handleModalSwipe(modal) {
        // Close modal on swipe down
        if (modal.classList.contains('active')) {
            modal.classList.remove('active');
            this.triggerHaptic('medium');
            this.announceGesture('Dialog closed');
        }
    }

    setupLongPressContextMenu() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;
        
        messagesContainer.addEventListener('touchstart', (e) => {
            if (e.target.closest('.message')) {
                this.startLongPress(e);
            }
        }, { passive: true });
        
        messagesContainer.addEventListener('touchend', () => {
            this.endLongPress();
        }, { passive: true });
        
        messagesContainer.addEventListener('touchmove', () => {
            this.endLongPress();
        }, { passive: true });
    }

    startLongPress(event) {
        const messageElement = event.target.closest('.message');
        if (!messageElement) return;
        
        this.longPressTimer = setTimeout(() => {
            this.showContextMenu(messageElement, event);
            this.triggerHaptic('heavy');
        }, this.longPressDelay);
    }

    endLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    showContextMenu(messageElement, event) {
        this.hideContextMenu();
        
        const rect = messageElement.getBoundingClientRect();
        const contextMenu = this.createMessageContextMenu(messageElement);
        
        // Position context menu
        contextMenu.style.position = 'fixed';
        contextMenu.style.top = `${rect.top - 60}px`;
        contextMenu.style.left = `${rect.left}px`;
        contextMenu.style.zIndex = '3000';
        
        document.body.appendChild(contextMenu);
        this.contextMenu = contextMenu;
        this.isContextMenuOpen = true;
        
        // Animate in
        requestAnimationFrame(() => {
            contextMenu.style.opacity = '1';
            contextMenu.style.transform = 'scale(1)';
        });
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideContextMenu();
        }, 5000);
        
        this.announceGesture('Message options menu opened');
    }

    createMessageContextMenu(messageElement) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="reply">
                <i class="fas fa-reply"></i> Reply
            </div>
            <div class="context-menu-item" data-action="copy">
                <i class="fas fa-copy"></i> Copy
            </div>
            <div class="context-menu-item" data-action="forward">
                <i class="fas fa-share"></i> Forward
            </div>
            <div class="context-menu-item" data-action="delete">
                <i class="fas fa-trash"></i> Delete
            </div>
        `;
        
        // Add event listeners
        menu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            if (action) {
                this.handleContextMenuAction(action, messageElement);
            }
        });
        
        return menu;
    }

    handleContextMenuAction(action, messageElement) {
        this.hideContextMenu();
        
        switch (action) {
            case 'reply':
                this.replyToMessage(messageElement);
                break;
            case 'copy':
                this.copyMessage(messageElement);
                break;
            case 'forward':
                this.forwardMessage(messageElement);
                break;
            case 'delete':
                this.deleteMessage(messageElement);
                break;
        }
        
        this.triggerHaptic('light');
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.opacity = '0';
            this.contextMenu.style.transform = 'scale(0.9)';
            setTimeout(() => {
                if (this.contextMenu && this.contextMenu.parentNode) {
                    this.contextMenu.parentNode.removeChild(this.contextMenu);
                }
                this.contextMenu = null;
                this.isContextMenuOpen = false;
            }, 200);
        }
    }

    setupPinchToZoom() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;
        
        let initialDistance = 0;
        let initialScale = 1;
        
        messagesContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = this.getDistance(e.touches[0], e.touches[1]);
                this.gestureState.isPinching = true;
            }
        }, { passive: true });
        
        messagesContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && this.gestureState.isPinching) {
                e.preventDefault();
                
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                const scale = currentDistance / initialDistance;
                
                // Apply zoom to images or media
                const targetElement = e.target.closest('img, video, canvas');
                if (targetElement) {
                    const newScale = Math.min(Math.max(scale, 0.5), 3);
                    targetElement.style.transform = `scale(${newScale})`;
                    targetElement.style.transformOrigin = 'center';
                }
            }
        });
        
        messagesContainer.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                this.gestureState.isPinching = false;
            }
        }, { passive: true });
    }

    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    setupPullToRefresh() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;
        
        let startY = 0;
        let isAtTop = false;
        
        messagesContainer.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isAtTop = messagesContainer.scrollTop === 0;
        }, { passive: true });
        
        messagesContainer.addEventListener('touchmove', (e) => {
            if (isAtTop) {
                const currentY = e.touches[0].clientY;
                const pullDistance = currentY - startY;
                
                if (pullDistance > 100) {
                    this.gestureState.isPullingToRefresh = true;
                    // Show pull to refresh indicator
                    this.showPullToRefreshIndicator();
                }
            }
        }, { passive: true });
        
        messagesContainer.addEventListener('touchend', () => {
            if (this.gestureState.isPullingToRefresh) {
                this.triggerRefresh();
                this.gestureState.isPullingToRefresh = false;
                this.hidePullToRefreshIndicator();
            }
        }, { passive: true });
    }

    setupSwipeToReply() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;
        
        messagesContainer.addEventListener('touchstart', (e) => {
            const messageElement = e.target.closest('.message');
            if (messageElement) {
                this.setupSwipeToReplyForMessage(messageElement);
            }
        }, { passive: true });
    }

    setupSwipeToReplyForMessage(messageElement) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        
        const handleTouchStart = (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        };
        
        const handleTouchMove = (e) => {
            if (!isDragging) return;
            
            currentX = e.touches[0].clientX;
            const deltaX = currentX - startX;
            
            // Only allow swipe to right for reply
            if (deltaX > 0 && deltaX < 100) {
                messageElement.style.transform = `translateX(${deltaX}px)`;
                messageElement.style.opacity = `${1 - deltaX / 200}`;
                
                // Show reply indicator
                if (deltaX > 50) {
                    this.showReplyIndicator(messageElement);
                }
            }
        };
        
        const handleTouchEnd = (e) => {
            if (!isDragging) return;
            
            const deltaX = currentX - startX;
            
            if (deltaX > 50) {
                // Trigger reply
                this.replyToMessage(messageElement);
                this.triggerHaptic('medium');
            }
            
            // Reset message position
            messageElement.style.transform = '';
            messageElement.style.opacity = '';
            this.hideReplyIndicator();
            
            isDragging = false;
        };
        
        messageElement.addEventListener('touchstart', handleTouchStart, { passive: true });
        messageElement.addEventListener('touchmove', handleTouchMove, { passive: true });
        messageElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // Utility methods
    triggerHaptic(intensity = 'light') {
        if (navigator.vibrate) {
            const patterns = {
                light: [10],
                medium: [50],
                heavy: [100, 50, 100]
            };
            navigator.vibrate(patterns[intensity] || patterns.light);
        }
    }

    announceGesture(message) {
        // Create accessibility announcement
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'visually-hidden';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    navigateChats(direction) {
        const chatItems = document.querySelectorAll('.chat-item');
        const activeChat = document.querySelector('.chat-item.active');
        
        if (!activeChat || chatItems.length === 0) return;
        
        const currentIndex = Array.from(chatItems).indexOf(activeChat);
        let newIndex;
        
        if (direction === 'left') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : chatItems.length - 1;
        } else {
            newIndex = currentIndex < chatItems.length - 1 ? currentIndex + 1 : 0;
        }
        
        // Update active chat
        activeChat.classList.remove('active');
        chatItems[newIndex].classList.add('active');
        chatItems[newIndex].click();
    }

    replyToMessage(messageElement) {
        // Implementation will be handled by ThreadManager
        if (window.cipherWaveAdvanced?.threadManager) {
            window.cipherWaveAdvanced.threadManager.initReply(messageElement);
        }
    }

    copyMessage(messageElement) {
        const messageContent = messageElement.querySelector('.message-content');
        if (messageContent) {
            navigator.clipboard.writeText(messageContent.textContent).then(() => {
                this.announceGesture('Message copied to clipboard');
            });
        }
    }

    forwardMessage(messageElement) {
        // Forward message implementation
        this.announceGesture('Forward message feature activated');
    }

    deleteMessage(messageElement) {
        if (confirm('Delete this message?')) {
            messageElement.style.transition = 'all 0.3s ease';
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                messageElement.remove();
            }, 300);
            
            this.announceGesture('Message deleted');
        }
    }

    showPullToRefreshIndicator() {
        // Create or show pull to refresh indicator
        let indicator = document.querySelector('.pull-to-refresh-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'pull-to-refresh-indicator';
            indicator.innerHTML = '<i class="fas fa-sync-alt"></i> Release to refresh';
            document.querySelector('.messages-container').prepend(indicator);
        }
        indicator.style.display = 'block';
    }

    hidePullToRefreshIndicator() {
        const indicator = document.querySelector('.pull-to-refresh-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    triggerRefresh() {
        this.announceGesture('Refreshing messages');
        // Refresh logic here
        setTimeout(() => {
            this.announceGesture('Messages refreshed');
        }, 1000);
    }

    showReplyIndicator(messageElement) {
        let indicator = messageElement.querySelector('.reply-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'reply-indicator';
            indicator.innerHTML = '<i class="fas fa-reply"></i>';
            messageElement.appendChild(indicator);
        }
        indicator.style.display = 'block';
    }

    hideReplyIndicator() {
        const indicators = document.querySelectorAll('.reply-indicator');
        indicators.forEach(indicator => {
            indicator.style.display = 'none';
        });
    }

    createContextMenu() {
        const style = document.createElement('style');
        style.textContent = `
            .context-menu {
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                opacity: 0;
                transform: scale(0.9);
                transition: all 0.2s ease;
                min-width: 180px;
                border: 1px solid #e0e0e0;
            }
            
            .context-menu-item {
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                transition: background-color 0.2s;
                font-size: 14px;
                color: #333;
            }
            
            .context-menu-item:hover {
                background-color: #f5f5f5;
            }
            
            .context-menu-item:active {
                background-color: #e0e0e0;
            }
            
            .context-menu-item i {
                width: 16px;
                text-align: center;
                color: #666;
            }
            
            .pull-to-refresh-indicator {
                text-align: center;
                padding: 16px;
                color: #666;
                font-size: 14px;
                display: none;
                animation: pulse 1s infinite;
            }
            
            .reply-indicator {
                position: absolute;
                right: -30px;
                top: 50%;
                transform: translateY(-50%);
                background: var(--tg-primary);
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                display: none;
            }
        `;
        document.head.appendChild(style);
    }

    setupHapticFeedback() {
        // Enhanced haptic feedback patterns
        this.hapticPatterns = {
            light: [10],
            medium: [30],
            heavy: [50],
            success: [10, 50, 10],
            error: [100, 50, 100, 50, 100],
            notification: [50, 30, 50]
        };
    }
}

// Export for use in other modules
window.GestureManager = GestureManager;

// Initialize if needed
if (typeof window !== 'undefined') {
    window.CipherWaveAdvanced = CipherWaveAdvanced;
}