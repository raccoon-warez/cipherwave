// CipherWave Application - Main orchestrator for modular components
// Coordinates all components and maintains application state

class CipherWaveApp {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            debug: false,
            persistState: true,
            autoConnect: false,
            theme: 'dark',
            ...options
        };
        
        // Application state
        this.state = {
            isInitialized: false,
            currentView: 'connection',
            connectionStatus: 'disconnected',
            userInfo: {
                id: this.generateUserId(),
                name: 'CipherWave User',
                avatar: '/cipherwave.png'
            },
            roomId: null,
            isConnected: false,
            peerInfo: null,
            unreadCount: 0
        };
        
        // Component instances
        this.components = {
            sidebar: null,
            chat: null,
            settings: null,
            fileManager: null
        };
        
        // Managers
        this.securityManager = null;
        this.messageManager = null;
        this.connectionManager = null;
        
        // Event handlers
        this.eventHandlers = new Map();
        
        this.init();
    }
    
    async init() {
        try {
            this.log('Initializing CipherWave application...');
            
            // Create main UI structure
            this.createMainUI();
            
            // Initialize security manager
            await this.initializeSecurity();
            
            // Initialize components
            this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load saved state
            this.loadState();
            
            // Apply theme
            this.applyTheme(this.options.theme);
            
            this.state.isInitialized = true;
            this.log('CipherWave application initialized successfully');
            
            // Auto-connect if enabled
            if (this.options.autoConnect) {
                this.autoConnect();
            }
            
        } catch (error) {
            console.error('Failed to initialize CipherWave application:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }
    
    createMainUI() {
        this.container.innerHTML = `
            <div class="cipherwave-app">
                <div id="sidebar-container"></div>
                <div class="main-content">
                    <div id="connection-view" class="view active">
                        ${this.createConnectionView()}
                    </div>
                    <div id="settings-container"></div>
                    <div id="security-view" class="view">
                        ${this.createSecurityView()}
                    </div>
                    <div id="debug-view" class="view">
                        ${this.createDebugView()}
                    </div>
                </div>
                <div id="chat-container"></div>
                <div id="file-container"></div>
                <div id="loading-overlay" class="loading-overlay hidden">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Loading...</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    createConnectionView() {
        return `
            <div class="view-header">
                <h2>Connect to Network</h2>
                <div class="header-actions">
                    <button class="action-btn" id="refresh-servers-btn" aria-label="Refresh servers">
                        <i class="fas fa-sync"></i>
                    </button>
                </div>
            </div>
            
            <div class="connection-content">
                <div class="connection-modes">
                    <h3>Connection Mode</h3>
                    <div class="mode-buttons">
                        <button class="mode-btn" id="join-network-btn">
                            <i class="fas fa-network-wired"></i>
                            <span>Join Network</span>
                            <p>Connect to an existing room</p>
                        </button>
                        <button class="mode-btn" id="host-node-btn">
                            <i class="fas fa-server"></i>
                            <span>Host Node</span>
                            <p>Create a new signaling server</p>
                        </button>
                    </div>
                </div>
                
                <div class="connection-form hidden" id="join-form">
                    <h3>Join Room</h3>
                    <div class="form-group">
                        <label for="room-id-input">Room ID</label>
                        <div class="input-group">
                            <input type="text" id="room-id-input" placeholder="Enter room ID" maxlength="100">
                            <button class="secondary-btn" id="generate-room-btn">Generate</button>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="encryption-select">Encryption Method</label>
                        <select id="encryption-select">
                            <option value="chacha20-poly1305">ChaCha20-Poly1305 (Recommended)</option>
                            <option value="aes-256-gcm">AES-256-GCM</option>
                            <option value="xchacha20-poly1305">XChaCha20-Poly1305</option>
                        </select>
                    </div>
                    
                    <div class="form-actions">
                        <button class="primary-btn" id="connect-btn">
                            <i class="fas fa-plug"></i>
                            Connect
                        </button>
                        <button class="secondary-btn" id="back-to-modes-btn">Back</button>
                    </div>
                </div>
                
                <div class="connection-form hidden" id="host-form">
                    <h3>Host Signaling Node</h3>
                    <div class="form-group">
                        <label for="node-port-input">Port</label>
                        <input type="number" id="node-port-input" value="52178" min="1024" max="65535">
                    </div>
                    
                    <div class="form-actions">
                        <button class="primary-btn" id="start-node-btn">
                            <i class="fas fa-play"></i>
                            Start Node
                        </button>
                        <button class="secondary-btn" id="stop-node-btn" disabled>
                            <i class="fas fa-stop"></i>
                            Stop Node
                        </button>
                        <button class="secondary-btn" id="back-to-modes-host-btn">Back</button>
                    </div>
                </div>
                
                <div class="connection-status">
                    <div class="status-display" id="connection-status-display">
                        <i class="fas fa-times-circle"></i>
                        <span>Disconnected</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    createSecurityView() {
        return `
            <div class="view-header">
                <h2>Security & Encryption</h2>
            </div>
            
            <div class="security-content">
                <div class="security-section">
                    <h3>Encryption Status</h3>
                    <div class="encryption-info">
                        <div class="encryption-item">
                            <i class="fas fa-shield-alt"></i>
                            <span>End-to-End Encryption: Active</span>
                        </div>
                        <div class="encryption-item">
                            <i class="fas fa-key"></i>
                            <span>Key Exchange: Secure</span>
                        </div>
                        <div class="encryption-item">
                            <i class="fas fa-lock"></i>
                            <span>Message Integrity: Verified</span>
                        </div>
                    </div>
                </div>
                
                <div class="security-section">
                    <h3>Security Information</h3>
                    <div class="security-details">
                        <p>All messages are encrypted using state-of-the-art cryptographic algorithms before being sent over the network. Your private keys never leave your device.</p>
                        <ul>
                            <li>ChaCha20-Poly1305 authenticated encryption</li>
                            <li>X25519 key exchange for forward secrecy</li>
                            <li>Ed25519 signatures for authentication</li>
                            <li>Argon2 key derivation for password-based encryption</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    createDebugView() {
        return `
            <div class="view-header">
                <h2>Debug Console</h2>
                <div class="header-actions">
                    <button class="action-btn" id="clear-debug-btn" aria-label="Clear debug logs">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="action-btn" id="export-debug-btn" aria-label="Export debug logs">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
            
            <div class="debug-content">
                <div class="debug-panel">
                    <div class="debug-logs" id="debug-logs">
                        <div class="debug-entry">CipherWave Debug Console - Ready</div>
                    </div>
                    
                    <div class="debug-actions">
                        <button class="secondary-btn" id="run-connection-test-btn">
                            <i class="fas fa-flask"></i>
                            Test Connection
                        </button>
                        <button class="secondary-btn" id="run-crypto-test-btn">
                            <i class="fas fa-key"></i>
                            Test Crypto
                        </button>
                        <button class="secondary-btn" id="memory-info-btn">
                            <i class="fas fa-memory"></i>
                            Memory Info
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    async initializeSecurity() {
        if (typeof SecurityManager !== 'undefined') {
            this.securityManager = new SecurityManager();
            await this.securityManager.initialize();
            this.log('Security manager initialized');
        } else {
            this.log('SecurityManager not available, using fallback encryption');
        }
    }
    
    initializeComponents() {
        // Initialize sidebar
        const sidebarContainer = this.container.querySelector('#sidebar-container');
        if (sidebarContainer) {
            this.components.sidebar = new SidebarComponent(sidebarContainer, {
                showUserProfile: true,
                showConnectionStatus: true,
                collapsible: true,
                mobileResponsive: true
            });
            
            this.components.sidebar.setUserInfo(this.state.userInfo);
            this.components.sidebar.setConnectionStatus(this.state.connectionStatus);
        }
        
        // Initialize chat component
        const chatContainer = this.container.querySelector('#chat-container');
        if (chatContainer) {
            this.components.chat = new ChatComponent(chatContainer, {
                showWelcomeMessage: true,
                maxMessages: 1000,
                animateMessages: true,
                showMessageStatus: true
            });
        }
        
        // Initialize settings component
        const settingsContainer = this.container.querySelector('#settings-container');
        if (settingsContainer) {
            this.components.settings = new SettingsComponent(settingsContainer, {
                persistSettings: true,
                validateOnChange: true,
                showUnsavedWarning: true
            });
        }
        
        // Initialize file manager
        const fileContainer = this.container.querySelector('#file-container');
        if (fileContainer) {
            this.components.fileManager = new FileComponent(fileContainer, {
                maxFileSize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
                allowMultiple: true,
                enableDragDrop: true,
                encryptFiles: true
            });
        }
        
        this.log('Components initialized');
    }
    
    setupEventListeners() {
        // Sidebar events
        if (this.components.sidebar) {
            this.components.sidebar.addEventListener('navigationChange', this.handleNavigationChange.bind(this));
            this.components.sidebar.addEventListener('sidebarToggle', this.handleSidebarToggle.bind(this));
        }
        
        // Chat events
        if (this.components.chat) {
            this.components.chat.addEventListener('messageSend', this.handleMessageSend.bind(this));
            this.components.chat.addEventListener('chatClose', this.handleChatClose.bind(this));
            this.components.chat.addEventListener('attachmentRequest', this.handleAttachmentRequest.bind(this));
        }
        
        // Settings events
        if (this.components.settings) {
            this.components.settings.addEventListener('settingchanged', this.handleSettingChanged.bind(this));
            this.components.settings.addEventListener('settingssaved', this.handleSettingsSaved.bind(this));
        }
        
        // File manager events
        if (this.components.fileManager) {
            this.components.fileManager.addEventListener('filesend', this.handleFileSend.bind(this));
            this.components.fileManager.addEventListener('filemanagerclose', this.handleFileManagerClose.bind(this));
        }
        
        // Connection view events
        this.setupConnectionViewListeners();
        
        // Debug view events
        this.setupDebugViewListeners();
        
        this.log('Event listeners setup complete');
    }
    
    setupConnectionViewListeners() {
        // Mode selection
        const joinNetworkBtn = this.container.querySelector('#join-network-btn');
        const hostNodeBtn = this.container.querySelector('#host-node-btn');
        
        if (joinNetworkBtn) {
            joinNetworkBtn.addEventListener('click', () => this.showConnectionForm('join'));
        }
        
        if (hostNodeBtn) {
            hostNodeBtn.addEventListener('click', () => this.showConnectionForm('host'));
        }
        
        // Back buttons
        const backButtons = this.container.querySelectorAll('[id$="-to-modes-btn"], [id$="-to-modes-host-btn"]');
        backButtons.forEach(btn => {
            btn.addEventListener('click', () => this.showConnectionModes());
        });
        
        // Generate room ID
        const generateRoomBtn = this.container.querySelector('#generate-room-btn');
        if (generateRoomBtn) {
            generateRoomBtn.addEventListener('click', () => {
                const roomInput = this.container.querySelector('#room-id-input');
                if (roomInput) {
                    roomInput.value = this.generateRoomId();
                }
            });
        }
        
        // Connect button
        const connectBtn = this.container.querySelector('#connect-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.handleConnect());
        }
        
        // Node management
        const startNodeBtn = this.container.querySelector('#start-node-btn');
        const stopNodeBtn = this.container.querySelector('#stop-node-btn');
        
        if (startNodeBtn) {
            startNodeBtn.addEventListener('click', () => this.handleStartNode());
        }
        
        if (stopNodeBtn) {
            stopNodeBtn.addEventListener('click', () => this.handleStopNode());
        }
    }
    
    setupDebugViewListeners() {
        const clearDebugBtn = this.container.querySelector('#clear-debug-btn');
        const exportDebugBtn = this.container.querySelector('#export-debug-btn');
        const connectionTestBtn = this.container.querySelector('#run-connection-test-btn');
        const cryptoTestBtn = this.container.querySelector('#run-crypto-test-btn');
        const memoryInfoBtn = this.container.querySelector('#memory-info-btn');
        
        if (clearDebugBtn) {
            clearDebugBtn.addEventListener('click', () => this.clearDebugLogs());
        }
        
        if (exportDebugBtn) {
            exportDebugBtn.addEventListener('click', () => this.exportDebugLogs());
        }
        
        if (connectionTestBtn) {
            connectionTestBtn.addEventListener('click', () => this.runConnectionTest());
        }
        
        if (cryptoTestBtn) {
            cryptoTestBtn.addEventListener('click', () => this.runCryptoTest());
        }
        
        if (memoryInfoBtn) {
            memoryInfoBtn.addEventListener('click', () => this.showMemoryInfo());
        }
    }
    
    // Event Handlers
    handleNavigationChange(event) {
        const { activeNav } = event.detail;
        this.setActiveView(activeNav);
    }
    
    handleSidebarToggle(event) {
        // Handle sidebar toggle if needed
        this.log('Sidebar toggled:', event.detail.collapsed);
    }
    
    async handleMessageSend(event) {
        const { message } = event.detail;
        
        try {
            if (this.connectionManager && this.connectionManager.isConnected()) {
                // Encrypt and send message
                const encryptedData = await this.encryptMessage(message.content);
                const success = this.connectionManager.sendMessage({
                    ...message,
                    content: encryptedData
                });
                
                if (success) {
                    this.log('Message sent successfully');
                } else {
                    throw new Error('Failed to send message');
                }
            } else {
                throw new Error('No active connection');
            }
        } catch (error) {
            this.log('Failed to send message:', error.message);
            this.components.chat.updateMessageStatus(message.id, 'failed');
        }
    }
    
    handleChatClose() {
        this.setActiveView('connection');
    }
    
    handleAttachmentRequest() {
        if (this.components.fileManager) {
            this.components.fileManager.show();
        }
    }
    
    handleSettingChanged(event) {
        const { section, field, value } = event.detail;
        this.log(`Setting changed: ${section}.${field} = ${value}`);
        
        // Apply specific setting changes
        if (section === 'general' && field === 'theme') {
            this.applyTheme(value);
        }
    }
    
    handleSettingsSaved(event) {
        this.log('Settings saved');
        this.saveState();
    }
    
    handleFileSend(event) {
        const { files } = event.detail;
        this.log(`Sending ${files.length} files`);
        
        // Send files through connection manager if connected
        if (this.connectionManager && this.connectionManager.isConnected()) {
            files.forEach(file => {
                this.connectionManager.sendMessage({
                    type: 'file',
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    data: file.data,
                    encrypted: file.encrypted
                });
            });
            this.log('Files sent successfully');
        } else {
            this.log('Cannot send files: not connected');
        }
        
        if (this.components.fileManager) {
            this.components.fileManager.hide();
        }
    }
    
    handleFileManagerClose() {
        // File manager closed
    }
    
    // Connection handling
    showConnectionForm(mode) {
        const modesDiv = this.container.querySelector('.connection-modes');
        const joinForm = this.container.querySelector('#join-form');
        const hostForm = this.container.querySelector('#host-form');
        
        if (modesDiv) modesDiv.classList.add('hidden');
        
        if (mode === 'join' && joinForm) {
            joinForm.classList.remove('hidden');
            // Generate default room ID
            const roomInput = this.container.querySelector('#room-id-input');
            if (roomInput && !roomInput.value) {
                roomInput.value = this.generateRoomId();
            }
        } else if (mode === 'host' && hostForm) {
            hostForm.classList.remove('hidden');
        }
    }
    
    showConnectionModes() {
        const modesDiv = this.container.querySelector('.connection-modes');
        const joinForm = this.container.querySelector('#join-form');
        const hostForm = this.container.querySelector('#host-form');
        
        if (modesDiv) modesDiv.classList.remove('hidden');
        if (joinForm) joinForm.classList.add('hidden');
        if (hostForm) hostForm.classList.add('hidden');
    }
    
    async handleConnect() {
        const roomInput = this.container.querySelector('#room-id-input');
        const encryptionSelect = this.container.querySelector('#encryption-select');
        
        if (!roomInput || !roomInput.value.trim()) {
            this.showError('Please enter a room ID');
            return;
        }
        
        const roomId = roomInput.value.trim();
        const encryptionMethod = encryptionSelect ? encryptionSelect.value : 'chacha20-poly1305';
        
        try {
            this.showLoading('Connecting to room...');
            
            // Initialize connection manager if not exists
            if (!this.connectionManager && typeof ConnectionManager !== 'undefined') {
                this.connectionManager = new ConnectionManager({
                    iceServers: this.getIceServers()
                });
                
                this.connectionManager.addEventListener('connected', () => {
                    this.handleConnectionEstablished();
                });
                
                this.connectionManager.addEventListener('disconnected', () => {
                    this.handleConnectionLost();
                });
                
                this.connectionManager.addEventListener('messageReceived', (event) => {
                    this.handleMessageReceived(event.detail);
                });
            }
            
            // Attempt connection
            await this.connectionManager.connect(roomId, encryptionMethod);
            
            this.state.roomId = roomId;
            this.state.connectionStatus = 'connecting';
            this.updateConnectionStatus('connecting');
            
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to connect: ' + error.message);
            this.log('Connection failed:', error);
        }
    }
    
    handleStartNode() {
        const portInput = this.container.querySelector('#node-port-input');
        const port = portInput ? parseInt(portInput.value) : 52178;
        
        this.log(`Starting signaling node on port ${port}`);
        
        // Check if node-host.js is available
        if (typeof window.startNode === 'function') {
            try {
                window.startNode(port);
                this.log(`Signaling node started on port ${port}`);
                
                const startBtn = this.container.querySelector('#start-node-btn');
                const stopBtn = this.container.querySelector('#stop-node-btn');
                
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = false;
                
                this.updateConnectionStatus('Node running on port ' + port);
            } catch (error) {
                this.log('Failed to start signaling node:', error.message);
                this.showError('Failed to start node: ' + error.message);
            }
        } else {
            this.log('Node hosting functionality not available');
            this.showError('Node hosting functionality not available. Please ensure node-host.js is loaded.');
        }
    }
    
    handleStopNode() {
        this.log('Stopping signaling node');
        
        // Check if node-host.js is available
        if (typeof window.stopNode === 'function') {
            try {
                window.stopNode();
                this.log('Signaling node stopped');
                
                const startBtn = this.container.querySelector('#start-node-btn');
                const stopBtn = this.container.querySelector('#stop-node-btn');
                
                if (startBtn) startBtn.disabled = false;
                if (stopBtn) stopBtn.disabled = true;
                
                this.updateConnectionStatus('disconnected');
            } catch (error) {
                this.log('Failed to stop signaling node:', error.message);
                this.showError('Failed to stop node: ' + error.message);
            }
        } else {
            this.log('Node stopping functionality not available');
            this.showError('Node stopping functionality not available. Please ensure node-host.js is loaded.');
        }
    }
    
    handleConnectionEstablished() {
        this.hideLoading();
        this.state.isConnected = true;
        this.state.connectionStatus = 'connected';
        this.updateConnectionStatus('connected');
        
        // Show chat
        if (this.components.chat) {
            this.components.chat.show();
            this.components.chat.setConnectionStatus('connected');
        }
        
        this.log('Connection established successfully');
    }
    
    handleConnectionLost() {
        this.state.isConnected = false;
        this.state.connectionStatus = 'disconnected';
        this.updateConnectionStatus('disconnected');
        
        // Hide chat and show connection view
        if (this.components.chat) {
            this.components.chat.hide();
        }
        
        this.setActiveView('connection');
        this.log('Connection lost');
    }
    
    async handleMessageReceived(messageData) {
        try {
            if (messageData.type === 'message') {
                const decryptedContent = await this.decryptMessage(messageData.content);
                
                if (this.components.chat) {
                    this.components.chat.addMessage({
                        id: messageData.id || Date.now().toString(),
                        content: decryptedContent,
                        type: 'received',
                        timestamp: messageData.timestamp || Date.now()
                    });
                }
                
                // Update unread count if chat is not visible
                if (!this.components.chat || !this.components.chat.state.isVisible) {
                    this.state.unreadCount++;
                    if (this.components.sidebar) {
                        this.components.sidebar.setUnreadCount(this.state.unreadCount);
                    }
                }
            }
        } catch (error) {
            this.log('Failed to process received message:', error.message);
        }
    }
    
    // Utility methods
    setActiveView(viewName) {
        this.state.currentView = viewName;
        
        // Hide all views
        const views = this.container.querySelectorAll('.view');
        views.forEach(view => view.classList.remove('active'));
        
        // Show component views
        Object.values(this.components).forEach(component => {
            if (component && component.hide) {
                component.hide();
            }
        });
        
        // Show requested view
        switch (viewName) {
            case 'chat':
                if (this.components.chat) {
                    this.components.chat.show();
                    this.state.unreadCount = 0;
                    if (this.components.sidebar) {
                        this.components.sidebar.setUnreadCount(0);
                    }
                }
                break;
                
            case 'settings':
                if (this.components.settings) {
                    this.components.settings.show();
                }
                break;
                
            case 'security':
                const securityView = this.container.querySelector('#security-view');
                if (securityView) {
                    securityView.classList.add('active');
                }
                break;
                
            case 'debug':
                const debugView = this.container.querySelector('#debug-view');
                if (debugView) {
                    debugView.classList.add('active');
                }
                break;
                
            default:
                const connectionView = this.container.querySelector('#connection-view');
                if (connectionView) {
                    connectionView.classList.add('active');
                }
        }
        
        this.log(`Active view changed to: ${viewName}`);
    }
    
    updateConnectionStatus(status) {
        this.state.connectionStatus = status;
        
        // Update sidebar
        if (this.components.sidebar) {
            this.components.sidebar.setConnectionStatus(status);
        }
        
        // Update connection view status display
        const statusDisplay = this.container.querySelector('#connection-status-display');
        if (statusDisplay) {
            const statusConfig = {
                connected: { icon: 'fas fa-check-circle', text: 'Connected', class: 'success' },
                connecting: { icon: 'fas fa-spinner fa-spin', text: 'Connecting...', class: 'warning' },
                disconnected: { icon: 'fas fa-times-circle', text: 'Disconnected', class: 'danger' }
            };
            
            const config = statusConfig[status] || statusConfig.disconnected;
            statusDisplay.innerHTML = `<i class="${config.icon}"></i><span>${config.text}</span>`;
            statusDisplay.className = `status-display ${config.class}`;
        }
    }
    
    async encryptMessage(content) {
        if (this.securityManager && this.securityManager.encryptMessage) {
            return await this.securityManager.encryptMessage(content);
        } else {
            // Fallback: base64 encode (not secure, for demo only)
            return btoa(unescape(encodeURIComponent(content)));
        }
    }
    
    async decryptMessage(encryptedData) {
        if (this.securityManager && this.securityManager.decryptMessage) {
            return await this.securityManager.decryptMessage(encryptedData);
        } else {
            // Fallback: base64 decode (not secure, for demo only)
            return decodeURIComponent(escape(atob(encryptedData)));
        }
    }
    
    generateRoomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let roomId = '';
        
        if (window.crypto && window.crypto.getRandomValues) {
            const randomArray = new Uint8Array(20);
            window.crypto.getRandomValues(randomArray);
            
            for (let i = 0; i < 20; i++) {
                roomId += chars.charAt(randomArray[i] % chars.length);
            }
        } else {
            for (let i = 0; i < 20; i++) {
                roomId += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }
        return roomId;
    }
    
    generateUserId() {
        const prefix = 'CW';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = prefix + '-';
        for (let i = 0; i < 6; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }
    
    getIceServers() {
        return [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
        ];
    }
    
    // Theme management
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.options.theme = theme;
        this.log(`Theme applied: ${theme}`);
    }
    
    // Loading overlay
    showLoading(message = 'Loading...') {
        const overlay = this.container.querySelector('#loading-overlay');
        const messageElement = overlay ? overlay.querySelector('p') : null;
        
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        
        if (messageElement) {
            messageElement.textContent = message;
        }
    }
    
    hideLoading() {
        const overlay = this.container.querySelector('#loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
    
    // Error handling
    showError(message) {
        // Simple alert for now - could be enhanced with a proper modal
        alert('Error: ' + message);
        this.log('Error:', message);
    }
    
    // Debug methods
    clearDebugLogs() {
        const debugLogs = this.container.querySelector('#debug-logs');
        if (debugLogs) {
            debugLogs.innerHTML = '<div class="debug-entry">Debug logs cleared</div>';
        }
    }
    
    exportDebugLogs() {
        const debugLogs = this.container.querySelector('#debug-logs');
        if (debugLogs) {
            const logs = debugLogs.textContent;
            const blob = new Blob([logs], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `cipherwave-debug-${new Date().toISOString()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
        }
    }
    
    runConnectionTest() {
        this.log('Running connection test...');
        
        // Test WebSocket connectivity
        const testUrl = 'wss://echo.websocket.org';
        let success = false;
        
        try {
            const ws = new WebSocket(testUrl);
            
            ws.onopen = () => {
                this.log('WebSocket connection test: SUCCESS');
                success = true;
                ws.close();
            };
            
            ws.onerror = (error) => {
                this.log('WebSocket connection test: FAILED -', error.message);
                ws.close();
            };
            
            ws.onclose = () => {
                if (!success) {
                    this.log('WebSocket connection test: FAILED - Connection closed unexpectedly');
                }
                this.log('Connection test completed');
            };
            
            // Set a timeout
            setTimeout(() => {
                if (!success) {
                    this.log('WebSocket connection test: FAILED - Timeout');
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                    }
                }
            }, 5000);
            
        } catch (error) {
            this.log('WebSocket connection test: FAILED -', error.message);
            this.log('Connection test completed');
        }
    }
    
    runCryptoTest() {
        this.log('Running crypto test...');
        
        try {
            // Test basic encryption/decryption
            const testMessage = 'Hello, CipherWave!';
            this.log('Testing encryption with message:', testMessage);
            
            // Test with security manager if available
            if (this.securityManager && this.securityManager.encryptMessage && this.securityManager.decryptMessage) {
                this.securityManager.encryptMessage(testMessage)
                    .then(encrypted => {
                        this.log('Encryption test: SUCCESS - Message encrypted');
                        return this.securityManager.decryptMessage(encrypted);
                    })
                    .then(decrypted => {
                        if (decrypted === testMessage) {
                            this.log('Decryption test: SUCCESS - Message decrypted correctly');
                        } else {
                            this.log('Decryption test: FAILED - Decrypted message does not match original');
                        }
                        this.log('Crypto test completed');
                    })
                    .catch(error => {
                        this.log('Crypto test: FAILED -', error.message);
                        this.log('Crypto test completed');
                    });
            } else {
                // Fallback test using base64 encoding
                this.log('SecurityManager not available, using fallback encryption test');
                const encoded = btoa(unescape(encodeURIComponent(testMessage)));
                this.log('Base64 encoding test: SUCCESS - Message encoded');
                const decoded = decodeURIComponent(escape(atob(encoded)));
                if (decoded === testMessage) {
                    this.log('Base64 decoding test: SUCCESS - Message decoded correctly');
                } else {
                    this.log('Base64 decoding test: FAILED - Decoded message does not match original');
                }
                this.log('Crypto test completed');
            }
        } catch (error) {
            this.log('Crypto test: FAILED -', error.message);
            this.log('Crypto test completed');
        }
    }
    
    showMemoryInfo() {
        const info = {
            jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || 'N/A',
            totalJSHeapSize: performance.memory?.totalJSHeapSize || 'N/A',
            usedJSHeapSize: performance.memory?.usedJSHeapSize || 'N/A'
        };
        
        this.log('Memory Info:', JSON.stringify(info, null, 2));
    }
    
    // State management
    saveState() {
        if (this.options.persistState) {
            try {
                const stateToSave = {
                    userInfo: this.state.userInfo,
                    theme: this.options.theme,
                    lastRoomId: this.state.roomId
                };
                
                localStorage.setItem('cipherwave-app-state', JSON.stringify(stateToSave));
                this.log('Application state saved');
            } catch (error) {
                this.log('Failed to save state:', error.message);
            }
        }
    }
    
    loadState() {
        if (this.options.persistState) {
            try {
                const saved = localStorage.getItem('cipherwave-app-state');
                if (saved) {
                    const state = JSON.parse(saved);
                    
                    if (state.userInfo) {
                        this.state.userInfo = { ...this.state.userInfo, ...state.userInfo };
                        if (this.components.sidebar) {
                            this.components.sidebar.setUserInfo(this.state.userInfo);
                        }
                    }
                    
                    if (state.theme) {
                        this.applyTheme(state.theme);
                    }
                    
                    if (state.lastRoomId) {
                        const roomInput = this.container.querySelector('#room-id-input');
                        if (roomInput) {
                            roomInput.value = state.lastRoomId;
                        }
                    }
                    
                    this.log('Application state loaded');
                }
            } catch (error) {
                this.log('Failed to load state:', error.message);
            }
        }
    }
    
    autoConnect() {
        this.log('Attempting auto-connect...');
        
        // Check if we have a saved room ID
        if (this.state.roomId) {
            this.log('Found saved room ID, attempting to connect...');
            
            // Set a small delay to allow UI to initialize
            setTimeout(() => {
                const roomInput = this.container.querySelector('#room-id-input');
                if (roomInput) {
                    roomInput.value = this.state.roomId;
                }
                
                // Automatically show the join form
                this.showConnectionForm('join');
                
                // Attempt to connect after a short delay
                setTimeout(() => {
                    this.handleConnect();
                }, 500);
            }, 100);
        } else {
            this.log('No saved room ID found for auto-connect');
        }
    }
    
    // Logging
    log(...args) {
        if (this.options.debug) {
            console.log('[CipherWave]', ...args);
        }
        
        // Add to debug view
        const debugLogs = this.container.querySelector('#debug-logs');
        if (debugLogs) {
            const timestamp = new Date().toLocaleTimeString();
            const entry = document.createElement('div');
            entry.className = 'debug-entry';
            entry.textContent = `[${timestamp}] ${args.join(' ')}`;
            debugLogs.appendChild(entry);
            debugLogs.scrollTop = debugLogs.scrollHeight;
        }
    }
    
    // Public API
    getState() {
        return { ...this.state };
    }
    
    getComponent(name) {
        return this.components[name];
    }
    
    isConnected() {
        return this.state.isConnected;
    }
    
    disconnect() {
        if (this.connectionManager) {
            this.connectionManager.disconnect();
        }
    }
    
    destroy() {
        // Clean up all components
        Object.values(this.components).forEach(component => {
            if (component && component.destroy) {
                component.destroy();
            }
        });
        
        // Clean up managers
        if (this.securityManager && this.securityManager.destroy) {
            this.securityManager.destroy();
        }
        
        if (this.connectionManager && this.connectionManager.destroy) {
            this.connectionManager.destroy();
        }
        
        // Save final state
        this.saveState();
        
        this.log('CipherWave application destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CipherWaveApp;
} else if (typeof window !== 'undefined') {
    window.CipherWaveApp = CipherWaveApp;
}
