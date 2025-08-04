// Enhanced Message Threading & Reply Manager
// Comprehensive message threading system with reply, forward, and selection capabilities
// Integrated with existing gesture system for swipe-to-reply functionality

class ThreadManager {
    constructor() {
        // Core threading data structures
        this.threads = new Map(); // messageId -> thread data
        this.messageThreads = new Map(); // messageId -> parentId
        this.threadDepthMap = new Map(); // messageId -> depth level
        
        // Reply and interaction state
        this.replyState = null;
        this.isReplying = false;
        this.forwardingMessage = null;
        this.selectedMessages = new Set();
        this.selectionMode = false;
        
        // Thread navigation state
        this.activeThread = null;
        this.threadHistory = [];
        this.isThreadModalOpen = false;
        
        // UI elements
        this.selectionBar = null;
        this.threadModal = null;
        this.replyPreview = null;
        
        // Gesture integration
        this.gestureIntegration = true;
        this.swipeReplyEnabled = true;
        
        // Accessibility and mobile optimization
        this.announcementTimeout = null;
        this.hapticEnabled = 'vibrate' in navigator;
        
        // Thread visualization options
        this.threadVisualization = {
            showConnectors: true,
            showDepthIndicators: true,
            collapseNestedThreads: false,
            maxVisibleDepth: 3
        };
        
        // Performance optimization
        this.virtualizedThreads = new Map();
        this.messageObserver = null;
        
        console.log('🧵 ThreadManager initialized with enhanced features');
    }

    async setup() {
        console.log('🧵 Setting up comprehensive message threading system...');
        
        try {
            // Core threading setup
            await this.setupReplySystem();
            await this.setupForwardingSystem();
            await this.setupMessageSelection();
            await this.setupQuoteReplies();
            await this.setupThreadNavigation();
            await this.createThreadUI();
            
            // Enhanced features
            await this.setupGestureIntegration();
            await this.setupAccessibilityFeatures();
            await this.setupMobileOptimizations();
            await this.setupPerformanceOptimizations();
            await this.setupThreadVisualization();
            await this.setupKeyboardShortcuts();
            
            // Initialize UI components
            this.createSelectionModeBar();
            this.createThreadModal();
            this.createContextMenus();
            
            console.log('✅ Comprehensive threading system ready');
            this.announceToScreenReader('Message threading features enabled');
            
        } catch (error) {
            console.error('❌ Failed to setup threading system:', error);
            throw error;
        }
    }

    async setupReplySystem() {
        console.log('🔄 Setting up reply system...');
        
        // Add reply buttons to existing messages
        this.addReplyButtonsToMessages();
        
        // Monitor for new messages to add reply buttons
        this.observeNewMessages();
        
        // Setup reply indicators and visual connections
        this.setupReplyIndicators();
        
        console.log('✅ Reply system ready');
    }

