// CipherWave - Enhanced Main Application with Authentication
// Integrates identity management, secure storage, and authenticated connections

import { AuthComponent } from './components/AuthComponent.js';
import { MessageManager } from './managers/message-manager.js';
import { AuthenticatedConnectionManager } from './managers/authenticated-connection-manager.js';
import { UIManager } from './managers/ui-manager.js';

// Enhanced application with authentication support
export class CipherWaveAuthApp {
    constructor() {
        // Authentication components
        this.authComponent = null;
        this.identityManager = null;
        this.storageManager = null;
        
        // Core managers
        this.messageManager = null;
        this.connectionManager = null;
        this.uiManager = null;
        
        // Lazy-loaded managers
        this.fileManager = null;
        this.voiceManager = null;
        this.performanceMonitor = null;
        
        // Application state
        this.isInitialized = false;
        this.isAuthenticated = false;
        this.currentRoom = null;
        this.isConnected = false;
        this.currentView = 'auth'; // auth, chat
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing CipherWave with Authentication...');
        
        try {
            // Initialize authentication UI first
            await this.initializeAuthentication();
            
            // Set up authentication event listeners
            this.setupAuthEventListeners();
            
            // Show authentication screen
            this.showAuthenticationScreen();
            
            this.isInitialized = true;
            console.log('✅ CipherWave Auth initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize CipherWave Auth:', error);
            this.handleInitializationError(error);
        }
    }
    
    async initializeAuthentication() {
        // Initialize authentication component
        this.authComponent = new AuthComponent();
        await this.authComponent.initialize();
    }
    
    setupAuthEventListeners() {
        // Authentication success - initialize chat components
        this.authComponent.on('auth:success', async (authData) => {
            this.identityManager = authData.identityManager;
            this.storageManager = authData.storageManager;
            this.isAuthenticated = true;
            
            // Initialize multi-device features
            await this.identityManager.initializeMultiDeviceFeatures(this.storageManager);
            
            await this.initializeChatComponents();
            this.showChatScreen();
        });
        
        // Authentication logout - return to auth screen
        this.authComponent.on('auth:logout', () => {
            this.cleanup();
            this.showAuthenticationScreen();
        });
        
        // Identity deleted - full cleanup
        this.authComponent.on('auth:deleted', () => {
            this.cleanup();
            this.showAuthenticationScreen();
        });
    }
    
    async initializeChatComponents() {
        console.log('🔐 Initializing chat components with authentication...');
        
        try {
            // Initialize authenticated connection manager
            this.connectionManager = new AuthenticatedConnectionManager(
                this.identityManager,
                this.storageManager,
                this.getWebRTCConfig()
            );
            
            // Initialize message manager with identity manager
            this.messageManager = new MessageManager(this.identityManager);
            
            // Initialize UI manager
            this.uiManager = new UIManager();
            await this.uiManager.initialize();
            
            // Set up chat event listeners
            this.setupChatEventListeners();
            
            console.log('✅ Chat components initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize chat components:', error);
            throw error;
        }
    }
    
    setupChatEventListeners() {
        // Connection events
        this.connectionManager.on('connected', () => {
            this.isConnected = true;
            this.uiManager.updateConnectionStatus('connected');
            
            // Process any offline messages
            this.connectionManager.processOfflineMessages();
        });
        
        this.connectionManager.on('disconnected', () => {
            this.isConnected = false;
            this.uiManager.updateConnectionStatus('disconnected');
        });
        
        // Authentication events
        this.connectionManager.on('auth:success', () => {
            this.uiManager.showNotification('Peer authenticated successfully', 'success');
            
            // Load conversation history
            this.loadConversationHistory();
        });
        
        this.connectionManager.on('auth:failed', (error) => {
            this.uiManager.showError('Peer authentication failed: ' + error);
        });
        
        // Message events
        this.connectionManager.on('messageReceived', (message) => {
            this.uiManager.displayMessage({
                ...message,
                encrypted: true
            });
        });
        
        this.connectionManager.on('messageError', (error) => {
            this.uiManager.showError('Message error: ' + error.message);
        });
        
        // UI events
        this.uiManager.on('connect', (roomId, cipher) => this.connect(roomId, cipher));
        this.uiManager.on('disconnect', () => this.disconnect());
        this.uiManager.on('sendMessage', (message) => this.sendMessage(message));
        this.uiManager.on('loadFileManager', () => this.loadFileManager());
        this.uiManager.on('loadVoiceManager', () => this.loadVoiceManager());
        this.uiManager.on('logout', () => this.handleLogout());
        
        // Error handling
        this.connectionManager.on('error', (error) => {
            console.error('Connection error:', error);
            this.uiManager.showError('Connection error: ' + error.message);
        });
    }
    
