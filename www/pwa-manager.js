// Advanced PWA Features Manager
class PWAManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.messageQueue = [];
        this.syncManager = null;
        this.notificationPermission = 'default';
        this.serviceWorker = null;
        this.installPrompt = null;
        this.isInstalled = false;
        this.backgroundSync = false;
        this.shareTargetSupported = false;
        
        // PWA capabilities
        this.capabilities = {
            serviceWorker: 'serviceWorker' in navigator,
            notifications: 'Notification' in window,
            backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
            share: 'share' in navigator,
            clipboard: 'clipboard' in navigator,
            webShare: 'canShare' in navigator,
            installPrompt: false
        };
    }

    async setup() {
        console.log('📱 Setting up PWA features...');
        
        await this.registerServiceWorker();
        this.setupOfflineDetection();
        this.setupNotifications();
        this.setupBackgroundSync();
        this.setupInstallPrompt();
        this.setupAppShortcuts();
        this.setupShareTarget();
        this.setupOfflineMessageQueue();
        this.detectPWAInstallation();
        
        console.log('✅ PWA features ready');
        console.log('📊 PWA Capabilities:', this.capabilities);
    }

    async registerServiceWorker() {
        if (!this.capabilities.serviceWorker) {
            console.warn('⚠️ Service Worker not supported');
            return;
        }

        try {
            // Check if service worker is already registered by Vite PWA plugin
            const registration = await navigator.serviceWorker.getRegistration();
            
            if (registration) {
                this.serviceWorker = registration;
                console.log('✅ Service Worker already registered');
            } else {
                // Register our enhanced service worker
                this.serviceWorker = await navigator.serviceWorker.register('/enhanced-sw.js');
                console.log('✅ Enhanced Service Worker registered');
            }

            // Listen for service worker updates
            this.serviceWorker.addEventListener('updatefound', () => {
                this.handleServiceWorkerUpdate();
            });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event);
            });

        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    }

    setupOfflineDetection() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnlineStatusChange(true);
            this.processPendingMessages();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOnlineStatusChange(false);
        });

        // Create offline indicator
        this.createOfflineIndicator();
    }

    createOfflineIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.className = 'offline-indicator hidden';
        indicator.innerHTML = `
            <div class="offline-content">
                <i class="fas fa-wifi-slash"></i>
                <span>You're offline</span>
                <div class="offline-queue-count">0 messages queued</div>
            </div>
        `;

        document.body.appendChild(indicator);

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .offline-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #ff9800;
                color: white;
                padding: 8px 16px;
                text-align: center;
                z-index: 4000;
                transform: translateY(-100%);
                transition: transform 0.3s ease;
                font-size: 14px;
                font-weight: 500;
            }

            .offline-indicator:not(.hidden) {
                transform: translateY(0);
            }

            .offline-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .offline-queue-count {
                background: rgba(255, 255, 255, 0.2);
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 12px;
            }

            .tg-app.offline {
                margin-top: 40px;
            }
        `;
        document.head.appendChild(styles);
    }

    handleOnlineStatusChange(isOnline) {
        const indicator = document.getElementById('offline-indicator');
        const app = document.querySelector('.tg-app');
        
        if (isOnline) {
            indicator?.classList.add('hidden');
            app?.classList.remove('offline');
            this.announceToScreenReader('Connection restored');
        } else {
            indicator?.classList.remove('hidden');
            app?.classList.add('offline');
            this.updateOfflineQueueCount();
            this.announceToScreenReader('Connection lost - working offline');
        }
    }

    updateOfflineQueueCount() {
        const countElement = document.querySelector('.offline-queue-count');
        if (countElement) {
            const count = this.messageQueue.length;
            countElement.textContent = `${count} message${count !== 1 ? 's' : ''} queued`;
        }
    }

    async setupNotifications() {
        if (!this.capabilities.notifications) {
            console.warn('⚠️ Notifications not supported');
            return;
        }

        // Check current permission
        this.notificationPermission = Notification.permission;

        // Add notification toggle to UI
        this.addNotificationToggle();

        // Request permission if needed
        if (this.notificationPermission === 'default') {
            await this.requestNotificationPermission();
        }
    }

    addNotificationToggle() {
        // Add notification button to sidebar actions
        const sidebarActions = document.querySelector('.sidebar-actions');
        if (sidebarActions) {
            const notifBtn = document.createElement('button');
            notifBtn.className = 'action-btn notification-btn';
            notifBtn.innerHTML = '<i class="fas fa-bell"></i>';
            notifBtn.title = 'Notification settings';
            notifBtn.setAttribute('aria-label', 'Notification settings');
            
            notifBtn.addEventListener('click', () => {
                this.showNotificationSettings();
            });
            
            this.updateNotificationButton(notifBtn);
            sidebarActions.appendChild(notifBtn);
        }
    }

    updateNotificationButton(button) {
        const icon = button.querySelector('i');
        if (this.notificationPermission === 'granted') {
            icon.className = 'fas fa-bell';
            button.classList.remove('disabled');
        } else if (this.notificationPermission === 'denied') {
            icon.className = 'fas fa-bell-slash';
            button.classList.add('disabled');
        } else {
            icon.className = 'fas fa-bell';
            button.classList.add('pending');
        }
    }

    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission;
            
            // Update UI
            const notifBtn = document.querySelector('.notification-btn');
            if (notifBtn) {
                this.updateNotificationButton(notifBtn);
            }
            
            if (permission === 'granted') {
                this.announceToScreenReader('Notifications enabled');
                // Show welcome notification
                this.showNotification('CipherWave', {
                    body: 'Notifications are now enabled for new messages',
                    icon: '/cipherwave.png',
                    tag: 'welcome'
                });
            }
        } catch (error) {
            console.error('❌ Notification permission request failed:', error);
        }
    }

    showNotificationSettings() {
        const modal = document.createElement('div');
        modal.className = 'modal notification-settings-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Notification Settings</h2>
                    <button class="close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="notification-status">
                        <div class="status-item">
                            <span>Permission Status:</span>
                            <span class="status-badge ${this.notificationPermission}">${this.notificationPermission}</span>
                        </div>
                    </div>
                    <div class="notification-options">
                        <label class="toggle-option">
                            <input type="checkbox" id="message-notifications" ${this.getNotificationSetting('messages') ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                            New Messages
                        </label>
                        <label class="toggle-option">
                            <input type="checkbox" id="connection-notifications" ${this.getNotificationSetting('connections') ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                            Connection Status
                        </label>
                        <label class="toggle-option">
                            <input type="checkbox" id="sound-notifications" ${this.getNotificationSetting('sound') ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                            Sound Alerts
                        </label>
                    </div>
                    <div class="notification-actions">
                        <button class="btn-secondary test-notification-btn">
                            <i class="fas fa-bell"></i> Test Notification
                        </button>
                        ${this.notificationPermission !== 'granted' ? 
                            '<button class="btn-primary enable-notifications-btn">Enable Notifications</button>' : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.classList.add('active');

        // Setup event listeners
        this.setupNotificationSettingsEvents(modal);
    }

    setupNotificationSettingsEvents(modal) {
        // Close modal
        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => document.body.removeChild(modal), 300);
        });

        // Toggle settings
        const toggles = modal.querySelectorAll('input[type="checkbox"]');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const setting = e.target.id.replace('-notifications', '');
                this.setNotificationSetting(setting, e.target.checked);
            });
        });

        // Test notification
        modal.querySelector('.test-notification-btn')?.addEventListener('click', () => {
            this.showTestNotification();
        });

        // Enable notifications
        modal.querySelector('.enable-notifications-btn')?.addEventListener('click', async () => {
            await this.requestNotificationPermission();
            // Refresh modal
            modal.classList.remove('active');
            setTimeout(() => {
                document.body.removeChild(modal);
                this.showNotificationSettings();
            }, 300);
        });
    }

    getNotificationSetting(key) {
        const settings = JSON.parse(localStorage.getItem('cipherwave-notification-settings') || '{}');
        return settings[key] !== false; // Default to true
    }

    setNotificationSetting(key, value) {
        const settings = JSON.parse(localStorage.getItem('cipherwave-notification-settings') || '{}');
        settings[key] = value;
        localStorage.setItem('cipherwave-notification-settings', JSON.stringify(settings));
    }

    showTestNotification() {
        this.showNotification('CipherWave Test', {
            body: 'Notifications are working correctly! 🎉',
            icon: '/cipherwave.png',
            tag: 'test'
        });
    }

    showNotification(title, options = {}) {
        if (this.notificationPermission !== 'granted' || !this.getNotificationSetting('messages')) {
            return;
        }

        // Default options
        const defaultOptions = {
            icon: '/cipherwave.png',
            badge: '/cipherwave.png',
            timestamp: Date.now(),
            requireInteraction: false,
            silent: !this.getNotificationSetting('sound'),
            ...options
        };

        try {
            const notification = new Notification(title, defaultOptions);
            
            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
            
            // Handle click
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            return notification;
        } catch (error) {
            console.error('❌ Failed to show notification:', error);
        }
    }

    setupBackgroundSync() {
        if (!this.capabilities.backgroundSync) {
            console.warn('⚠️ Background Sync not supported');
            return;
        }

        this.backgroundSync = true;
        console.log('✅ Background Sync available');
    }

    async syncPendingMessages() {
        if (!this.serviceWorker || !this.backgroundSync) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-messages');
            console.log('📤 Background sync registered for pending messages');
        } catch (error) {
            console.error('❌ Background sync registration failed:', error);
        }
    }

    setupInstallPrompt() {
        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e;
            this.capabilities.installPrompt = true;
            this.showInstallBanner();
        });

        // Listen for app installed
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.hideInstallBanner();
            this.announceToScreenReader('CipherWave app installed successfully');
        });
    }

    showInstallBanner() {
        // Create install banner
        const banner = document.createElement('div');
        banner.id = 'install-banner';
        banner.className = 'install-banner';
        banner.innerHTML = `
            <div class="install-content">
                <div class="install-icon">
                    <img src="/cipherwave.png" alt="CipherWave" width="32" height="32">
                </div>
                <div class="install-text">
                    <div class="install-title">Install CipherWave</div>
                    <div class="install-subtitle">Get the full app experience</div>
                </div>
                <div class="install-actions">
                    <button class="install-btn" id="install-app-btn">
                        <i class="fas fa-download"></i> Install
                    </button>
                    <button class="dismiss-btn" id="dismiss-install-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        // Setup event listeners
        document.getElementById('install-app-btn').addEventListener('click', () => {
            this.promptInstall();
        });

        document.getElementById('dismiss-install-btn').addEventListener('click', () => {
            this.hideInstallBanner();
        });

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (document.getElementById('install-banner')) {
                this.hideInstallBanner();
            }
        }, 10000);

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .install-banner {
                position: fixed;
                bottom: 20px;
                left: 20px;
                right: 20px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 3000;
                padding: 16px;
                border: 1px solid #e0e0e0;
                animation: slideUp 0.3s ease;
            }

            @keyframes slideUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            .install-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .install-icon img {
                border-radius: 6px;
            }

            .install-text {
                flex: 1;
            }

            .install-title {
                font-weight: 600;
                color: #333;
                font-size: 14px;
            }

            .install-subtitle {
                font-size: 12px;
                color: #666;
                margin-top: 2px;
            }

            .install-actions {
                display: flex;
                gap: 8px;
            }

            .install-btn {
                background: var(--tg-primary);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            }

            .install-btn:hover {
                background: var(--tg-primary-dark);
                transform: translateY(-1px);
            }

            .dismiss-btn {
                background: #f5f5f5;
                border: none;
                width: 32px;
                height: 32px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #666;
                transition: all 0.2s;
            }

            .dismiss-btn:hover {
                background: #e8e8e8;
            }

            @media (max-width: 480px) {
                .install-banner {
                    left: 10px;
                    right: 10px;
                    bottom: 10px;
                }

                .install-content {
                    gap: 8px;
                }

                .install-btn {
                    padding: 6px 12px;
                    font-size: 11px;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    hideInstallBanner() {
        const banner = document.getElementById('install-banner');
        if (banner) {
            banner.style.animation = 'slideDown 0.3s ease forwards';
            setTimeout(() => {
                banner.remove();
            }, 300);
        }

        // Add slide down animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    async promptInstall() {
        if (!this.installPrompt) return;

        try {
            const result = await this.installPrompt.prompt();
            console.log('📱 Install prompt result:', result.outcome);
            
            if (result.outcome === 'accepted') {
                this.announceToScreenReader('Installing CipherWave app...');
            }
            
            // Clear the prompt
            this.installPrompt = null;
            this.hideInstallBanner();
        } catch (error) {
            console.error('❌ Install prompt failed:', error);
        }
    }

    setupAppShortcuts() {
        // App shortcuts are defined in the web app manifest
        // This method handles dynamic shortcut updates if needed
        
        if ('getInstalledRelatedApps' in navigator) {
            navigator.getInstalledRelatedApps().then(apps => {
                if (apps.length > 0) {
                    this.isInstalled = true;
                    console.log('📱 App is installed');
                }
            });
        }
    }

    setupShareTarget() {
        // Handle shared content (when app is launched as share target)
        if ('URLSearchParams' in window) {
            const urlParams = new URLSearchParams(window.location.search);
            const sharedText = urlParams.get('text');
            const sharedUrl = urlParams.get('url');
            
            if (sharedText || sharedUrl) {
                this.handleSharedContent({ text: sharedText, url: sharedUrl });
            }
        }

        // Add native share functionality
        this.setupNativeShare();
    }

    setupNativeShare() {
        // Add share button to chat actions if Web Share API is supported
        if (this.capabilities.share) {
            const chatActions = document.querySelector('.chat-actions');
            if (chatActions) {
                const shareBtn = document.createElement('button');
                shareBtn.className = 'chat-action-btn share-btn';
                shareBtn.innerHTML = '<i class="fas fa-share"></i>';
                shareBtn.title = 'Share conversation';
                shareBtn.setAttribute('aria-label', 'Share conversation');
                
                shareBtn.addEventListener('click', () => {
                    this.shareConversation();
                });
                
                chatActions.appendChild(shareBtn);
            }
        }
    }

    async shareConversation() {
        if (!this.capabilities.share) return;

        try {
            const shareData = {
                title: 'CipherWave Conversation',
                text: 'Join me on CipherWave for secure messaging',
                url: window.location.origin
            };

            if (navigator.canShare && !navigator.canShare(shareData)) {
                console.warn('⚠️ Share data not supported');
                return;
            }

            await navigator.share(shareData);
            this.announceToScreenReader('Conversation shared');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('❌ Share failed:', error);
            }
        }
    }

    handleSharedContent(data) {
        // Handle content shared to the app
        const messageInput = document.getElementById('message-input');
        if (messageInput && data.text) {
            messageInput.value = data.text;
            messageInput.focus();
            this.announceToScreenReader('Shared content loaded');
        }
    }

    setupOfflineMessageQueue() {
        // Hook into the message sending system
        this.originalSendMessage = window.sendMessage || function() {};
        
        // Override global send message function
        window.sendMessage = (message) => {
            if (this.isOnline) {
                this.originalSendMessage(message);
            } else {
                this.queueMessage(message);
            }
        };
    }

    queueMessage(message) {
        const queuedMessage = {
            id: Date.now(),
            message: message,
            timestamp: new Date().toISOString(),
            retryCount: 0
        };

        this.messageQueue.push(queuedMessage);
        this.updateOfflineQueueCount();
        
        // Save to localStorage for persistence
        localStorage.setItem('cipherwave-message-queue', JSON.stringify(this.messageQueue));
        
        this.announceToScreenReader('Message queued for when you\'re back online');
    }

    async processPendingMessages() {
        if (this.messageQueue.length === 0) return;

        console.log(`📤 Processing ${this.messageQueue.length} queued messages`);
        
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        
        for (const queuedMessage of messages) {
            try {
                await this.originalSendMessage(queuedMessage.message);
                console.log('✅ Queued message sent:', queuedMessage.id);
            } catch (error) {
                console.error('❌ Failed to send queued message:', error);
                // Re-queue if retry count is low
                if (queuedMessage.retryCount < 3) {
                    queuedMessage.retryCount++;
                    this.messageQueue.push(queuedMessage);
                }
            }
        }
        
        // Update storage
        localStorage.setItem('cipherwave-message-queue', JSON.stringify(this.messageQueue));
        this.updateOfflineQueueCount();
        
        // Sync remaining messages in background if available
        if (this.messageQueue.length > 0 && this.backgroundSync) {
            await this.syncPendingMessages();
        }
    }

    detectPWAInstallation() {
        // Detect if running as PWA
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone ||
                           document.referrer.includes('android-app://');

        if (isStandalone) {
            this.isInstalled = true;
            document.body.classList.add('pwa-installed');
            console.log('📱 Running as installed PWA');
        }
    }

    handleServiceWorkerUpdate() {
        // Show update notification
        this.showNotification('CipherWave Update', {
            body: 'A new version is available. Refresh to update.',
            tag: 'update',
            requireInteraction: true,
            actions: [
                { action: 'refresh', title: 'Refresh Now' },
                { action: 'dismiss', title: 'Later' }
            ]
        });
    }

    handleServiceWorkerMessage(event) {
        const { type, data } = event.data;
        
        switch (type) {
            case 'sync-complete':
                console.log('✅ Background sync completed');
                this.processPendingMessages();
                break;
            case 'notification-click':
                // Handle notification clicks
                window.focus();
                break;
            case 'cache-updated':
                console.log('✅ Cache updated');
                break;
        }
    }

    // Utility methods
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'visually-hidden';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // Public API
    isAppInstalled() {
        return this.isInstalled;
    }

    canInstall() {
        return this.capabilities.installPrompt && this.installPrompt !== null;
    }

    getCapabilities() {
        return { ...this.capabilities };
    }

    async clearCache() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('✅ PWA cache cleared');
        }
    }
}

