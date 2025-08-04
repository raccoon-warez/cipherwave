// CipherWave Mobile Manager - Capacitor integration for mobile platforms
// Only loaded on mobile devices to reduce bundle size on desktop

import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export class MobileManager {
    constructor() {
        this.platform = Capacitor.getPlatform();
        this.isNative = Capacitor.isNativePlatform();
        this.isInitialized = false;
        
        // Mobile-specific features
        this.backgroundMode = false;
        this.pushNotifications = false;
        this.hapticFeedback = false;
        
        console.log(`📱 Mobile manager initialized for platform: ${this.platform}`);
    }
    
    async initialize() {
        if (!this.isNative) {
            console.log('📱 Running in web mode, skipping native features');
            return;
        }
        
        console.log('📱 Initializing mobile features...');
        
        try {
            // Configure status bar
            await this.configureStatusBar();
            
            // Hide splash screen
            await this.hideSplashScreen();
            
            // Set up mobile-specific UI enhancements
            this.setupMobileUI();
            
            // Set up app lifecycle handlers
            this.setupAppLifecycle();
            
            // Set up hardware back button (Android)
            this.setupHardwareBackButton();
            
            this.isInitialized = true;
            console.log('✅ Mobile features initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize mobile features:', error);
            throw error;
        }
    }
    
    async configureStatusBar() {
        try {
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#0f1419' });
            await StatusBar.show();
            
            console.log('📱 Status bar configured');
            
        } catch (error) {
            console.warn('Failed to configure status bar:', error);
        }
    }
    
    async hideSplashScreen() {
        try {
            await SplashScreen.hide();
            console.log('📱 Splash screen hidden');
            
        } catch (error) {
            console.warn('Failed to hide splash screen:', error);
        }
    }
    
    setupMobileUI() {
        // Add mobile-specific CSS classes
        document.body.classList.add('mobile-app');
        document.body.classList.add(`platform-${this.platform}`);
        
        // Disable zoom on inputs
        this.disableZoomOnInputs();
        
        // Set up touch optimizations
        this.setupTouchOptimizations();
        
        // Add safe area padding
        this.addSafeAreaSupport();
        
        console.log('📱 Mobile UI enhancements applied');
    }
    
    disableZoomOnInputs() {
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
            );
        }
        
        // Prevent zoom on input focus
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.style.fontSize = '16px';
            });
            
            input.addEventListener('blur', () => {
                input.style.fontSize = '';
            });
        });
    }
    
    setupTouchOptimizations() {
        // Add touch-friendly styles
        const style = document.createElement('style');
        style.textContent = `
            .mobile-app {
                -webkit-tap-highlight-color: transparent;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
            }
            
            .mobile-app button,
            .mobile-app .btn {
                min-height: 44px;
                min-width: 44px;
                touch-action: manipulation;
            }
            
            .mobile-app input,
            .mobile-app textarea {
                -webkit-user-select: text;
                user-select: text;
            }
            
            .mobile-app .message {
                -webkit-user-select: text;
                user-select: text;
            }
            
            /* Safe area support */
            .mobile-app {
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
                padding-left: env(safe-area-inset-left);
                padding-right: env(safe-area-inset-right);
            }
            
            /* Platform-specific adjustments */
            .platform-ios .panel {
                border-radius: 16px;
            }
            
            .platform-android .btn {
                border-radius: 4px;
            }
            
            /* Improved touch targets */
            .mobile-app .message-input-group button {
                padding: 12px 16px;
            }
            
            .mobile-app .voice-btn {
                min-width: 48px;
                min-height: 48px;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    addSafeAreaSupport() {
        // Add CSS custom properties for safe areas
        const root = document.documentElement;
        
        // Fallback values for browsers that don't support env()
        root.style.setProperty('--safe-area-inset-top', '0px');
        root.style.setProperty('--safe-area-inset-right', '0px');
        root.style.setProperty('--safe-area-inset-bottom', '0px');
        root.style.setProperty('--safe-area-inset-left', '0px');
    }
    
    setupAppLifecycle() {
        // Handle app state changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onAppBackground();
            } else {
                this.onAppForeground();
            }
        });
        
        // Handle app pause/resume (Capacitor events)
        document.addEventListener('pause', () => {
            this.onAppPause();
        });
        
        document.addEventListener('resume', () => {
            this.onAppResume();
        });
    }
    
    setupHardwareBackButton() {
        if (this.platform !== 'android') {
            return;
        }
        
        document.addEventListener('backbutton', (e) => {
            e.preventDefault();
            this.handleHardwareBackButton();
        });
    }
    
    handleHardwareBackButton() {
        // Check if there are any modals or overlays open
        const overlays = document.querySelectorAll('.modal, .overlay, .voice-recording-overlay');
        
        if (overlays.length > 0) {
            // Close the topmost overlay
            const topOverlay = overlays[overlays.length - 1];
            const closeButton = topOverlay.querySelector('.close, .cancel, [data-dismiss]');
            
            if (closeButton) {
                closeButton.click();
            } else {
                topOverlay.remove();
            }
            
            return;
        }
        
        // Check if connected to a room
        if (window.cipherWave && window.cipherWave.isConnected) {
            this.showExitConfirmation();
        } else {
            // Exit the app
            this.exitApp();
        }
    }
    
    showExitConfirmation() {
        const confirmation = document.createElement('div');
        confirmation.className = 'exit-confirmation modal';
        confirmation.innerHTML = `
            <div class="modal-content">
                <h3>Exit CipherWave?</h3>
                <p>You are currently connected to a chat room. Are you sure you want to exit?</p>
                <div class="modal-buttons">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Cancel
                    </button>
                    <button class="btn btn-primary" onclick="window.mobileManager.exitApp()">
                        Exit
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmation);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (confirmation.parentElement) {
                confirmation.remove();
            }
        }, 10000);
    }
    
    exitApp() {
        // Disconnect from room if connected
        if (window.cipherWave && window.cipherWave.isConnected) {
            window.cipherWave.disconnect();
        }
        
        // Close the app (Android) or go to background (iOS)
        if (this.platform === 'android') {
            // For Android, we can't actually close the app from web code
            // The system will handle it
            navigator.app?.exitApp?.();
        }
        
        // For iOS, apps don't typically exit, they go to background
        // The system handles this automatically
    }
    
    onAppBackground() {
        console.log('📱 App went to background');
        this.backgroundMode = true;
        
        // Reduce activity to preserve battery
        this.reduceBackgroundActivity();
    }
    
    onAppForeground() {
        console.log('📱 App came to foreground');
        this.backgroundMode = false;
        
        // Resume normal activity
        this.resumeNormalActivity();
    }
    
    onAppPause() {
        console.log('📱 App paused');
        
        // Save any pending data
        this.savePendingData();
    }
    
    onAppResume() {
        console.log('📱 App resumed');
        
        // Restore app state
        this.restoreAppState();
    }
    
    reduceBackgroundActivity() {
        // Reduce refresh rates, pause animations, etc.
        if (window.cipherWave && window.cipherWave.connectionManager) {
            // Reduce ping frequency when in background
            // This would be implemented in the connection manager
        }
    }
    
    resumeNormalActivity() {
        // Resume normal refresh rates and activities
        if (window.cipherWave && window.cipherWave.connectionManager) {
            // Resume normal ping frequency
            // This would be implemented in the connection manager
        }
    }
    
    savePendingData() {
        // Save any unsent messages or draft content
        const messageInput = document.getElementById('message-input');
        if (messageInput && messageInput.value.trim()) {
            localStorage.setItem('cipherwave_draft_message', messageInput.value);
        }
    }
    
    restoreAppState() {
        // Restore draft messages
        const draftMessage = localStorage.getItem('cipherwave_draft_message');
        if (draftMessage) {
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value = draftMessage;
            }
            localStorage.removeItem('cipherwave_draft_message');
        }
    }
    
    // Haptic feedback for supported devices
    async hapticFeedback(type = 'light') {
        if (!this.isNative) {
            return;
        }
        
        try {
            // Try to use Capacitor Haptics plugin if available
            if (window.Capacitor?.Plugins?.Haptics) {
                const { Haptics, ImpactStyle } = window.Capacitor.Plugins;
                
                const styles = {
                    light: ImpactStyle.Light,
                    medium: ImpactStyle.Medium,
                    heavy: ImpactStyle.Heavy
                };
                
                await Haptics.impact({ style: styles[type] || styles.light });
            }
        } catch (error) {
            console.warn('Haptic feedback not available:', error);
        }
    }
    
    // Show native toast message
    async showToast(message, duration = 'short') {
        if (!this.isNative) {
            // Fallback to web notification
            this.showWebToast(message);
            return;
        }
        
        try {
            if (window.Capacitor?.Plugins?.Toast) {
                const { Toast } = window.Capacitor.Plugins;
                await Toast.show({
                    text: message,
                    duration: duration
                });
            }
        } catch (error) {
            console.warn('Native toast not available:', error);
            this.showWebToast(message);
        }
    }
    
    showWebToast(message) {
        const toast = document.createElement('div');
        toast.className = 'web-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            z-index: 10000;
            animation: toastIn 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    // Get device information
    getDeviceInfo() {
        return {
            platform: this.platform,
            isNative: this.isNative,
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            pixelRatio: window.devicePixelRatio || 1,
            language: navigator.language,
            online: navigator.onLine
        };
    }
    
    // Check if device supports feature
    supportsFeature(feature) {
        const features = {
            webrtc: !!window.RTCPeerConnection,
            websocket: !!window.WebSocket,
            notifications: 'Notification' in window,
            geolocation: 'geolocation' in navigator,
            mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            serviceWorker: 'serviceWorker' in navigator,
            indexedDB: 'indexedDB' in window,
            localStorage: 'localStorage' in window
        };
        
        return features[feature] || false;
    }
    
    destroy() {
        // Clean up event listeners
        document.removeEventListener('visibilitychange', this.onAppBackground);
        document.removeEventListener('pause', this.onAppPause);
        document.removeEventListener('resume', this.onAppResume);
        document.removeEventListener('backbutton', this.handleHardwareBackButton);
        
        // Remove mobile classes
        document.body.classList.remove('mobile-app', `platform-${this.platform}`);
        
        this.isInitialized = false;
        console.log('🗑️ Mobile manager destroyed');
    }
}

// Make mobile manager globally accessible
window.mobileManager = null;