    showAuthenticationScreen() {
        this.currentView = 'auth';
        document.body.innerHTML = '<div id="auth-container"></div>';
        this.authComponent.mount('#auth-container');
    }
    
    showChatScreen() {
        this.currentView = 'chat';
        document.body.innerHTML = '<div id="chat-container"></div>';
        this.uiManager.mount('#chat-container');
        
        // Add user profile info to UI
        const userProfile = this.identityManager.getUserProfile();
        this.uiManager.setUserInfo(userProfile);
    }
    
    // Enhanced connection with authentication
    async connect(roomId, cipher = 'chacha20-poly1305') {
        if (!this.isAuthenticated) {
            throw new Error('User must be authenticated to connect');
        }
        
        try {
            this.currentRoom = roomId;
            this.uiManager.updateConnectionStatus('connecting');
            
            // Set encryption cipher
            await this.identityManager.setCipher(cipher);
            
            // Establish authenticated connection
            await this.connectionManager.connect(roomId);
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.uiManager.updateConnectionStatus('error');
            throw error;
        }
    }
    
    async disconnect() {
        if (this.connectionManager) {
            await this.connectionManager.disconnect();
        }
        this.currentRoom = null;
        this.isConnected = false;
    }
    
    async sendMessage(text) {
        if (!this.isConnected) {
            // Queue message for offline delivery
            if (this.connectionManager) {
                await this.connectionManager.queueMessageForDelivery(text);
                this.uiManager.displayMessage({
                    content: text,
                    sender: 'You',
                    timestamp: Date.now(),
                    encrypted: true,
                    queued: true
                });
                this.uiManager.showNotification('Message queued for delivery', 'info');
            }
            return;
        }
        
        try {
            await this.connectionManager.sendEncryptedMessage(text);
            
            // Display message locally
            this.uiManager.displayMessage({
                content: text,
                sender: 'You',
                senderId: this.identityManager.userIdentity.profileData.publicKey,
                timestamp: Date.now(),
                encrypted: true,
                verified: true
            });
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.uiManager.showError('Failed to send message: ' + error.message);
            throw error;
        }
    }
    
    async loadConversationHistory() {
        if (!this.connectionManager || !this.currentRoom) {
            return;
        }
        
        try {
            const messages = await this.connectionManager.getConversationHistory(50, 0);
            
            // Display historical messages
            messages.forEach(message => {
                this.uiManager.displayMessage({
                    ...message,
                    encrypted: true,
                    historical: true
                });
            });
            
            if (messages.length > 0) {
                this.uiManager.showNotification(`Loaded ${messages.length} previous messages`, 'info');
            }
            
        } catch (error) {
            console.error('Failed to load conversation history:', error);
        }
    }
    
    async handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            // Disconnect if connected
            if (this.isConnected) {
                await this.disconnect();
            }
            
