// CipherWave - Main Entry Point with Code Splitting
// Enhanced modular architecture with dynamic imports

import { SecurityManager } from './managers/security-manager.js';
import { MessageManager } from './managers/message-manager.js';
import { ConnectionManager } from './managers/connection-manager.js';
import { UIManager } from './managers/ui-manager.js';

// Core application state
class CipherWaveApp {
    constructor() {
        this.securityManager = null;
        this.messageManager = null;
        this.connectionManager = null;
        this.uiManager = null;
        
        // Lazy-loaded managers
        this.fileManager = null;
        this.voiceManager = null;
        this.performanceMonitor = null;
        
        // Application state
        this.isInitialized = false;
        this.currentRoom = null;
        this.isConnected = false;
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing CipherWave...');
        
        try {
            // Initialize core managers
            await this.initializeCoreManagers();
            
            // Initialize UI
            await this.initializeUI();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Mark as initialized
            this.isInitialized = true;
            
            console.log('✅ CipherWave initialized successfully');
            
            // Pre-load critical chunks in background
            this.preloadCriticalChunks();
            
        } catch (error) {
            console.error('❌ Failed to initialize CipherWave:', error);
            this.handleInitializationError(error);
        }
    }
    
    async initializeCoreManagers() {
        // Initialize security manager with single crypto library
        this.securityManager = new SecurityManager();
        await this.securityManager.initialize();
        
        // Initialize connection manager
        this.connectionManager = new ConnectionManager(this.getWebRTCConfig());
        
        // Initialize message manager
        this.messageManager = new MessageManager(this.securityManager);
        
        // Initialize UI manager
        this.uiManager = new UIManager();
    }
    
    async initializeUI() {
        await this.uiManager.initialize();
        
        // Bind UI events to manager methods
        this.uiManager.on('connect', (roomId, cipher) => this.connect(roomId, cipher));
        this.uiManager.on('disconnect', () => this.disconnect());
        this.uiManager.on('sendMessage', (message) => this.sendMessage(message));
        this.uiManager.on('loadFileManager', () => this.loadFileManager());
        this.uiManager.on('loadVoiceManager', () => this.loadVoiceManager());
    }
    
    setupEventListeners() {
        // Connection events
        this.connectionManager.on('connected', () => {
            this.isConnected = true;
            this.uiManager.updateConnectionStatus('connected');
        });
        
        this.connectionManager.on('disconnected', () => {
            this.isConnected = false;
            this.uiManager.updateConnectionStatus('disconnected');
        });
        
        this.connectionManager.on('dataReceived', (data) => {
            this.handleIncomingData(data);
        });
        
        // Message events
        this.messageManager.on('messageDecrypted', (message) => {
            this.uiManager.displayMessage(message);
        });
        
        // Error handling
        this.connectionManager.on('error', (error) => {
            console.error('Connection error:', error);
            this.uiManager.showError('Connection error: ' + error.message);
        });
    }
    
    // Dynamic loading of heavy UI components
    async loadFileManager() {
        if (!this.fileManager) {
            console.log('📁 Loading file manager...');
            try {
                const { FileManager } = await import('./managers/file-manager.js');
                this.fileManager = new FileManager();
                await this.fileManager.setup();
                console.log('✅ File manager loaded');
            } catch (error) {
                console.error('❌ Failed to load file manager:', error);
                this.uiManager.showError('Failed to load file sharing features');
            }
        }
        return this.fileManager;
    }
    
    async loadVoiceManager() {
        if (!this.voiceManager) {
            console.log('🎤 Loading voice manager...');
            try {
                const { VoiceManager } = await import('./managers/voice-manager.js');
                this.voiceManager = new VoiceManager();
                await this.voiceManager.init();
                console.log('✅ Voice manager loaded');
            } catch (error) {
                console.error('❌ Failed to load voice manager:', error);
                this.uiManager.showError('Failed to load voice features');
            }
        }
        return this.voiceManager;
    }
    
    // Load mobile-specific features only when needed
    async loadMobileFeatures() {
        if (this.isMobile()) {
            console.log('📱 Loading mobile features...');
            try {
                const { MobileManager } = await import('./managers/mobile-manager.js');
                this.mobileManager = new MobileManager();
                await this.mobileManager.initialize();
                console.log('✅ Mobile features loaded');
            } catch (error) {
                console.error('❌ Failed to load mobile features:', error);
            }
        }
    }
    
    // Preload critical chunks in background
    async preloadCriticalChunks() {
        // Preload will be handled by Vite's chunk splitting
        // WebRTC chunks will be loaded automatically when needed
        console.log('🚀 Critical chunks will be loaded on demand');
    }
    
    // Core application methods
    async connect(roomId, cipher = 'chacha20-poly1305') {
        if (!this.isInitialized) {
            throw new Error('CipherWave not initialized');
        }
        
        try {
            this.currentRoom = roomId;
            this.uiManager.updateConnectionStatus('connecting');
            
            // Set encryption cipher
            await this.securityManager.setCipher(cipher);
            
            // Establish connection
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
            throw new Error('Not connected to a room');
        }
        
        try {
            const encryptedMessage = await this.messageManager.encryptMessage(text);
            await this.connectionManager.sendData(encryptedMessage);
            
            // Display message locally
            this.uiManager.displayMessage({
                text,
                sender: 'self',
                timestamp: Date.now(),
                encrypted: true
            });
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.uiManager.showError('Failed to send message');
            throw error;
        }
    }
    
    async handleIncomingData(data) {
        try {
            const decryptedMessage = await this.messageManager.decryptMessage(data);
            this.uiManager.displayMessage({
                ...decryptedMessage,
                sender: 'peer',
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Failed to decrypt message:', error);
        }
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
                <h2>CipherWave Initialization Failed</h2>
                <p>Error: ${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #0088cc; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cipherWave = new CipherWaveApp();
    });
} else {
    window.cipherWave = new CipherWaveApp();
}

// Export for testing
export { CipherWaveApp };