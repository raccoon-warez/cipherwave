// CipherWave - Main Entry Point with Authentication
// Enhanced modular architecture with identity management and secure storage

import { CipherWaveAuthApp } from './cipherwave-auth-app.js';
import { CipherWaveApp as LegacyCipherWaveApp } from './legacy-main.js';

// Feature flag for authentication mode
const USE_AUTHENTICATION = true;

// Main application wrapper
class CipherWaveApp {
    constructor() {
        this.app = null;
        this.init();
    }
    
    async init() {
        console.log('🚀 Starting CipherWave...');
        
        try {
            if (USE_AUTHENTICATION) {
                console.log('🔐 Initializing with authentication support...');
                this.app = new CipherWaveAuthApp();
            } else {
                console.log('🔓 Initializing legacy mode (no authentication)...');
                // Move original implementation to legacy-main.js
                this.app = new LegacyCipherWaveApp();
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize CipherWave:', error);
            this.handleInitializationError(error);
        }
    }
    
    // Delegate methods to the underlying app
    getState() {
        return this.app?.getState?.() || {};
    }
    
    async connect(roomId, cipher) {
        return this.app?.connect?.(roomId, cipher);
    }
    
    async disconnect() {
        return this.app?.disconnect?.();
    }
    
    async sendMessage(text) {
        return this.app?.sendMessage?.(text);
    }
    
    handleInitializationError(error) {
        document.body.innerHTML = `
            <div style="color: #ff6b6b; text-align: center; padding: 50px; font-family: monospace;">
                <h2>🔐 CipherWave Initialization Failed</h2>
                <p>Error: ${error.message}</p>
                <p style="margin-top: 20px; color: #666; font-size: 0.9em;">
                    Authentication mode: ${USE_AUTHENTICATION ? 'Enabled' : 'Disabled'}
                </p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #0088cc; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
    
    destroy() {
        this.app?.destroy?.();
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