            // Cleanup and return to auth
            this.cleanup();
            this.authComponent.handleLogout();
        }
    }
    
    // Cleanup chat components
    cleanup() {
        this.isAuthenticated = false;
        this.isConnected = false;
        this.currentRoom = null;
        
        if (this.connectionManager) {
            this.connectionManager.disconnect();
            this.connectionManager = null;
        }
        
        if (this.messageManager) {
            this.messageManager = null;
        }
        
        if (this.uiManager) {
            this.uiManager.destroy();
            this.uiManager = null;
        }
        
        if (this.fileManager) {
            this.fileManager = null;
        }
        
        if (this.voiceManager) {
            this.voiceManager = null;
        }
        
        // Keep identity manager and storage manager for potential re-login
    }
    
    // Dynamic loading of feature managers (same as original)
    async loadFileManager() {
        if (!this.fileManager && this.isAuthenticated) {
            console.log('📁 Loading file manager...');
            try {
                const { FileManager } = await import('./managers/file-manager.js');
                this.fileManager = new FileManager(this.identityManager, this.storageManager);
                await this.fileManager.setup();
                console.log('✅ File manager loaded');
            } catch (error) {
                console.error('❌ Failed to load file manager:', error);
                this.uiManager?.showError('Failed to load file sharing features');
            }
        }
        return this.fileManager;
    }
    
    async loadVoiceManager() {
        if (!this.voiceManager && this.isAuthenticated) {
            console.log('🎤 Loading voice manager...');
            try {
                const { VoiceManager } = await import('./managers/voice-manager.js');
                this.voiceManager = new VoiceManager(this.identityManager);
                await this.voiceManager.init();
                console.log('✅ Voice manager loaded');
            } catch (error) {
                console.error('❌ Failed to load voice manager:', error);
                this.uiManager?.showError('Failed to load voice features');
            }
        }
        return this.voiceManager;
    }
    
    async loadMobileFeatures() {
        if (this.isMobile() && this.isAuthenticated) {
            console.log('📱 Loading mobile features...');
            try {
                const { MobileManager } = await import('./managers/mobile-manager.js');
                this.mobileManager = new MobileManager(this.identityManager);
                await this.mobileManager.initialize();
                console.log('✅ Mobile features loaded');
            } catch (error) {
                console.error('❌ Failed to load mobile features:', error);
            }
        }
    }
    
    // Get application state
    getState() {
        return {
            isInitialized: this.isInitialized,
            isAuthenticated: this.isAuthenticated,
            isConnected: this.isConnected,
            currentRoom: this.currentRoom,
            currentView: this.currentView,
            userProfile: this.identityManager?.getUserProfile() || null,
            peerInfo: this.connectionManager?.getPeerInfo() || null,
            connectionState: this.connectionManager?.getState() || null
        };
    }
    
    // Utility methods
    getWebRTCConfig() {
        return {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
    }
    
    isMobile() {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    handleInitializationError(error) {
        document.body.innerHTML = `
            <div style="color: #ff6b6b; text-align: center; padding: 50px; font-family: monospace;">
                <h2>🔐 CipherWave Authentication Failed</h2>
                <p>Error: ${error.message}</p>
                <p style="margin-top: 20px; color: #666; font-size: 0.9em;">
                    This may be due to browser compatibility issues or security restrictions.
                </p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #0088cc; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
    
    // Enhanced error recovery
    async recoverFromError(error) {
        console.log('🔄 Attempting error recovery...');
        
        try {
            // Try to reconnect if we were connected
            if (this.currentRoom && this.isAuthenticated && !this.isConnected) {
                await this.connect(this.currentRoom);
                return true;
            }
            
            // Try to re-authenticate if authentication failed
            if (!this.isAuthenticated && this.authComponent) {
                this.showAuthenticationScreen();
                return true;
            }
            
        } catch (recoveryError) {
            console.error('Error recovery failed:', recoveryError);
        }
        
        return false;
    }
    
    // Cleanup on app destroy
    destroy() {
        this.cleanup();
        
        if (this.authComponent) {
            this.authComponent.destroy();
            this.authComponent = null;
        }
        
        if (this.identityManager) {
            this.identityManager.destroy();
            this.identityManager = null;
        }
        
        if (this.storageManager) {
            this.storageManager.destroy();
            this.storageManager = null;
        }
        
        console.log('🗑️ CipherWave Auth app destroyed');
    }
}