    observeNewMessages() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        // Use Intersection Observer for better performance
        this.messageObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('message')) {
                        this.enhanceMessageElement(node);
                    }
                });
            });
        });

        this.messageObserver.observe(messagesContainer, { 
            childList: true, 
            subtree: true 
        });
    }

    enhanceMessageElement(messageElement) {
        // Add comprehensive message enhancements
        this.addReplyButtonToMessage(messageElement);
        this.addMessageActionsToMessage(messageElement);
        this.addCheckboxToMessage(messageElement);
        this.addThreadIndicators(messageElement);
        this.setupMessageGestures(messageElement);
        
        // Add accessibility attributes
        this.enhanceMessageAccessibility(messageElement);
        
        // Add performance optimizations
        this.optimizeMessageElement(messageElement);
    }

    addReplyButtonsToMessages() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            this.enhanceMessageElement(message);
        });
    }

    addReplyButtonToMessage(messageElement) {
        // Don't add reply button if already exists
        if (messageElement.querySelector('.reply-btn')) return;

        const messageTime = messageElement.querySelector('.message-time');
        if (!messageTime) return;

        const replyBtn = document.createElement('button');
        replyBtn.className = 'reply-btn';
        replyBtn.innerHTML = '<i class="fas fa-reply" aria-hidden="true"></i>';
        replyBtn.title = 'Reply to this message';
        replyBtn.setAttribute('aria-label', 'Reply to this message');
        replyBtn.setAttribute('role', 'button');
        replyBtn.setAttribute('tabindex', '0');

        // Enhanced event handling
        const handleReply = (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.initReply(messageElement);
            this.triggerHaptic('light');
        };

        replyBtn.addEventListener('click', handleReply);
        replyBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handleReply(e);
            }
        });

        // Touch feedback
        this.addTouchFeedback(replyBtn);

        messageTime.appendChild(replyBtn);
    }

    initReply(messageElement) {
        const messageId = this.getMessageId(messageElement);
        const messageContent = messageElement.querySelector('.message-content')?.textContent || '';
        const messageType = messageElement.classList.contains('sent') ? 'sent' : 'received';
        const timestamp = this.getMessageTimestamp(messageElement);
        
        this.replyState = {
            messageId: messageId,
            content: messageContent,
            type: messageType,
            timestamp: timestamp,
            element: messageElement
        };

        this.isReplying = true;
        this.showReplyPreview();
        this.focusMessageInput();
        
        // Enhanced accessibility
        const truncatedContent = this.truncateText(messageContent, 50);
        this.announceToScreenReader(`Replying to ${messageType === 'sent' ? 'your' : 'peer'} message: ${truncatedContent}`);
        
        // Visual feedback
        this.highlightReplyTarget(messageElement);
        
        // Haptic feedback
        this.triggerHaptic('light');
        
        // Analytics
        this.trackReplyAction('initiated', messageId);
    }

    showReplyPreview() {
        if (!this.replyState) return;

        // Remove existing reply preview
        this.hideReplyPreview();

        const inputArea = document.querySelector('.input-area');
        if (!inputArea) return;

        this.replyPreview = document.createElement('div');
        this.replyPreview.className = 'reply-preview';
        this.replyPreview.setAttribute('role', 'region');
        this.replyPreview.setAttribute('aria-label', 'Reply preview');
        
        const senderName = this.replyState.type === 'sent' ? 'yourself' : 'peer';
        const timeAgo = this.getTimeAgo(this.replyState.timestamp);
        
        this.replyPreview.innerHTML = `
            <div class="reply-preview-content">
                <div class="reply-preview-header">
                    <div class="reply-preview-icon">
                        <i class="fas fa-reply" aria-hidden="true"></i>
                    </div>
                    <div class="reply-preview-info">
                        <span class="reply-preview-label">Replying to ${senderName}</span>
                        <span class="reply-preview-time">${timeAgo}</span>
                    </div>
                    <button class="reply-cancel-btn" title="Cancel reply" aria-label="Cancel reply">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="reply-preview-message" title="${this.replyState.content}">
                    ${this.truncateText(this.replyState.content, 100)}
                </div>
                <div class="reply-preview-thread-info" style="display: none;">
                    <span class="thread-depth">Thread depth: ${this.getThreadDepth(this.replyState.messageId)}</span>
                </div>
            </div>
        `;

        // Insert before input area with smooth animation
        inputArea.parentNode.insertBefore(this.replyPreview, inputArea);
        
        // Animate in
        requestAnimationFrame(() => {
            this.replyPreview.classList.add('visible');
        });

        // Setup cancel button with enhanced interaction
        const cancelBtn = this.replyPreview.querySelector('.reply-cancel-btn');
        const handleCancel = () => {
            this.cancelReply();
            this.triggerHaptic('light');
        };
        
        cancelBtn.addEventListener('click', handleCancel);
        cancelBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCancel();
            }
        });

        this.addTouchFeedback(cancelBtn);

        // Show thread info if part of existing thread
        const threadDepth = this.getThreadDepth(this.replyState.messageId);
        if (threadDepth > 0) {
            const threadInfo = this.replyPreview.querySelector('.reply-preview-thread-info');
            threadInfo.style.display = 'block';
        }

        // Add enhanced styles
        this.addReplyStyles();
    }

    hideReplyPreview() {
        if (this.replyPreview) {
            this.replyPreview.classList.add('hiding');
            setTimeout(() => {
                if (this.replyPreview && this.replyPreview.parentNode) {
                    this.replyPreview.parentNode.removeChild(this.replyPreview);
                }
                this.replyPreview = null;
            }, 300);
        }
    }

    addReplyStyles() {
        if (document.getElementById('enhanced-thread-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'enhanced-thread-styles';
        styles.textContent = `
            /* Enhanced Reply Button Styles */
            .reply-btn {
                background: none;
                border: none;
                color: var(--tg-text-secondary);
                font-size: 0.75rem;
                cursor: pointer;
                margin-left: var(--spacing-sm);
                opacity: 0;
                transition: all var(--transition-fast);
                min-width: 24px;
                min-height: 24px;
                border-radius: var(--radius-full);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 2;
            }

            .message:hover .reply-btn,
            .message:focus-within .reply-btn {
                opacity: 1;
                transform: scale(1);
            }

            .reply-btn:hover,
            .reply-btn:focus {
                background: rgba(86, 130, 163, 0.1);
                color: var(--tg-primary);
                transform: scale(1.1);
            }

            .reply-btn:active {
                transform: scale(0.95);
                background: rgba(86, 130, 163, 0.2);
            }

            /* Enhanced Reply Preview */
            .reply-preview {
                background: var(--tg-background);
                border-top: 2px solid var(--tg-border);
                padding: var(--spacing-md);
                animation: slideInFromBottom 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                opacity: 0;
                transform: translateY(10px);
                transition: all var(--transition-normal);
                max-height: 0;
                overflow: hidden;
                box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
            }

            .reply-preview.visible {
                opacity: 1;
                transform: translateY(0);
                max-height: 200px;
            }

            .reply-preview.hiding {
                opacity: 0;
                transform: translateY(-10px);
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
            }

            .reply-preview-content {
                background: rgba(86, 130, 163, 0.08);
                border-left: 4px solid var(--tg-primary);
                border-radius: var(--radius-md);
                padding: var(--spacing-md);
                position: relative;
                overflow: hidden;
            }

            .reply-preview-content::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, var(--tg-primary), transparent);
                opacity: 0.3;
            }

            .reply-preview-header {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                margin-bottom: var(--spacing-sm);
                font-size: var(--text-sm);
                color: var(--tg-primary);
                font-weight: 500;
            }

            .reply-preview-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                border-radius: var(--radius-full);
                background: rgba(86, 130, 163, 0.2);
                color: var(--tg-primary);
                font-size: 0.7rem;
            }

            .reply-preview-info {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .reply-preview-label {
                color: var(--tg-primary);
                font-weight: 600;
            }

            .reply-preview-time {
                color: var(--tg-text-secondary);
                font-size: var(--text-xs);
                opacity: 0.8;
            }

            .reply-cancel-btn {
                background: none;
                border: none;
                color: var(--tg-text-secondary);
                cursor: pointer;
                min-width: 24px;
                min-height: 24px;
                border-radius: var(--radius-full);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.7rem;
                transition: all var(--transition-fast);
                flex-shrink: 0;
            }

            .reply-cancel-btn:hover,
            .reply-cancel-btn:focus {
                background: rgba(244, 67, 54, 0.1);
                color: #f44336;
                transform: scale(1.1);
            }

            .reply-cancel-btn:active {
                transform: scale(0.9);
                background: rgba(244, 67, 54, 0.2);
            }

            .reply-preview-message {
                font-size: var(--text-sm);
                color: var(--tg-text-primary);
                line-height: 1.4;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                word-break: break-word;
                background: rgba(255, 255, 255, 0.5);
                padding: var(--spacing-sm);
                border-radius: var(--radius-sm);
                border: 1px solid rgba(86, 130, 163, 0.1);
            }

            .reply-preview-thread-info {
                margin-top: var(--spacing-sm);
                padding-top: var(--spacing-sm);
                border-top: 1px solid rgba(86, 130, 163, 0.2);
                font-size: var(--text-xs);
                color: var(--tg-text-secondary);
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
            }

            /* Thread Reply Styling */
            .thread-reply {
                position: relative;
                margin-left: calc(var(--spacing-lg) + 4px);
                border-left: 2px solid rgba(86, 130, 163, 0.3);
                padding-left: var(--spacing-md);
                margin-bottom: var(--spacing-sm);
            }

            .thread-reply::before {
                content: '';
                position: absolute;
                left: -6px;
                top: 0;
                width: 12px;
                height: 2px;
                background: rgba(86, 130, 163, 0.3);
                border-radius: 1px;
            }

            .thread-reply.depth-1 {
                margin-left: var(--spacing-lg);
                border-left-color: rgba(86, 130, 163, 0.4);
            }

            .thread-reply.depth-2 {
                margin-left: calc(var(--spacing-lg) * 1.5);
                border-left-color: rgba(86, 130, 163, 0.5);
            }

            .thread-reply.depth-3 {
                margin-left: calc(var(--spacing-lg) * 2);
                border-left-color: rgba(86, 130, 163, 0.6);
            }

            /* Quoted Message Enhanced */
            .quoted-message {
                background: rgba(0, 0, 0, 0.04);
                border-left: 3px solid var(--tg-primary);
                border-radius: var(--radius-md);
                padding: var(--spacing-sm) var(--spacing-md);
                margin-bottom: var(--spacing-sm);
                font-size: var(--text-sm);
                color: var(--tg-text-secondary);
                position: relative;
                overflow: hidden;
            }

            .quoted-message::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, var(--tg-primary), transparent);
                opacity: 0.3;
            }

            .quoted-message-header {
                font-weight: 600;
                color: var(--tg-primary);
                margin-bottom: var(--spacing-xs);
                font-size: var(--text-xs);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                display: flex;
                align-items: center;
                gap: var(--spacing-xs);
            }

            .quoted-message-header::before {
                content: '↳';
                font-size: var(--text-sm);
                opacity: 0.7;
            }

            /* Message Actions Enhanced */
            .message-actions {
                position: absolute;
                right: -90px;
                top: 50%;
                transform: translateY(-50%);
                background: white;
                border-radius: var(--radius-xl);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                display: none;
                padding: var(--spacing-xs);
                border: 1px solid rgba(86, 130, 163, 0.1);
                z-index: 10;
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                animation: scaleIn 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .message:hover .message-actions,
            .message:focus-within .message-actions {
                display: flex;
            }

            .message-action-btn {
                background: none;
                border: none;
                color: var(--tg-text-secondary);
                cursor: pointer;
                min-width: 32px;
                min-height: 32px;
                border-radius: var(--radius-full);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: var(--text-sm);
                transition: all var(--transition-fast);
                margin: 0 2px;
                position: relative;
            }

            .message-action-btn:hover,
            .message-action-btn:focus {
                background: rgba(86, 130, 163, 0.1);
                color: var(--tg-primary);
                transform: scale(1.1);
            }

            .message-action-btn:active {
                transform: scale(0.9);
                background: rgba(86, 130, 163, 0.2);
            }

            /* Thread Indicators */
            .thread-indicator {
                position: absolute;
                left: -20px;
                top: 0;
                bottom: 0;
                width: 3px;
                background: linear-gradient(to bottom, var(--tg-primary), rgba(86, 130, 163, 0.3));
                border-radius: var(--radius-sm);
                opacity: 0.8;
            }

            .thread-count {
                font-size: var(--text-xs);
                color: var(--tg-primary);
                background: rgba(86, 130, 163, 0.1);
                padding: 2px 6px;
                border-radius: var(--radius-md);
                margin-top: var(--spacing-xs);
                display: inline-flex;
                align-items: center;
                gap: var(--spacing-xs);
                cursor: pointer;
                transition: all var(--transition-fast);
                border: 1px solid rgba(86, 130, 163, 0.2);
                font-weight: 500;
            }

            .thread-count:hover,
            .thread-count:focus {
                background: rgba(86, 130, 163, 0.2);
                transform: scale(1.05);
                border-color: var(--tg-primary);
            }

            .thread-count:active {
                transform: scale(0.95);
            }

            .thread-count::before {
                content: '💬';
                font-size: 0.8em;
            }

            /* Forward Preview */
            .forward-preview {
                background: var(--tg-background);
                border-top: 2px solid #4CAF50;
                padding: var(--spacing-md);
                animation: slideInFromBottom 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
            }

            .forward-preview-content {
                background: rgba(76, 175, 80, 0.08);
                border-left: 4px solid #4CAF50;
                border-radius: var(--radius-md);
                padding: var(--spacing-md);
                position: relative;
                overflow: hidden;
            }

            .forward-preview-content::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, #4CAF50, transparent);
                opacity: 0.3;
            }

            .forward-preview-header {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                margin-bottom: var(--spacing-sm);
                font-size: var(--text-sm);
                color: #4CAF50;
                font-weight: 600;
            }

            /* Selection Mode Enhanced */
            .selection-mode-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, var(--tg-primary), var(--tg-primary-dark));
                color: white;
                padding: var(--spacing-md);
                z-index: 2000;
                display: none;
                align-items: center;
                justify-content: space-between;
                transition: all var(--transition-normal);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }

            .selection-mode-bar.visible {
                display: flex;
                animation: slideInFromTop 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .selection-info {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
            }

            .selection-count {
                font-weight: 600;
                font-size: var(--text-base);
            }

            .selection-actions {
                display: flex;
                gap: var(--spacing-sm);
            }

            .selection-action-btn {
                background: rgba(255, 255, 255, 0.15);
                border: none;
                color: white;
                padding: var(--spacing-sm) var(--spacing-md);
                border-radius: var(--radius-md);
                cursor: pointer;
                font-size: var(--text-sm);
                font-weight: 500;
                transition: all var(--transition-fast);
                display: flex;
                align-items: center;
                gap: var(--spacing-xs);
                min-height: 36px;
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
            }

            .selection-action-btn:hover,
            .selection-action-btn:focus {
                background: rgba(255, 255, 255, 0.25);
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .selection-action-btn:active {
                transform: translateY(0) scale(0.98);
            }

            /* Message Selection */
            .message.selected {
                background: rgba(86, 130, 163, 0.15) !important;
                border: 2px solid var(--tg-primary);
                transform: scale(1.02);
                box-shadow: 0 4px 12px rgba(86, 130, 163, 0.3);
            }

            .message-checkbox {
                position: absolute;
                left: -35px;
                top: 50%;
                transform: translateY(-50%);
                width: 24px;
                height: 24px;
                border: 2px solid var(--tg-border);
                border-radius: var(--radius-sm);
                background: white;
                cursor: pointer;
                display: none;
                align-items: center;
                justify-content: center;
                transition: all var(--transition-fast);
                font-size: var(--text-sm);
                z-index: 5;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .selection-mode .message-checkbox {
                display: flex;
                animation: scaleIn 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .message-checkbox.checked {
                background: var(--tg-primary);
                border-color: var(--tg-primary);
                color: white;
                transform: translateY(-50%) scale(1.1);
            }

            .message-checkbox:hover {
                border-color: var(--tg-primary);
                transform: translateY(-50%) scale(1.05);
            }

            /* Thread Modal Enhanced */
            .thread-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                z-index: 3000;
                display: none;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                padding: var(--spacing-md);
            }

            .thread-modal.visible {
                display: flex;
                animation: fadeIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .thread-content {
                background: white;
                border-radius: var(--radius-xl);
                width: 100%;
                max-width: 700px;
                max-height: 85vh;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                display: flex;
                flex-direction: column;
                animation: scaleIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .thread-header {
                padding: var(--spacing-lg);
                border-bottom: 2px solid var(--tg-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: linear-gradient(135deg, var(--tg-primary), var(--tg-primary-dark));
                color: white;
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .thread-header h3 {
                margin: 0;
                font-size: var(--text-lg);
                font-weight: 600;
            }

            .thread-header .close-btn {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: none;
                min-width: 36px;
                min-height: 36px;
                border-radius: var(--radius-full);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all var(--transition-fast);
            }

            .thread-header .close-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            .thread-messages {
                flex: 1;
                overflow-y: auto;
                padding: var(--spacing-lg);
                background: linear-gradient(to bottom, #f8f9fa, #ffffff);
            }

            /* Animations */
            @keyframes slideInFromBottom {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            @keyframes slideInFromTop {
                from {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            @keyframes scaleIn {
                from {
                    transform: scale(0.8);
                    opacity: 0;
                }
                to {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }

            /* Mobile Optimizations */
            @media (max-width: 768px) {
                .message-actions {
                    right: -80px;
                    padding: var(--spacing-xs);
                }

                .thread-reply {
                    margin-left: var(--spacing-md);
                    padding-left: var(--spacing-sm);
                }

                .reply-preview,
                .forward-preview {
                    padding: var(--spacing-sm);
                }

                .thread-content {
                    width: 95vw;
                    max-height: 90vh;
                    border-radius: var(--radius-lg);
                }

                .thread-header,
                .thread-messages {
                    padding: var(--spacing-md);
                }

                .selection-mode-bar {
                    padding: var(--spacing-sm) var(--spacing-md);
                }

                .selection-action-btn {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    font-size: var(--text-xs);
                }

                .message-checkbox {
                    left: -30px;
                    width: 20px;
                    height: 20px;
                }
            }

            /* Touch feedback */
            .touch-feedback {
                transform: scale(0.98) !important;
                transition: transform 0.1s ease !important;
            }

            /* Focus indicators */
            .reply-btn:focus,
            .reply-cancel-btn:focus,
            .message-action-btn:focus,
            .selection-action-btn:focus,
            .thread-count:focus {
                outline: 2px solid var(--tg-primary);
                outline-offset: 2px;
            }

            /* High contrast mode support */
            @media (prefers-contrast: high) {
                .reply-preview-content,
                .forward-preview-content {
                    border-width: 3px;
                }

                .message.selected {
                    border-width: 3px;
                }

                .thread-indicator {
                    width: 4px;
                }
            }

            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .reply-preview,
                .forward-preview,
                .selection-mode-bar,
                .thread-modal,
                .message-actions {
                    animation: none !important;
                }

                .reply-btn,
                .message-action-btn,
                .selection-action-btn,
                .thread-count {
                    transition: none !important;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    cancelReply() {
        this.replyState = null;
        this.isReplying = false;
        this.hideReplyPreview();
        this.clearReplyTarget();
        this.announceToScreenReader('Reply cancelled');
        this.trackReplyAction('cancelled');
    }

    highlightReplyTarget(messageElement) {
        // Remove previous highlights
        this.clearReplyTarget();
        
        // Add highlight to target message
        messageElement.classList.add('reply-target');
        
        // Auto-remove highlight after animation
        setTimeout(() => {
            this.clearReplyTarget();
        }, 3000);
    }

    clearReplyTarget() {
        document.querySelectorAll('.reply-target').forEach(el => {
            el.classList.remove('reply-target');
        });
    }

    focusMessageInput() {
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            // Small delay to ensure smooth transition
            setTimeout(() => {
                messageInput.focus();
                
                // Scroll input into view on mobile
                if (window.innerWidth <= 768) {
                    messageInput.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }, 100);
        }
    }

    async setupForwardingSystem() {
        console.log('➡️ Setting up forwarding system...');
        
        // Add forward buttons to existing message actions
        this.addMessageActions();
        
        console.log('✅ Forwarding system ready');
    }

    addMessageActions() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            this.addMessageActionsToMessage(message);
        });
    }

    addMessageActionsToMessage(messageElement) {
        // Don't add actions if already exists
        if (messageElement.querySelector('.message-actions')) return;

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'message-actions';
        actionsContainer.setAttribute('role', 'toolbar');
        actionsContainer.setAttribute('aria-label', 'Message actions');
        
        actionsContainer.innerHTML = `
            <button class="message-action-btn reply-action" title="Reply to message" aria-label="Reply to message">
                <i class="fas fa-reply" aria-hidden="true"></i>
            </button>
            <button class="message-action-btn forward-action" title="Forward message" aria-label="Forward message">
                <i class="fas fa-share" aria-hidden="true"></i>
            </button>
            <button class="message-action-btn select-action" title="Select message" aria-label="Select message">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
            </button>
            <button class="message-action-btn thread-action" title="View thread" aria-label="View thread" style="display: none;">
                <i class="fas fa-comments" aria-hidden="true"></i>
            </button>
        `;

        messageElement.style.position = 'relative';
        messageElement.appendChild(actionsContainer);

        // Setup event listeners with enhanced interaction
        this.setupMessageActionListeners(actionsContainer, messageElement);
    }

    setupMessageActionListeners(actionsContainer, messageElement) {
        const replyBtn = actionsContainer.querySelector('.reply-action');
        const forwardBtn = actionsContainer.querySelector('.forward-action');
        const selectBtn = actionsContainer.querySelector('.select-action');
        const threadBtn = actionsContainer.querySelector('.thread-action');

        // Reply action
        const handleReply = (e) => {
            e.stopPropagation();
            this.initReply(messageElement);
            this.triggerHaptic('light');
        };

        replyBtn.addEventListener('click', handleReply);
        replyBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleReply(e);
            }
        });

        // Forward action
        const handleForward = (e) => {
            e.stopPropagation();
            this.initForward(messageElement);
            this.triggerHaptic('light');
        };

        forwardBtn.addEventListener('click', handleForward);
        forwardBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleForward(e);
            }
        });

        // Select action
        const handleSelect = (e) => {
            e.stopPropagation();
            this.toggleMessageSelection(messageElement);
            this.triggerHaptic('light');
        };

        selectBtn.addEventListener('click', handleSelect);
        selectBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelect(e);
            }
        });

        // Thread action (show if message has replies)
        const messageId = this.getMessageId(messageElement);
        if (this.threads.has(messageId)) {
            threadBtn.style.display = 'flex';
            
            const handleThread = (e) => {
                e.stopPropagation();
                this.showThreadModal(messageElement);
                this.triggerHaptic('medium');
            };

            threadBtn.addEventListener('click', handleThread);
            threadBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleThread(e);
                }
            });
        }

        // Add touch feedback to all buttons
        [replyBtn, forwardBtn, selectBtn, threadBtn].forEach(btn => {
            this.addTouchFeedback(btn);
        });
    }

    initForward(messageElement) {
        const messageId = this.getMessageId(messageElement);
        const messageContent = messageElement.querySelector('.message-content')?.textContent || '';
        const messageType = messageElement.classList.contains('sent') ? 'sent' : 'received';
        const timestamp = this.getMessageTimestamp(messageElement);
        
        this.forwardingMessage = {
            messageId: messageId,
            content: messageContent,
            type: messageType,
            timestamp: timestamp,
            element: messageElement
        };

        this.showForwardPreview();
        this.focusMessageInput();
        
        const truncatedContent = this.truncateText(messageContent, 50);
        this.announceToScreenReader(`Forwarding message: ${truncatedContent}`);
        this.triggerHaptic('light');
        this.trackForwardAction('initiated', messageId);
    }

    showForwardPreview() {
        if (!this.forwardingMessage) return;

        // Remove existing forward preview  
        this.hideForwardPreview();

        const inputArea = document.querySelector('.input-area');
        if (!inputArea) return;

        const forwardPreview = document.createElement('div');
        forwardPreview.className = 'forward-preview';
        forwardPreview.setAttribute('role', 'region');
        forwardPreview.setAttribute('aria-label', 'Forward preview');
        
        const timeAgo = this.getTimeAgo(this.forwardingMessage.timestamp);
        
        forwardPreview.innerHTML = `
            <div class="forward-preview-content">
                <div class="forward-preview-header">
                    <div class="reply-preview-icon" style="background: rgba(76, 175, 80, 0.2); color: #4CAF50;">
                        <i class="fas fa-share" aria-hidden="true"></i>
                    </div>
                    <div class="reply-preview-info">
                        <span class="reply-preview-label" style="color: #4CAF50;">Forwarding message</span>
                        <span class="reply-preview-time">${timeAgo}</span>
                    </div>
                    <button class="reply-cancel-btn" title="Cancel forward" aria-label="Cancel forward">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="reply-preview-message" title="${this.forwardingMessage.content}">
                    ${this.truncateText(this.forwardingMessage.content, 100)}
                </div>
            </div>
        `;

        // Insert before input area
        inputArea.parentNode.insertBefore(forwardPreview, inputArea);

        // Setup cancel button
        const cancelBtn = forwardPreview.querySelector('.reply-cancel-btn');
        const handleCancel = () => {
            this.cancelForward();
            this.triggerHaptic('light');
        };
        
        cancelBtn.addEventListener('click', handleCancel);
        cancelBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCancel();
            }
        });

        this.addTouchFeedback(cancelBtn);
    }

    hideForwardPreview() {
        const forwardPreview = document.querySelector('.forward-preview');
        if (forwardPreview) {
            forwardPreview.remove();
        }
    }

    cancelForward() {
        this.forwardingMessage = null;
        this.hideForwardPreview();
        this.announceToScreenReader('Forward cancelled');
        this.trackForwardAction('cancelled');
    }

    async setupMessageSelection() {
        console.log('☑️ Setting up message selection...');
        
        // Add checkboxes to existing messages
        this.addCheckboxesToMessages();
        
        console.log('✅ Message selection ready');
    }

    createSelectionModeBar() {
        // Don't create if already exists
        if (this.selectionBar) return;

        this.selectionBar = document.createElement('div');
        this.selectionBar.className = 'selection-mode-bar';
        this.selectionBar.setAttribute('role', 'toolbar');
        this.selectionBar.setAttribute('aria-label', 'Message selection toolbar');
        
        this.selectionBar.innerHTML = `
            <div class="selection-info">
                <button class="selection-action-btn" id="cancel-selection" title="Cancel selection" aria-label="Cancel selection">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
                <span class="selection-count" role="status" aria-live="polite">0 selected</span>
            </div>
            <div class="selection-actions">
                <button class="selection-action-btn" id="delete-selected" title="Delete selected messages" aria-label="Delete selected messages">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                    <span>Delete</span>
                </button>
                <button class="selection-action-btn" id="forward-selected" title="Forward selected messages" aria-label="Forward selected messages">
                    <i class="fas fa-share" aria-hidden="true"></i>
                    <span>Forward</span>
                </button>
                <button class="selection-action-btn" id="copy-selected" title="Copy selected messages" aria-label="Copy selected messages">
                    <i class="fas fa-copy" aria-hidden="true"></i>
                    <span>Copy</span>
                </button>
            </div>
        `;

        document.body.appendChild(this.selectionBar);

        // Setup event listeners
        this.setupSelectionBarListeners();
    }

    setupSelectionBarListeners() {
        const cancelBtn = this.selectionBar.querySelector('#cancel-selection');
        const deleteBtn = this.selectionBar.querySelector('#delete-selected');
        const forwardBtn = this.selectionBar.querySelector('#forward-selected');
        const copyBtn = this.selectionBar.querySelector('#copy-selected');

        // Cancel selection
        const handleCancel = () => {
            this.exitSelectionMode();
            this.triggerHaptic('light');
        };

        cancelBtn.addEventListener('click', handleCancel);
        cancelBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCancel();
            }
        });

        // Delete selected
        const handleDelete = () => {
            this.deleteSelectedMessages();
            this.triggerHaptic('medium');
        };

        deleteBtn.addEventListener('click', handleDelete);
        deleteBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleDelete();
            }
        });

        // Forward selected
        const handleForward = () => {
            this.forwardSelectedMessages();
            this.triggerHaptic('light');
        };

        forwardBtn.addEventListener('click', handleForward);
        forwardBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleForward();
            }
        });

        // Copy selected
        const handleCopy = () => {
            this.copySelectedMessages();
            this.triggerHaptic('light');
        };

        copyBtn.addEventListener('click', handleCopy);
        copyBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCopy();
            }
        });

        // Add touch feedback
        [cancelBtn, deleteBtn, forwardBtn, copyBtn].forEach(btn => {
            this.addTouchFeedback(btn);
        });
    }

    addCheckboxesToMessages() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            this.addCheckboxToMessage(message);
        });
    }

    addCheckboxToMessage(messageElement) {
        // Don't add checkbox if already exists
        if (messageElement.querySelector('.message-checkbox')) return;

        const checkbox = document.createElement('div');
        checkbox.className = 'message-checkbox';
        checkbox.setAttribute('role', 'checkbox');
        checkbox.setAttribute('aria-checked', 'false');
        checkbox.setAttribute('tabindex', '0');
        checkbox.setAttribute('aria-label', 'Select message');
        checkbox.innerHTML = '<i class="fas fa-check" style="display: none;" aria-hidden="true"></i>';

        const handleToggle = (e) => {
            e.stopPropagation();
            this.toggleMessageSelection(messageElement);
            this.triggerHaptic('light');
        };

        checkbox.addEventListener('click', handleToggle);
        checkbox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle(e);
            }
        });

        this.addTouchFeedback(checkbox);
        messageElement.appendChild(checkbox);
    }

    toggleMessageSelection(messageElement) {
        const messageId = this.getMessageId(messageElement);
        const checkbox = messageElement.querySelector('.message-checkbox');
        const checkIcon = checkbox.querySelector('i');

        if (this.selectedMessages.has(messageId)) {
            // Deselect
            this.selectedMessages.delete(messageId);
            messageElement.classList.remove('selected');
            checkbox.classList.remove('checked');
            checkbox.setAttribute('aria-checked', 'false');
            checkIcon.style.display = 'none';
            
            this.announceToScreenReader('Message deselected');
        } else {
            // Select
            this.selectedMessages.add(messageId);
            messageElement.classList.add('selected');
            checkbox.classList.add('checked');
            checkbox.setAttribute('aria-checked', 'true');
            checkIcon.style.display = 'block';
            
            // Enter selection mode if not already
            if (!this.selectionMode) {
                this.enterSelectionMode();
            }
            
            this.announceToScreenReader('Message selected');
        }

        this.updateSelectionCount();
        
        // Exit selection mode if no messages selected
        if (this.selectedMessages.size === 0 && this.selectionMode) {
            this.exitSelectionMode();
        }
        
        this.trackSelectionAction('toggle', messageId);
    }

    enterSelectionMode() {
        this.selectionMode = true;
        document.body.classList.add('selection-mode');
        
        if (this.selectionBar) {
            this.selectionBar.classList.add('visible');
        }
        
        // Adjust app layout for selection bar
        const app = document.querySelector('.tg-app');
        if (app) {
            app.style.marginTop = '60px';
            app.style.transition = 'margin-top 0.3s ease';
        }
        
        this.announceToScreenReader('Selection mode activated');
        this.trackSelectionAction('enter');
    }

    exitSelectionMode() {
        this.selectionMode = false;
        document.body.classList.remove('selection-mode');
        
        if (this.selectionBar) {
            this.selectionBar.classList.remove('visible');
        }
        
        // Reset app layout
        const app = document.querySelector('.tg-app');
        if (app) {
            app.style.marginTop = '0';
        }
        
        // Clear all selections
        this.selectedMessages.clear();
        document.querySelectorAll('.message.selected').forEach(message => {
            message.classList.remove('selected');
            const checkbox = message.querySelector('.message-checkbox');
            if (checkbox) {
                checkbox.classList.remove('checked');
                checkbox.setAttribute('aria-checked', 'false');
                const checkIcon = checkbox.querySelector('i');
                if (checkIcon) checkIcon.style.display = 'none';
            }
        });
        
        this.announceToScreenReader('Selection mode deactivated');
        this.trackSelectionAction('exit');
    }

    updateSelectionCount() {
        if (!this.selectionBar) return;
        
        const countElement = this.selectionBar.querySelector('.selection-count');
        if (countElement) {
            const count = this.selectedMessages.size;
            const text = count === 1 ? '1 message selected' : `${count} messages selected`;
            countElement.textContent = text;
            countElement.setAttribute('aria-label', text);
        }
    }

    deleteSelectedMessages() {
        if (this.selectedMessages.size === 0) return;

        const count = this.selectedMessages.size;
        const confirmMessage = `Delete ${count} message${count !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`;
        
        if (confirm(confirmMessage)) {
            let deletedCount = 0;
            
            this.selectedMessages.forEach(messageId => {
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageElement) {
                    // Animate out
                    messageElement.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    messageElement.style.opacity = '0';
                    messageElement.style.transform = 'translateX(-100%) scale(0.8)';
                    
                    setTimeout(() => {
                        if (messageElement.parentNode) {
                            messageElement.parentNode.removeChild(messageElement);
                        }
                    }, 300);
                    
                    deletedCount++;
                    
                    // Remove from threads if it's a parent
                    if (this.threads.has(messageId)) {
                        this.threads.delete(messageId);
                    }
                    
                    // Update thread references
                    this.updateThreadReferences(messageId);
                }
            });
            
            const message = `${deletedCount} message${deletedCount !== 1 ? 's' : ''} deleted`;
            this.announceToScreenReader(message);
            this.showToast(message, 'success');
            
            this.exitSelectionMode();
            this.trackSelectionAction('delete', null, deletedCount);
        }
    }

    forwardSelectedMessages() {
        if (this.selectedMessages.size === 0) return;

        const count = this.selectedMessages.size;
        
        // In a real implementation, this would open a contact picker
        // For now, show a toast with instructions
        const message = `${count} message${count !== 1 ? 's' : ''} prepared for forwarding. Feature will be enhanced in future updates.`;
        this.showToast(message, 'info');
        
        this.announceToScreenReader(message);
        this.exitSelectionMode();
        this.trackSelectionAction('forward', null, count);
    }

    copySelectedMessages() {
        if (this.selectedMessages.size === 0) return;

        let copiedText = '';
        const messages = [];
        
        // Collect messages in chronological order
        this.selectedMessages.forEach(messageId => {
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                const content = messageElement.querySelector('.message-content')?.textContent || '';
                const timestamp = this.getMessageTimestamp(messageElement);
                const type = messageElement.classList.contains('sent') ? 'You' : 'Peer';
                
                messages.push({
                    content,
                    timestamp,
                    type,
                    element: messageElement
                });
            }
        });
        
        // Sort by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Format for clipboard
        copiedText = messages.map(msg => {
            const time = new Date(msg.timestamp).toLocaleString();
            return `[${time}] ${msg.type}: ${msg.content}`;
        }).join('\n\n');
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(copiedText).then(() => {
                const count = messages.length;
                const message = `${count} message${count !== 1 ? 's' : ''} copied to clipboard`;
                this.showToast(message, 'success');
                this.announceToScreenReader(message);
            }).catch(err => {
                console.error('Failed to copy to clipboard:', err);
                this.showToast('Failed to copy messages', 'error');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = copiedText;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                const count = messages.length;
                const message = `${count} message${count !== 1 ? 's' : ''} copied to clipboard`;
                this.showToast(message, 'success');
                this.announceToScreenReader(message);
            } catch (err) {
                console.error('Failed to copy to clipboard:', err);
                this.showToast('Failed to copy messages', 'error');
            } finally {
                document.body.removeChild(textArea);
            }
        }
        
        this.exitSelectionMode();
        this.trackSelectionAction('copy', null, messages.length);
    }

    async setupQuoteReplies() {
        console.log('💬 Setting up quote replies...');
        // Quote replies are created when sending a reply
        // This is handled in the send message function
        console.log('✅ Quote replies ready');
    }

    async setupThreadNavigation() {
        console.log('🗺️ Setting up thread navigation...');
        
        // Add thread indicators and navigation
        this.updateThreadIndicators();
        
        // Setup keyboard navigation for threads
        this.setupThreadKeyboardNavigation();
        
        console.log('✅ Thread navigation ready');
    }

    updateThreadIndicators() {
        // Update thread indicators for messages that have replies
        this.threads.forEach((thread, parentId) => {
            const parentElement = document.querySelector(`[data-message-id="${parentId}"]`);
            if (parentElement && thread.replies.length > 0) {
                this.addThreadIndicator(parentElement, thread.replies.length);
            }
        });
    }

    addThreadIndicator(messageElement, replyCount) {
        // Remove existing thread indicator
        const existingIndicator = messageElement.querySelector('.thread-count');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        // Don't add indicator for very deep threads to avoid clutter
        const depth = this.getThreadDepth(this.getMessageId(messageElement));
        if (depth > this.threadVisualization.maxVisibleDepth) return;

        const threadCount = document.createElement('div');
        threadCount.className = 'thread-count';
        threadCount.setAttribute('role', 'button');
        threadCount.setAttribute('tabindex', '0');
        threadCount.setAttribute('aria-label', `View thread with ${replyCount} replies`);
        
        const replyText = replyCount === 1 ? 'reply' : 'replies';
        threadCount.textContent = `${replyCount} ${replyText}`;
        
        const handleThreadView = () => {
            this.showThreadModal(messageElement);
            this.triggerHaptic('medium');
        };
        
        threadCount.addEventListener('click', handleThreadView);
        threadCount.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleThreadView();
            }
        });

        this.addTouchFeedback(threadCount);
        messageElement.appendChild(threadCount);

        // Show thread action button
        const threadBtn = messageElement.querySelector('.thread-action');
        if (threadBtn) {
            threadBtn.style.display = 'flex';
        }
    }

    showThreadModal(parentMessageElement) {
        const parentId = this.getMessageId(parentMessageElement);
        const thread = this.threads.get(parentId);
        
        if (!thread) return;

        this.activeThread = parentId;
        this.createThreadModal(parentMessageElement, thread);
        
        this.announceToScreenReader(`Thread opened with ${thread.replies.length} replies`);
        this.trackThreadAction('view', parentId);
    }

    createThreadModal(parentElement, thread) {
        // Remove existing thread modal
        this.closeThreadModal();

        this.threadModal = document.createElement('div');
        this.threadModal.className = 'thread-modal';
        this.threadModal.setAttribute('role', 'dialog');
        this.threadModal.setAttribute('aria-modal', 'true');
        this.threadModal.setAttribute('aria-labelledby', 'thread-modal-title');
        
        const parentContent = parentElement.querySelector('.message-content')?.textContent || '';
        const truncatedParent = this.truncateText(parentContent, 50);
        
        this.threadModal.innerHTML = `
            <div class="thread-content">
                <div class="thread-header">
                    <h3 id="thread-modal-title">Thread: ${truncatedParent}</h3>
                    <div class="thread-header-actions">
                        <span class="thread-reply-count">${thread.replies.length} replies</span>
                        <button class="close-btn" aria-label="Close thread">
                            <i class="fas fa-times" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
                <div class="thread-messages" role="log" aria-live="polite">
                    ${this.renderThreadMessages(parentElement, thread)}
                </div>
                <div class="thread-input-area">
                    <button class="thread-reply-btn btn-primary">
                        <i class="fas fa-reply" aria-hidden="true"></i>
                        Reply to thread
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.threadModal);
        
        // Animate in
        requestAnimationFrame(() => {
            this.threadModal.classList.add('visible');
        });

        // Setup event listeners
        this.setupThreadModalListeners();
        
        // Focus management
        this.setupThreadModalFocus();
        
        this.isThreadModalOpen = true;
    }

    setupThreadModalListeners() {
        if (!this.threadModal) return;

        const closeBtn = this.threadModal.querySelector('.close-btn');
        const replyBtn = this.threadModal.querySelector('.thread-reply-btn');

        // Close button
        const handleClose = () => {
            this.closeThreadModal();
            this.triggerHaptic('light');
        };

        closeBtn.addEventListener('click', handleClose);
        closeBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClose();
            }
        });

        // Reply button
        const handleReply = () => {
            this.closeThreadModal();
            const parentElement = document.querySelector(`[data-message-id="${this.activeThread}"]`);
            if (parentElement) {
                this.initReply(parentElement);
            }
            this.triggerHaptic('light');
        };

        replyBtn.addEventListener('click', handleReply);
        replyBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleReply();
            }
        });

        // Close on background click
        this.threadModal.addEventListener('click', (e) => {
            if (e.target === this.threadModal) {
                handleClose();
            }
        });

        // Close on Escape key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        
        // Store reference to remove later
        this.threadModal._keydownHandler = handleKeyDown;

        // Add touch feedback
        this.addTouchFeedback(closeBtn);
        this.addTouchFeedback(replyBtn);
    }

    setupThreadModalFocus() {
        if (!this.threadModal) return;

        // Store currently focused element
        this.previousFocus = document.activeElement;

        // Focus the close button initially
        const closeBtn = this.threadModal.querySelector('.close-btn');
        if (closeBtn) {
            setTimeout(() => closeBtn.focus(), 100);
        }

        // Trap focus within modal
        const focusableElements = this.threadModal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length > 0) {
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];

            this.threadModal.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        if (document.activeElement === firstFocusable) {
                            e.preventDefault();
                            lastFocusable.focus();
                        }
                    } else {
                        if (document.activeElement === lastFocusable) {
                            e.preventDefault();
                            firstFocusable.focus();
                        }
                    }
                }
            });
        }
    }

    renderThreadMessages(parentElement, thread) {
        let html = `
            <div class="message original-message" data-thread-depth="0">
                <div class="thread-message-header">
                    <strong>Original Message</strong>
                    <span class="thread-message-time">${this.getFormattedTime(this.getMessageTimestamp(parentElement))}</span>
                </div>
                <div class="thread-message-content">
                    ${parentElement.querySelector('.message-content')?.innerHTML || ''}
                </div>
            </div>
        `;

        thread.replies.forEach((reply, index) => {
            const replyElement = document.querySelector(`[data-message-id="${reply.messageId}"]`);
            const depth = this.getThreadDepth(reply.messageId);
            
            if (replyElement) {
                const isOwn = replyElement.classList.contains('sent');
                const time = this.getFormattedTime(reply.timestamp);
                
                html += `
                    <div class="message thread-reply depth-${Math.min(depth, 3)}" data-thread-depth="${depth}">
                        <div class="thread-message-header">
                            <strong>${isOwn ? 'You' : 'Peer'}</strong>
                            <span class="thread-message-time">${time}</span>
                        </div>
                        <div class="thread-message-content">
                            ${replyElement.querySelector('.message-content')?.innerHTML || ''}
                        </div>
                        ${reply.replyTo ? `
                            <div class="thread-reply-context">
                                <i class="fas fa-reply" aria-hidden="true"></i>
                                Replying to: "${this.truncateText(reply.replyTo.content, 50)}"
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        });

        return html;
    }

    closeThreadModal() {
        if (!this.threadModal) return;

        this.threadModal.classList.remove('visible');
        
        // Remove keydown handler
        if (this.threadModal._keydownHandler) {
            document.removeEventListener('keydown', this.threadModal._keydownHandler);
        }
        
        setTimeout(() => {
            if (this.threadModal && this.threadModal.parentNode) {
                this.threadModal.parentNode.removeChild(this.threadModal);
            }
            this.threadModal = null;
            
            // Restore focus
            if (this.previousFocus) {
                this.previousFocus.focus();
                this.previousFocus = null;
            }
        }, 300);

        this.isThreadModalOpen = false;
        this.activeThread = null;
        
        this.announceToScreenReader('Thread closed');
    }

    async createThreadUI() {
        console.log('🎨 Creating thread UI components...');
        
        // UI elements are created in other setup methods
        // This method handles additional UI setup
        
        this.addGlobalStyles();
        
        console.log('✅ Thread UI ready');
    }

    addGlobalStyles() {
        // Add global styles for thread system
        if (document.getElementById('thread-global-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'thread-global-styles';
        styles.textContent = `
            /* Global thread styles */
            .reply-target {
                background: rgba(86, 130, 163, 0.1) !important;
                transform: scale(1.02);
                box-shadow: 0 0 0 2px rgba(86, 130, 163, 0.3);
                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .thread-message-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--spacing-xs);
                padding-bottom: var(--spacing-xs);
                border-bottom: 1px solid rgba(86, 130, 163, 0.1);
                font-size: var(--text-xs);
            }

            .thread-message-time {
                color: var(--tg-text-secondary);
                font-weight: normal;
            }

            .thread-message-content {
                font-size: var(--text-sm);
                line-height: 1.4;
            }

            .thread-reply-context {
                margin-top: var(--spacing-sm);
                padding-top: var(--spacing-sm);
                border-top: 1px solid rgba(86, 130, 163, 0.1);
                font-size: var(--text-xs);
                color: var(--tg-text-secondary);
                display: flex;
                align-items: center;
                gap: var(--spacing-xs);
            }

            .thread-input-area {
                padding: var(--spacing-lg);
                border-top: 2px solid var(--tg-border);
                background: var(--tg-background);
                display: flex;
                justify-content: center;
            }

            .thread-reply-btn {
                padding: var(--spacing-sm) var(--spacing-lg);
                border-radius: var(--radius-xl);
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                transition: all var(--transition-fast);
            }

            .thread-reply-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(86, 130, 163, 0.3);
            }

            .thread-header-actions {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
            }

            .thread-reply-count {
                font-size: var(--text-sm);
                color: rgba(255, 255, 255, 0.8);
                background: rgba(255, 255, 255, 0.1);
                padding: var(--spacing-xs) var(--spacing-sm);
                border-radius: var(--radius-md);
                font-weight: 500;
            }

            /* Toast notifications */
            .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: var(--radius-md);
                padding: var(--spacing-md) var(--spacing-lg);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                z-index: 4000;
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                max-width: 350px;
                transform: translateX(100%);
                transition: transform var(--transition-normal);
                border-left: 4px solid var(--tg-primary);
            }

            .toast.visible {
                transform: translateX(0);
            }

            .toast.success {
                border-left-color: #4CAF50;
                color: #2E7D32;
            }

            .toast.error {
                border-left-color: #f44336;
                color: #C62828;
            }

            .toast.info {
                border-left-color: #2196F3;
                color: #1565C0;
            }

            .toast-icon {
                font-size: var(--text-lg);
                flex-shrink: 0;
            }

            .toast-message {
                font-size: var(--text-sm);
                font-weight: 500;
                line-height: 1.4;
            }

            /* Enhanced mobile styles */
            @media (max-width: 768px) {
                .toast {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                    transform: translateY(-100%);
                }

                .toast.visible {
                    transform: translateY(0);
                }

                .thread-content {
                    margin: var(--spacing-sm);
                    max-height: calc(100vh - var(--spacing-lg));
                }

                .thread-input-area {
                    padding: var(--spacing-md);
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Enhanced message sending integration
    handleMessageSend(messageContent) {
        if (this.isReplying && this.replyState) {
            return this.sendReplyMessage(messageContent);
        } else if (this.forwardingMessage) {
            return this.sendForwardMessage(messageContent);
        }
        
        return null; // Let normal message sending proceed
    }

    sendReplyMessage(messageContent) {
        const replyData = {
            type: 'reply-message',
            content: messageContent,
            replyTo: {
                messageId: this.replyState.messageId,
                content: this.replyState.content,
                timestamp: this.replyState.timestamp
            },
            timestamp: Date.now(),
            messageId: this.generateMessageId()
        };

        // Create quoted message element
        const messageElement = this.createReplyMessageElement(replyData);
        
        // Add to messages container
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.appendChild(messageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Update thread data
        this.addToThread(this.replyState.messageId, {
            messageId: replyData.messageId,
            content: messageContent,
            timestamp: replyData.timestamp,
            replyTo: replyData.replyTo
        });

        // Send via WebRTC
        this.sendThreadData(replyData);

        // Clean up reply state
        this.cancelReply();
        
        // Analytics
        this.trackReplyAction('sent', replyData.messageId);

        return true; // Indicate that message was handled
    }

    sendForwardMessage(messageContent) {
        const forwardData = {
            type: 'forward-message',
            content: messageContent,
            forwardedMessage: {
                content: this.forwardingMessage.content,
                timestamp: this.forwardingMessage.timestamp
            },
            timestamp: Date.now(),
            messageId: this.generateMessageId()
        };

        // Create forward message element
        const messageElement = this.createForwardMessageElement(forwardData);
        
        // Add to messages container
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.appendChild(messageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Send via WebRTC
        this.sendThreadData(forwardData);

        // Clean up forward state
        this.cancelForward();
        
        // Analytics
        this.trackForwardAction('sent', forwardData.messageId);

        return true; // Indicate that message was handled
    }

    createReplyMessageElement(replyData) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message sent';
        messageElement.dataset.messageId = replyData.messageId;
        messageElement.setAttribute('role', 'article');
        messageElement.setAttribute('aria-label', `Reply message: ${replyData.content}`);
        
        const time = this.getFormattedTime(replyData.timestamp);
        const replyToTime = this.getFormattedTime(replyData.replyTo.timestamp);
        
        messageElement.innerHTML = `
            <div class="quoted-message">
                <div class="quoted-message-header">
                    <span>Replying to message from ${replyToTime}</span>
                </div>
                <div>${this.truncateText(replyData.replyTo.content, 100)}</div>
            </div>
            <div class="message-content">${this.escapeHtml(replyData.content)}</div>
            <div class="message-time">${time}</div>
        `;

        // Enhance the new message element
        setTimeout(() => {
            this.enhanceMessageElement(messageElement);
        }, 100);

        return messageElement;
    }

    createForwardMessageElement(forwardData) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message sent';
        messageElement.dataset.messageId = forwardData.messageId;
        messageElement.setAttribute('role', 'article');
        messageElement.setAttribute('aria-label', `Forwarded message: ${forwardData.content}`);
        
        const time = this.getFormattedTime(forwardData.timestamp);
        const forwardedTime = this.getFormattedTime(forwardData.forwardedMessage.timestamp);
        
        messageElement.innerHTML = `
            <div class="quoted-message">
                <div class="quoted-message-header">
                    <span>Forwarded message from ${forwardedTime}</span>
                </div>
                <div>${this.truncateText(forwardData.forwardedMessage.content, 100)}</div>
            </div>
            <div class="message-content">${this.escapeHtml(forwardData.content)}</div>
            <div class="message-time">${time}</div>
        `;

        // Enhance the new message element
        setTimeout(() => {
            this.enhanceMessageElement(messageElement);
        }, 100);

        return messageElement;
    }

    addToThread(parentMessageId, replyData) {
        if (!this.threads.has(parentMessageId)) {
            this.threads.set(parentMessageId, {
                parentId: parentMessageId,
                replies: [],
                created: Date.now()
            });
        }

        const thread = this.threads.get(parentMessageId);
        thread.replies.push(replyData);
        
        // Update thread depth mapping
        const parentDepth = this.threadDepthMap.get(parentMessageId) || 0;
        this.threadDepthMap.set(replyData.messageId, parentDepth + 1);
        
        // Update message thread mapping
        this.messageThreads.set(replyData.messageId, parentMessageId);

        // Update thread indicator
        const parentElement = document.querySelector(`[data-message-id="${parentMessageId}"]`);
        if (parentElement) {
            this.addThreadIndicator(parentElement, thread.replies.length);
        }
        
        // Update thread visualization if needed
        this.updateThreadVisualization();
    }

    sendThreadData(data) {
        // Send via existing WebRTC data channel
        if (window.dataChannel && window.dataChannel.readyState === 'open') {
            try {
                window.dataChannel.send(JSON.stringify(data));
                console.log('Thread data sent:', data.type);
            } catch (error) {
                console.error('Failed to send thread data:', error);
                this.showToast('Failed to send message', 'error');
            }
        } else {
            console.warn('Data channel not available for thread data');
            this.showToast('Connection not available', 'error');
        }
    }

    handleIncomingThreadData(data) {
        try {
            switch (data.type) {
                case 'reply-message':
                    this.handleIncomingReply(data);
                    break;
                case 'forward-message':
                    this.handleIncomingForward(data);
                    break;
                default:
                    console.warn('Unknown thread data type:', data.type);
            }
        } catch (error) {
            console.error('Error handling incoming thread data:', error);
        }
    }

    handleIncomingReply(data) {
        // Create received reply message
        const messageElement = this.createReceivedReplyMessage(data);
        
        // Add to messages container
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.appendChild(messageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Update thread data
        this.addToThread(data.replyTo.messageId, {
            messageId: data.messageId,
            content: data.content,
            timestamp: data.timestamp,
            replyTo: data.replyTo
        });

        this.announceToScreenReader('Reply message received');
        this.triggerHaptic('light');
        
        // Show notification if app is not in focus
        if (document.hidden) {
            this.showNotification('New Reply', data.content);
        }
    }

    handleIncomingForward(data) {
        // Create received forward message
        const messageElement = this.createReceivedForwardMessage(data);
        
        // Add to messages container
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.appendChild(messageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        this.announceToScreenReader('Forwarded message received');
        this.triggerHaptic('light');
        
        // Show notification if app is not in focus
        if (document.hidden) {
            this.showNotification('New Forward', data.content);
        }
    }

    createReceivedReplyMessage(data) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message received';
        messageElement.dataset.messageId = data.messageId;
        messageElement.setAttribute('role', 'article');
        messageElement.setAttribute('aria-label', `Received reply: ${data.content}`);
        
        const time = this.getFormattedTime(data.timestamp);
        const replyToTime = this.getFormattedTime(data.replyTo.timestamp);
        
        messageElement.innerHTML = `
            <div class="quoted-message">
                <div class="quoted-message-header">
                    <span>Replying to message from ${replyToTime}</span>
                </div>
                <div>${this.truncateText(data.replyTo.content, 100)}</div>
            </div>
            <div class="message-content">${this.escapeHtml(data.content)}</div>
            <div class="message-time">${time}</div>
        `;

        // Enhance the new message element
        setTimeout(() => {
            this.enhanceMessageElement(messageElement);
        }, 100);

        return messageElement;
    }

    createReceivedForwardMessage(data) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message received';
        messageElement.dataset.messageId = data.messageId;
        messageElement.setAttribute('role', 'article');
        messageElement.setAttribute('aria-label', `Received forward: ${data.content}`);
        
        const time = this.getFormattedTime(data.timestamp);
        const forwardedTime = this.getFormattedTime(data.forwardedMessage.timestamp);
        
        messageElement.innerHTML = `
            <div class="quoted-message">
                <div class="quoted-message-header">
                    <span>Forwarded message from ${forwardedTime}</span>
                </div>
                <div>${this.truncateText(data.forwardedMessage.content, 100)}</div>
            </div>
            <div class="message-content">${this.escapeHtml(data.content)}</div>
            <div class="message-time">${time}</div>
        `;

        // Enhance the new message element
        setTimeout(() => {
            this.enhanceMessageElement(messageElement);
        }, 100);

        return messageElement;
    }

    // Enhanced feature implementations
    async setupGestureIntegration() {
        console.log('👆 Setting up gesture integration...');
        
        if (!this.gestureIntegration) return;
        
        // Hook into existing gesture manager for swipe-to-reply
        if (window.gestureManager || window.cipherWaveAdvanced?.gestureManager) {
            const gestureManager = window.gestureManager || window.cipherWaveAdvanced.gestureManager;
            
            // Enhance swipe-to-reply functionality
            this.enhanceSwipeToReply(gestureManager);
        }
        
        // Setup additional gesture handling
        this.setupMessageGestureHandling();
        
        console.log('✅ Gesture integration ready');
    }

    enhanceSwipeToReply(gestureManager) {
        // This integrates with the existing gesture system
        // The swipe-to-reply is already implemented in advanced-features.js
        console.log('🔄 Enhanced swipe-to-reply integration active');
    }

    setupMessageGestureHandling() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;

        // Add enhanced gesture handling for individual messages
        messagesContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const messageElement = e.target.closest('.message');
                if (messageElement) {
                    this.handleMessageTouchStart(e, messageElement);
                }
            }
        }, { passive: true });
    }

    setupMessageGestures(messageElement) {
        if (!messageElement || messageElement.dataset.gesturesSetup === 'true') return;
        
        messageElement.dataset.gesturesSetup = 'true';
        
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let longPressTimer = null;
        
        const handleTouchStart = (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
                
                // Setup long press for selection
                longPressTimer = setTimeout(() => {
                    if (!this.selectionMode) {
                        this.toggleMessageSelection(messageElement);
                        this.triggerHaptic('medium');
                    }
                }, 500);
            }
        };
        
        const handleTouchMove = (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };
        
        const handleTouchEnd = (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            if (e.changedTouches.length === 1) {
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const touchDuration = Date.now() - touchStartTime;
                
                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;
                
                // Check for swipe gestures
                if (touchDuration < 300 && Math.abs(deltaX) > 50 && Math.abs(deltaY) < 30) {
                    if (deltaX > 0) {
                        // Swipe right - reply
                        this.initReply(messageElement);
                        this.triggerHaptic('light');
                    }
                }
            }
        };
        
        messageElement.addEventListener('touchstart', handleTouchStart, { passive: true });
        messageElement.addEventListener('touchmove', handleTouchMove, { passive: true });
        messageElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    handleMessageTouchStart(e, messageElement) {
        // Enhanced touch handling for messages
        this.lastTouchedMessage = messageElement;
    }

    async setupAccessibilityFeatures() {
        console.log('♿ Setting up accessibility features...');
        
        // Enhanced screen reader support
        this.setupScreenReaderSupport();
        
        // Keyboard navigation
        this.setupKeyboardNavigation();
        
        // High contrast support
        this.setupHighContrastSupport();
        
        // Focus management
        this.setupFocusManagement();
        
        console.log('✅ Accessibility features ready');
    }

    setupScreenReaderSupport() {
        // Add aria-live regions for dynamic content
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.setAttribute('aria-live', 'polite');
            messagesContainer.setAttribute('aria-label', 'Chat messages');
        }
        
        // Add status announcements
        this.addAriaStatus();
    }

    addAriaStatus() {
        if (document.getElementById('thread-aria-status')) return;
        
        const statusElement = document.createElement('div');
        statusElement.id = 'thread-aria-status';
        statusElement.setAttribute('aria-live', 'assertive');
        statusElement.setAttribute('aria-atomic', 'true');
        statusElement.className = 'visually-hidden';
        document.body.appendChild(statusElement);
        
        this.ariaStatus = statusElement;
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeydown(e);
        });
    }

    handleGlobalKeydown(e) {
        // Global keyboard shortcuts for threading
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'r':
                    // Ctrl/Cmd + R - Reply to last message
                    e.preventDefault();
                    this.replyToLastMessage();
                    break;
                case 'f':
                    // Ctrl/Cmd + F - Forward last message
                    e.preventDefault();
                    this.forwardLastMessage();
                    break;
                case 'a':
                    // Ctrl/Cmd + A - Select all messages (in selection mode)
                    if (this.selectionMode) {
                        e.preventDefault();
                        this.selectAllMessages();
                    }
                    break;
            }
        } else {
            switch (e.key) {
                case 'Escape':
                    // Escape - Cancel current action
                    if (this.isReplying) {
                        this.cancelReply();
                    } else if (this.forwardingMessage) {
                        this.cancelForward();
                    } else if (this.selectionMode) {
                        this.exitSelectionMode();
                    }
                    break;
            }
        }
    }

    setupThreadKeyboardNavigation() {
        // Add keyboard navigation within threads
        document.addEventListener('keydown', (e) => {
            if (this.isThreadModalOpen && e.key === 'Tab') {
                this.handleThreadTabNavigation(e);
            }
        });
    }

    handleThreadTabNavigation(e) {
        // Custom tab navigation within thread modal
        if (!this.threadModal) return;
        
        const focusableElements = this.threadModal.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }

    setupHighContrastSupport() {
        // Detect high contrast mode preference
        if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
            document.body.classList.add('high-contrast');
        }
    }

    setupFocusManagement() {
        // Enhanced focus management for thread interactions
        this.focusHistory = [];
    }

    async setupMobileOptimizations() {
        console.log('📱 Setting up mobile optimizations...');
        
        // Touch-friendly interactions
        this.setupTouchOptimizations();
        
        // Viewport handling
        this.setupViewportOptimizations();
        
        // Performance optimizations
        this.setupMobilePerformance();
        
        console.log('✅ Mobile optimizations ready');
    }

    setupTouchOptimizations() {
        // Increase touch targets for mobile
        if (window.innerWidth <= 768) {
            document.body.classList.add('mobile-optimized');
        }
        
        // Handle viewport changes
        window.addEventListener('resize', () => {
            const isMobile = window.innerWidth <= 768;
            document.body.classList.toggle('mobile-optimized', isMobile);
        });
    }

    setupViewportOptimizations() {
        // Handle dynamic viewport height on mobile
        const setVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        
        setVH();
        window.addEventListener('resize', setVH);
        window.addEventListener('orientationchange', () => {
            setTimeout(setVH, 100);
        });
    }

    setupMobilePerformance() {
        // Optimize for mobile performance
        if ('IntersectionObserver' in window) {
            this.setupIntersectionObserver();
        }
        
        // Debounce scroll events
        this.setupScrollOptimization();
    }

    setupIntersectionObserver() {
        const options = {
            root: document.querySelector('.messages-container'),
            rootMargin: '50px',
            threshold: 0.1
        };
        
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Lazy load thread indicators
                    this.lazyLoadThreadIndicator(entry.target);
                }
            });
        }, options);
    }

    lazyLoadThreadIndicator(messageElement) {
        const messageId = this.getMessageId(messageElement);
        if (this.threads.has(messageId)) {
            const thread = this.threads.get(messageId);
            this.addThreadIndicator(messageElement, thread.replies.length);
        }
    }

    setupScrollOptimization() {
        let scrollTimeout = null;
        const messagesContainer = document.querySelector('.messages-container');
        
        if (messagesContainer) {
            messagesContainer.addEventListener('scroll', () => {
                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                }
                
                scrollTimeout = setTimeout(() => {
                    this.handleScrollEnd();
                }, 150);
            }, { passive: true });
        }
    }

    handleScrollEnd() {
        // Optimize performance after scroll ends
        this.updateVisibleThreadIndicators();
    }

    updateVisibleThreadIndicators() {
        const messagesContainer = document.querySelector('.messages-container');
        if (!messagesContainer) return;
        
        const containerRect = messagesContainer.getBoundingClientRect();
        const messages = messagesContainer.querySelectorAll('.message');
        
        messages.forEach(message => {
            const messageRect = message.getBoundingClientRect();
            const isVisible = messageRect.top >= containerRect.top && 
                             messageRect.bottom <= containerRect.bottom;
            
            if (isVisible) {
                const messageId = this.getMessageId(message);
                if (this.threads.has(messageId) && !message.querySelector('.thread-count')) {
                    const thread = this.threads.get(messageId);
                    this.addThreadIndicator(message, thread.replies.length);
                }
            }
        });
    }

    async setupPerformanceOptimizations() {
        console.log('⚡ Setting up performance optimizations...');
        
        // Virtualization for large thread views
        this.setupVirtualization();
        
        // Memory management
        this.setupMemoryManagement();
        
        // Efficient event handling
        this.setupEfficientEvents();
        
        console.log('✅ Performance optimizations ready');
    }

    setupVirtualization() {
        // Virtual scrolling for large threads
        this.virtualizedThreads = new Map();
        this.visibleThreadRange = { start: 0, end: 50 };
    }

    setupMemoryManagement() {
        // Clean up old thread data periodically  
        setInterval(() => {
            this.cleanupOldThreads();
        }, 300000); // Every 5 minutes
    }

    cleanupOldThreads() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        this.threads.forEach((thread, threadId) => {
            if (now - thread.created > maxAge && thread.replies.length === 0) {
                this.threads.delete(threadId);
                this.threadDepthMap.delete(threadId);
                this.messageThreads.delete(threadId);
            }
        });
    }

    setupEfficientEvents() {
        // Use event delegation for better performance
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.addEventListener('click', (e) => {
                this.handleDelegatedClick(e);
            });
        }
    }

    handleDelegatedClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const messageElement = target.closest('.message');
        
        if (!messageElement) return;
        
        switch (action) {
            case 'reply':
                this.initReply(messageElement);
                break;
            case 'forward':
                this.initForward(messageElement);
                break;
            case 'select':
                this.toggleMessageSelection(messageElement);
                break;
            case 'thread':
                this.showThreadModal(messageElement);
                break;
        }
        
        this.triggerHaptic('light');
    }

    async setupThreadVisualization() {
        console.log('🎨 Setting up thread visualization...');
        
        // Thread depth indicators
        this.setupDepthIndicators();
        
        // Connection lines
        this.setupConnectionLines();
        
        // Collapse/expand functionality
        this.setupCollapseExpand();
        
        console.log('✅ Thread visualization ready');
    }

    setupDepthIndicators() {
        // Add visual depth indicators for threaded messages
        this.updateThreadDepthIndicators();
    }

    updateThreadDepthIndicators() {
        this.threadDepthMap.forEach((depth, messageId) => {
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement && depth > 0) {
                messageElement.classList.add(`thread-depth-${Math.min(depth, 3)}`);
                messageElement.style.setProperty('--thread-depth', depth);
            }
        });
    }

    setupConnectionLines() {
        if (!this.threadVisualization.showConnectors) return;
        
        // Add visual connection lines between threaded messages
        this.drawThreadConnections();
    }

    drawThreadConnections() {
        // Implementation for drawing connection lines between threaded messages
        // This would use CSS pseudo-elements or canvas drawing
    }

    setupCollapseExpand() {
        // Add collapse/expand functionality for deep threads
        this.addCollapseButtons();
    }

    addCollapseButtons() {
        this.threads.forEach((thread, parentId) => {
            if (thread.replies.length > 2) {
                const parentElement = document.querySelector(`[data-message-id="${parentId}"]`);
                if (parentElement) {
                    this.addCollapseButton(parentElement, thread);
                }
            }
        });
    }

    addCollapseButton(messageElement, thread) {
        if (messageElement.querySelector('.thread-collapse-btn')) return;
        
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'thread-collapse-btn';
        collapseBtn.innerHTML = '<i class="fas fa-chevron-down" aria-hidden="true"></i>';
        collapseBtn.title = 'Collapse thread';
        collapseBtn.setAttribute('aria-label', 'Collapse thread');
        
        collapseBtn.addEventListener('click', () => {
            this.toggleThreadCollapse(messageElement, thread);
        });
        
        messageElement.appendChild(collapseBtn);
    }

    toggleThreadCollapse(messageElement, thread) {
        const isCollapsed = messageElement.classList.contains('thread-collapsed');
        
        if (isCollapsed) {
            messageElement.classList.remove('thread-collapsed');
            this.showThreadReplies(thread);
            this.announceToScreenReader('Thread expanded');
        } else {
            messageElement.classList.add('thread-collapsed');
            this.hideThreadReplies(thread);
            this.announceToScreenReader('Thread collapsed');
        }
        
        this.triggerHaptic('light');
    }

    showThreadReplies(thread) {
        thread.replies.forEach(reply => {
            const replyElement = document.querySelector(`[data-message-id="${reply.messageId}"]`);
            if (replyElement) {
                replyElement.style.display = 'flex';
            }
        });
    }

    hideThreadReplies(thread) {
        thread.replies.forEach(reply => {
            const replyElement = document.querySelector(`[data-message-id="${reply.messageId}"]`);
            if (replyElement) {
                replyElement.style.display = 'none';
            }
        });
    }

    updateThreadVisualization() {
        if (this.threadVisualization.showDepthIndicators) {
            this.updateThreadDepthIndicators();
        }
        
        if (this.threadVisualization.showConnectors) {
            this.drawThreadConnections();
        }
    }

    async setupKeyboardShortcuts() {
        console.log('⌨️ Setting up keyboard shortcuts...');
        
        // Add keyboard shortcuts for threading actions
        this.keyboardShortcuts = new Map([
            ['ctrl+r', () => this.replyToLastMessage()],
            ['ctrl+f', () => this.forwardLastMessage()],
            ['ctrl+a', () => this.selectAllMessages()],
            ['escape', () => this.handleEscapeAction()],
            ['delete', () => this.deleteSelectedMessages()],
            ['ctrl+c', () => this.copySelectedMessages()]
        ]);
        
        console.log('✅ Keyboard shortcuts ready');
    }

    replyToLastMessage() {
        const messages = document.querySelectorAll('.message');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            this.initReply(lastMessage);
        }
    }

    forwardLastMessage() {
        const messages = document.querySelectorAll('.message');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            this.initForward(lastMessage);
        }
    }

    selectAllMessages() {
        if (!this.selectionMode) {
            this.enterSelectionMode();
        }
        
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            const messageId = this.getMessageId(message);
            if (!this.selectedMessages.has(messageId)) {
                this.selectedMessages.add(messageId);
                message.classList.add('selected');
                
                const checkbox = message.querySelector('.message-checkbox');
                if (checkbox) {
                    checkbox.classList.add('checked');
                    checkbox.setAttribute('aria-checked', 'true');
                    const checkIcon = checkbox.querySelector('i');
                    if (checkIcon) checkIcon.style.display = 'block';
                }
            }
        });
        
        this.updateSelectionCount();
        this.announceToScreenReader(`${messages.length} messages selected`);
    }

    handleEscapeAction() {
        if (this.isThreadModalOpen) {
            this.closeThreadModal();
        } else if (this.isReplying) {
            this.cancelReply();
        } else if (this.forwardingMessage) {
            this.cancelForward();
        } else if (this.selectionMode) {
            this.exitSelectionMode();
        }
    }

    createContextMenus() {
        // Create context menus for enhanced message interactions
        // This would integrate with the existing context menu system
    }

    enhanceMessageAccessibility(messageElement) {
        // Add comprehensive accessibility attributes
        const messageContent = messageElement.querySelector('.message-content')?.textContent || '';
        const messageTime = messageElement.querySelector('.message-time')?.textContent || '';
        const messageType = messageElement.classList.contains('sent') ? 'sent' : 'received';
        
        messageElement.setAttribute('role', 'article');
        messageElement.setAttribute('tabindex', '0');
        messageElement.setAttribute('aria-label', 
            `${messageType === 'sent' ? 'Your' : 'Peer'} message at ${messageTime}: ${messageContent}`
        );
        
        // Add thread context if applicable
        const messageId = this.getMessageId(messageElement);
        const threadDepth = this.getThreadDepth(messageId);
        if (threadDepth > 0) {
            const currentLabel = messageElement.getAttribute('aria-label');
            messageElement.setAttribute('aria-label', 
                `${currentLabel} (Thread reply, depth ${threadDepth})`
            );
        }
    }

    optimizeMessageElement(messageElement) {
        // Add performance optimizations to message elements
        messageElement.style.containIntrinsicSize = 'none';
        messageElement.style.contentVisibility = 'auto';
    }

    addTouchFeedback(element) {
        if (!element) return;
        
        element.addEventListener('touchstart', () => {
            element.classList.add('touch-feedback');
        }, { passive: true });
        
        element.addEventListener('touchend', () => {
            setTimeout(() => {
                element.classList.remove('touch-feedback');
            }, 150);
        }, { passive: true });
        
        element.addEventListener('touchcancel', () => {
            element.classList.remove('touch-feedback');
        }, { passive: true });
    }

    addThreadIndicators(messageElement) {
        const messageId = this.getMessageId(messageElement);
        
        // Add thread depth indicator
        const depth = this.getThreadDepth(messageId);
        if (depth > 0) {
            messageElement.classList.add(`thread-depth-${Math.min(depth, 3)}`);
            
            // Add visual thread indicator
            if (!messageElement.querySelector('.thread-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'thread-indicator';
                indicator.setAttribute('aria-hidden', 'true');
                messageElement.appendChild(indicator);
            }
        }
        
        // Add thread count if message has replies
        if (this.threads.has(messageId)) {
            const thread = this.threads.get(messageId);
            if (thread.replies.length > 0) {
                this.addThreadIndicator(messageElement, thread.replies.length);
            }
        }
    }

    // Utility methods
    getMessageId(messageElement) {
        return messageElement.dataset.messageId || 
               messageElement.getAttribute('data-message-id') ||
               this.generateMessageId();
    }

    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getMessageTimestamp(messageElement) {
        // Try to get timestamp from data attribute first
        const timestamp = messageElement.dataset.timestamp;
        if (timestamp) {
            return parseInt(timestamp);
        }
        
        // Fallback to parsing time text
        const timeElement = messageElement.querySelector('.message-time');
        if (timeElement) {
            const timeText = timeElement.textContent;
            // Simple parsing - in a real app, this would be more robust
            const now = new Date();
            return now.getTime();
        }
        
        return Date.now();
    }

    getThreadDepth(messageId) {
        return this.threadDepthMap.get(messageId) || 0;
    }

    updateThreadReferences(deletedMessageId) {
        // Remove references to deleted message from thread structures
        this.messageThreads.delete(deletedMessageId);
        this.threadDepthMap.delete(deletedMessageId);
        
        // Remove from thread replies
        this.threads.forEach((thread, parentId) => {
            thread.replies = thread.replies.filter(reply => reply.messageId !== deletedMessageId);
            
            // Update thread indicator if replies changed
            if (thread.replies.length === 0) {
                this.threads.delete(parentId);
                const parentElement = document.querySelector(`[data-message-id="${parentId}"]`);
                if (parentElement) {
                    const threadIndicator = parentElement.querySelector('.thread-count');
                    if (threadIndicator) threadIndicator.remove();
                }
            } else {
                const parentElement = document.querySelector(`[data-message-id="${parentId}"]`);
                if (parentElement) {
                    this.addThreadIndicator(parentElement, thread.replies.length);
                }
            }
        });
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getFormattedTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) { // Less than 1 minute
            return 'just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        } else { // More than 1 day
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }
    }

    triggerHaptic(intensity = 'light') {
        if (!this.hapticEnabled || !navigator.vibrate) return;
        
        const patterns = {
            light: [10],
            medium: [50],
            heavy: [100],
            success: [10, 50, 10],
            error: [100, 50, 100]
        };
        
        navigator.vibrate(patterns[intensity] || patterns.light);
    }

    announceToScreenReader(message) {
        // Clear previous announcement timeout
        if (this.announcementTimeout) {
            clearTimeout(this.announcementTimeout);
        }
        
        // Update aria-live region
        if (this.ariaStatus) {
            this.ariaStatus.textContent = message;
        } else {
            // Fallback method
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'visually-hidden';
            announcement.textContent = message;
            document.body.appendChild(announcement);
            
            this.announcementTimeout = setTimeout(() => {
                if (announcement.parentNode) {
                    announcement.parentNode.removeChild(announcement);
                }
            }, 1000);
        }
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-triangle'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type] || icons.info}" aria-hidden="true"></i>
            </div>
            <div class="toast-message">${message}</div>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    showNotification(title, body) {
        // Show browser notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: '/cipherwave.png',
                badge: '/cipherwave.png',
                tag: 'cipherwave-message'
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            // Auto-close after 5 seconds
            setTimeout(() => {
                notification.close();
            }, 5000);
        }
    }

    // Analytics and tracking methods
    trackReplyAction(action, messageId = null) {
        console.log(`Reply action: ${action}`, messageId);
        // In a real implementation, this would send analytics data
    }

    trackForwardAction(action, messageId = null) {
        console.log(`Forward action: ${action}`, messageId);
        // In a real implementation, this would send analytics data
    }

    trackSelectionAction(action, messageId = null, count = null) {
        console.log(`Selection action: ${action}`, messageId, count);
        // In a real implementation, this would send analytics data
    }

    trackThreadAction(action, threadId = null) {
        console.log(`Thread action: ${action}`, threadId);
        // In a real implementation, this would send analytics data
    }

    // Public API methods
    isReplyMode() {
        return this.isReplying;
    }

    isForwardMode() {
        return !!this.forwardingMessage;
    }

    isSelectionMode() {
        return this.selectionMode;
    }

    getSelectedMessages() {
        return Array.from(this.selectedMessages);
    }

    getThread(messageId) {
        return this.threads.get(messageId);
    }

    getAllThreads() {
        return new Map(this.threads);
    }

    getThreadDepthForMessage(messageId) {
        return this.getThreadDepth(messageId);
    }

    setThreadVisualizationOptions(options) {
        this.threadVisualization = { ...this.threadVisualization, ...options };
        this.updateThreadVisualization();
    }

    enableFeature(featureName) {
        switch (featureName) {
            case 'swipeReply':
                this.swipeReplyEnabled = true;
                break;
            case 'gestureIntegration':
                this.gestureIntegration = true;
                break;
            case 'hapticFeedback':
                this.hapticEnabled = true;
                break;
        }
    }

    disableFeature(featureName) {
        switch (featureName) {
            case 'swipeReply':
                this.swipeReplyEnabled = false;
                break;
            case 'gestureIntegration':
                this.gestureIntegration = false;
                break;
            case 'hapticFeedback':
                this.hapticEnabled = false;
                break;
        }
    }

    // Cleanup method
    destroy() {
        // Cleanup observers and event listeners
        if (this.messageObserver) {
            this.messageObserver.disconnect();
        }
        
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        // Remove global event listeners
        document.removeEventListener('keydown', this.handleGlobalKeydown);
        
        // Clear timeouts and intervals
        if (this.announcementTimeout) {
            clearTimeout(this.announcementTimeout);
        }
        
        // Remove UI elements
        if (this.selectionBar && this.selectionBar.parentNode) {
            this.selectionBar.parentNode.removeChild(this.selectionBar);
        }
        
        if (this.threadModal && this.threadModal.parentNode) {
            this.threadModal.parentNode.removeChild(this.threadModal);
        }
        
        if (this.ariaStatus && this.ariaStatus.parentNode) {
            this.ariaStatus.parentNode.removeChild(this.ariaStatus);
        }
        
        // Clear data structures
        this.threads.clear();
        this.messageThreads.clear();
        this.threadDepthMap.clear();
        this.selectedMessages.clear();
        this.virtualizedThreads.clear();
        
        console.log('🧹 ThreadManager cleanup completed');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ThreadManager = ThreadManager;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreadManager;
}