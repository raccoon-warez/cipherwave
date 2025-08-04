// CipherWave UI Manager - Lightweight core UI management
// Heavy UI components (file-manager, voice-manager) are dynamically loaded

export class UIManager {
    constructor() {
        this.eventHandlers = new Map();
        this.elements = {};
        this.isInitialized = false;
        this.currentTheme = 'dark';
        
        // UI state
        this.connectionStatus = 'disconnected';
        this.currentRoom = null;
        
        console.log('🎨 UI manager initialized');
    }
    
    // Event system
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }
    
    // Initialize UI elements and event listeners
    async initialize() {
        console.log('🎨 Initializing UI...');
        
        try {
            // Cache DOM elements
            this.cacheElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize UI state
            this.initializeUIState();
            
            // Set up responsive design
            this.setupResponsiveDesign();
            
            this.isInitialized = true;
            console.log('✅ UI initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize UI:', error);
            throw error;
        }
    }
    
    // Cache frequently used DOM elements
    cacheElements() {
        this.elements = {
            // Mode selection
            modeSelection: document.getElementById('mode-selection'),
            hostNodeBtn: document.getElementById('host-node-btn'),
            joinNetworkBtn: document.getElementById('join-network-btn'),
            
            // Connection panel
            connectionPanel: document.getElementById('connection-panel'),
            roomInput: document.getElementById('room-id'),
            generateRoomBtn: document.getElementById('generate-room'),
            cipherSelect: document.getElementById('cipher-select'),
            connectBtn: document.getElementById('connect-btn'),
            disconnectBtn: document.getElementById('disconnect-btn'),
            connectionStatus: document.getElementById('connection-status'),
            
            // Chat panel
            chatPanel: document.getElementById('chat-panel'),
            messagesContainer: document.getElementById('messages'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            
            // Debug panel
            debugLogs: document.getElementById('debug-logs'),
            clearLogsBtn: document.getElementById('clear-logs-btn'),
            runDebugBtn: document.getElementById('run-debug-btn'),
            
            // User info
            userIdDisplay: document.getElementById('user-id-display'),
            peerStatus: document.getElementById('peer-status')
        };
        
        // Validate required elements
        const requiredElements = ['connectBtn', 'disconnectBtn', 'messageInput', 'sendBtn'];
        for (const elementId of requiredElements) {
            if (!this.elements[elementId]) {
                throw new Error(`Required UI element not found: ${elementId}`);
            }
        }
    }
    
    // Set up event listeners for UI interactions
    setupEventListeners() {
        // Connection buttons
        if (this.elements.connectBtn) {
            this.elements.connectBtn.addEventListener('click', () => {
                const roomId = this.elements.roomInput?.value.trim();
                const cipher = this.elements.cipherSelect?.value || 'chacha20-poly1305';
                
                if (!roomId) {
                    this.showError('Please enter a room ID');
                    return;
                }
                
                this.emit('connect', roomId, cipher);
            });
        }
        
        if (this.elements.disconnectBtn) {
            this.elements.disconnectBtn.addEventListener('click', () => {
                this.emit('disconnect');
            });
        }
        
        // Generate room ID
        if (this.elements.generateRoomBtn) {
            this.elements.generateRoomBtn.addEventListener('click', () => {
                const roomId = this.generateRoomId();
                if (this.elements.roomInput) {
                    this.elements.roomInput.value = roomId;
                }
            });
        }
        
        // Message sending
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }
        
        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // Auto-resize textarea
            this.elements.messageInput.addEventListener('input', () => {
                this.autoResizeTextarea(this.elements.messageInput);
            });
        }
        
        // Debug controls
        if (this.elements.clearLogsBtn) {
            this.elements.clearLogsBtn.addEventListener('click', () => {
                this.clearDebugLogs();
            });
        }
        
        if (this.elements.runDebugBtn) {
            this.elements.runDebugBtn.addEventListener('click', () => {
                this.runDebugDiagnostics();
            });
        }
        
        // Advanced feature buttons (dynamically loaded)
        this.setupAdvancedFeatureButtons();
    }
    
    // Set up buttons for dynamically loaded features
    setupAdvancedFeatureButtons() {
        // File sharing button
        const fileBtn = document.querySelector('[data-feature="file-sharing"]');
        if (fileBtn) {
            fileBtn.addEventListener('click', () => {
                this.emit('loadFileManager');
            });
        }
        
        // Voice message button
        const voiceBtn = document.querySelector('[data-feature="voice-messages"]');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                this.emit('loadVoiceManager');
            });
        }
    }
    
    // Initialize UI state
    initializeUIState() {
        this.updateConnectionStatus('disconnected');
        this.generateRandomRoomId();
        
        // Set default cipher
        if (this.elements.cipherSelect) {
            this.elements.cipherSelect.value = 'chacha20-poly1305';
        }
        
        // Focus room input
        if (this.elements.roomInput) {
            this.elements.roomInput.focus();
        }
    }
    
    // Set up responsive design handlers
    setupResponsiveDesign() {
        // Handle viewport changes
        window.addEventListener('resize', () => {
            this.handleViewportChange();
        });
        
        // Handle orientation changes on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleViewportChange(), 100);
        });
        
        // Initial viewport setup
        this.handleViewportChange();
    }
    
    // Handle viewport changes
    handleViewportChange() {
        const isMobile = window.innerWidth <= 768;
        document.body.classList.toggle('mobile', isMobile);
    }
    
    // Send message through the input field
    sendMessage() {
        const messageText = this.elements.messageInput?.value.trim();
        
        if (!messageText) {
            return;
        }
        
        if (messageText.length > 5000) {
            this.showError('Message too long (max 5000 characters)');
            return;
        }
        
        this.emit('sendMessage', messageText);
        
        // Clear input
        if (this.elements.messageInput) {
            this.elements.messageInput.value = '';
            this.autoResizeTextarea(this.elements.messageInput);
        }
    }
    
    // Update connection status display
    updateConnectionStatus(status) {
        this.connectionStatus = status;
        
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = this.getStatusText(status);
            this.elements.connectionStatus.className = `status status-${status}`;
        }
        
        // Update button states
        const isConnected = status === 'connected';
        const isConnecting = status === 'connecting';
        
        if (this.elements.connectBtn) {
            this.elements.connectBtn.disabled = isConnected || isConnecting;
            this.elements.connectBtn.textContent = isConnecting ? 'Connecting...' : 'Connect';
        }
        
        if (this.elements.disconnectBtn) {
            this.elements.disconnectBtn.disabled = !isConnected && !isConnecting;
        }
        
        if (this.elements.messageInput) {
            this.elements.messageInput.disabled = !isConnected;
        }
        
        if (this.elements.sendBtn) {
            this.elements.sendBtn.disabled = !isConnected;
        }
        
        // Show/hide chat panel
        if (this.elements.chatPanel) {
            this.elements.chatPanel.classList.toggle('hidden', !isConnected);
        }
    }
    
    // Get human-readable status text
    getStatusText(status) {
        const statusTexts = {
            disconnected: 'Disconnected',
            connecting: 'Connecting...',
            connected: 'Connected',
            error: 'Connection Error'
        };
        
        return statusTexts[status] || status;
    }
    
    // Display a message in the chat
    displayMessage(message) {
        if (!this.elements.messagesContainer) {
            return;
        }
        
        const messageElement = this.createMessageElement(message);
        this.elements.messagesContainer.appendChild(messageElement);
        
        // Auto-scroll to bottom
        this.scrollToBottom();
        
        // Remove encryption notice if this is the first message
        this.removeEncryptionNotice();
    }
    
    // Create message element
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender === 'self' ? 'message-sent' : 'message-received'}`;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(message.text)}</div>
                <div class="message-time">${timestamp}</div>
                ${message.encrypted ? '<div class="message-encrypted"><i class="fas fa-lock"></i></div>' : ''}
            </div>
        `;
        
        return messageDiv;
    }
    
    // Remove encryption notice from empty chat
    removeEncryptionNotice() {
        const notice = this.elements.messagesContainer?.querySelector('.encryption-notice');
        if (notice) {
            notice.remove();
        }
    }
    
    // Scroll messages container to bottom
    scrollToBottom() {
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }
    }
    
    // Show error message
    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${this.escapeHtml(message)}</span>
            <button class="error-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }
    
    // Show success message
    showSuccess(message) {
        // Create success notification
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${this.escapeHtml(message)}</span>
            <button class="success-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        document.body.appendChild(successDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.remove();
            }
        }, 3000);
    }
    
    // Generate random room ID
    generateRandomRoomId() {
        const roomId = this.generateRoomId();
        if (this.elements.roomInput) {
            this.elements.roomInput.value = roomId;
        }
    }
    
    // Generate room ID
    generateRoomId() {
        return Array.from(crypto.getRandomValues(new Uint8Array(8)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('').toUpperCase();
    }
    
    // Auto-resize textarea
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
    
    // Clear debug logs
    clearDebugLogs() {
        if (this.elements.debugLogs) {
            this.elements.debugLogs.textContent = 'CipherWave Debug Console - Ready';
        }
    }
    
    // Add debug log entry
    addDebugLog(message, type = 'info') {
        if (!this.elements.debugLogs) {
            return;
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        
        this.elements.debugLogs.textContent += '\n' + logEntry;
        this.elements.debugLogs.scrollTop = this.elements.debugLogs.scrollHeight;
    }
    
    // Run debug diagnostics
    runDebugDiagnostics() {
        this.addDebugLog('Running diagnostics...', 'info');
        
        // Check WebRTC support
        if (window.RTCPeerConnection) {
            this.addDebugLog('✅ WebRTC supported', 'success');
        } else {
            this.addDebugLog('❌ WebRTC not supported', 'error');
        }
        
        // Check crypto support
        if (window.crypto && window.crypto.getRandomValues) {
            this.addDebugLog('✅ Crypto API supported', 'success');
        } else {
            this.addDebugLog('❌ Crypto API not supported', 'error');
        }
        
        // Check WebSocket support
        if (window.WebSocket) {
            this.addDebugLog('✅ WebSocket supported', 'success');
        } else {
            this.addDebugLog('❌ WebSocket not supported', 'error');
        }
        
        this.addDebugLog('Diagnostics complete', 'info');
    }
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Get current UI state
    getState() {
        return {
            isInitialized: this.isInitialized,
            connectionStatus: this.connectionStatus,
            currentRoom: this.currentRoom,
            theme: this.currentTheme
        };
    }
    
    // Destroy UI manager
    destroy() {
        this.eventHandlers.clear();
        this.elements = {};
        this.isInitialized = false;
        console.log('🗑️ UI manager destroyed');
    }
}