// Enhanced Service Worker registration script
const enhancedServiceWorkerScript = `
// Enhanced Service Worker for CipherWave
const CACHE_NAME = 'cipherwave-v2';
const OFFLINE_URL = '/offline.html';

const CACHE_URLS = [
    '/',
    '/index.html',
    '/script.js',
    '/styles.css',
    '/advanced-features.js',
    '/adaptive-theme.js',
    '/pwa-manager.js',
    '/cipherwave.png',
    '/offline.html'
];

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.open(CACHE_NAME)
                    .then(cache => cache.match(OFFLINE_URL));
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
            .catch(() => {
                // Return offline fallback for essential resources
                if (event.request.destination === 'document') {
                    return caches.match(OFFLINE_URL);
                }
            })
    );
});

// Background sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

async function syncMessages() {
    try {
        // Get queued messages from IndexedDB or localStorage
        const messages = await getQueuedMessages();
        
        // Send each message
        for (const message of messages) {
            await sendMessage(message);
        }
        
        // Notify main thread
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'sync-complete',
                    data: { messageCount: messages.length }
                });
            });
        });
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Notification click handling
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'refresh') {
        // Refresh all clients
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.navigate(client.url));
        });
    } else {
        // Focus the app
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                if (clients.length > 0) {
                    return clients[0].focus();
                }
                return self.clients.openWindow('/');
            })
        );
    }
});

// Helper functions would be implemented here
async function getQueuedMessages() {
    // Implementation to retrieve queued messages
    return [];
}

async function sendMessage(message) {
    // Implementation to send message to server
    return fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(message),
        headers: { 'Content-Type': 'application/json' }
    });
}
`;

// Create enhanced service worker file
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    // This would typically be a separate file, but for demo purposes we include it here
    console.log('Enhanced Service Worker script ready');
}

// Export for use in other modules
window.PWAManager = PWAManager;