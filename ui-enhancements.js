// CipherWave UI Enhancements
// Progressive Web App features and enhanced user experience

class UIEnhancements {
    constructor() {
        this.isOffline = !navigator.onLine;
        this.installPrompt = null;
        this.notificationPermission = 'default';
        this.theme = localStorage.getItem('cipherwave-theme') || 'dark';
        this.soundEnabled = localStorage.getItem('cipherwave-sound') !== 'false';
        
        this.initializeEnhancements();
    }
    
    initializeEnhancements() {
        this.setupOfflineHandling();
        this.setupInstallPrompt();
        this.setupNotifications();
        this.setupThemeToggle();
        this.setupSoundToggle();
        this.setupKeyboardShortcuts();
        this.setupAccessibility();
        this.setupConnectionIndicator();
        this.setupProgressIndicators();
        this.setupTooltips();
        this.applyTheme();
    }
    
    // Offline handling and PWA features
    setupOfflineHandling() {
        window.addEventListener('online', () => {
            this.isOffline = false;
            this.showNotification('Connection restored', 'success');
            this.updateConnectionUI(true);
        });
        
        window.addEventListener('offline', () => {
            this.isOffline = true;
            this.showNotification('Connection lost - working in offline mode', 'warning');
            this.updateConnectionUI(false);
        });
        
        // Register service worker for offline support
        if ('serviceWorker' in navigator) {
            this.registerServiceWorker();
        }
    }
    
    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
            
            // Listen for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        this.showUpdateAvailable();
                    }
                });
            });
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
    
    showUpdateAvailable() {
        const updateBanner = this.createUpdateBanner();
        document.body.appendChild(updateBanner);
    }
    
    createUpdateBanner() {
        const banner = document.createElement('div');
        banner.className = 'update-banner';
        banner.innerHTML = `
            <div class="update-content">
                <span>🔄 New version available!</span>
                <button id="update-btn" class="btn btn-secondary">Update</button>
                <button id="dismiss-update" class="btn-link">Later</button>
            </div>
        `;
        
        banner.querySelector('#update-btn').addEventListener('click', () => {
            window.location.reload();
        });
        
        banner.querySelector('#dismiss-update').addEventListener('click', () => {
            banner.remove();
        });
        
        return banner;
    }
    
    // PWA Install prompt
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e;
            this.showInstallButton();
        });
        
        window.addEventListener('appinstalled', () => {
            this.hideInstallButton();
            this.showNotification('CipherWave installed successfully!', 'success');
            this.installPrompt = null;
        });
    }
    
    showInstallButton() {
        const installBtn = document.createElement('button');
        installBtn.id = 'install-app-btn';
        installBtn.className = 'btn btn-secondary install-btn';
        installBtn.innerHTML = '<i class="fas fa-download"></i> Install App';
        installBtn.addEventListener('click', this.promptInstall.bind(this));
        
        const header = document.querySelector('.header');
        if (header && !document.getElementById('install-app-btn')) {
            header.appendChild(installBtn);
        }
    }
    
    hideInstallButton() {
        const installBtn = document.getElementById('install-app-btn');
        if (installBtn) {
            installBtn.remove();
        }
    }
    
    async promptInstall() {
        if (!this.installPrompt) return;
        
        const result = await this.installPrompt.prompt();
        console.log('Install prompt result:', result);
        this.installPrompt = null;
        this.hideInstallButton();
    }
    
    // Notification system
    setupNotifications() {
        if ('Notification' in window) {
            this.requestNotificationPermission();
        }
    }
    
    async requestNotificationPermission() {
        if (Notification.permission === 'default') {
            this.notificationPermission = await Notification.requestPermission();
        } else {
            this.notificationPermission = Notification.permission;
        }
    }
    
    showNotification(message, type = 'info', options = {}) {
        // In-app notification
        this.showInAppNotification(message, type);
        
        // System notification (if permitted)
        if (this.notificationPermission === 'granted' && options.system) {
            new Notification('CipherWave', {
                body: message,
                icon: '/cipherwave.png',
                badge: '/cipherwave.png'
            });
        }
        
        // Play sound if enabled
        if (this.soundEnabled && type !== 'info') {
            this.playNotificationSound(type);
        }
    }
    
    showInAppNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        const container = this.getNotificationContainer();
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
        
        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }
    
    getNotificationContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle', 
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    playNotificationSound(type) {
        // Simple audio feedback using Web Audio API
        if ('AudioContext' in window || 'webkitAudioContext' in window) {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            // Different frequencies for different notification types
            const frequencies = { success: 800, error: 400, warning: 600 };
            oscillator.frequency.setValueAtTime(frequencies[type] || 500, audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.3);
        }
    }
    
    // Theme system
    setupThemeToggle() {
        const themeToggle = document.createElement('button');
        themeToggle.id = 'theme-toggle';
        themeToggle.className = 'btn btn-secondary theme-toggle';
        themeToggle.innerHTML = '<i class="fas fa-palette"></i>';
        themeToggle.title = 'Toggle theme';
        themeToggle.addEventListener('click', this.toggleTheme.bind(this));
        
        const header = document.querySelector('.header');
        if (header) {
            header.appendChild(themeToggle);
        }
    }
    
    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('cipherwave-theme', this.theme);
        this.applyTheme();
    }
    
    applyTheme() {
        document.body.setAttribute('data-theme', this.theme);
        
        // Update theme toggle icon
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            icon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
    
    // Sound toggle
    setupSoundToggle() {
        const soundToggle = document.createElement('button');
        soundToggle.id = 'sound-toggle';
        soundToggle.className = 'btn btn-secondary sound-toggle';
        soundToggle.innerHTML = this.soundEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
        soundToggle.title = 'Toggle sound';
        soundToggle.addEventListener('click', this.toggleSound.bind(this));
        
        const header = document.querySelector('.header');
        if (header) {
            header.appendChild(soundToggle);
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('cipherwave-sound', this.soundEnabled.toString());
        
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            const icon = soundToggle.querySelector('i');
            icon.className = this.soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        }
        
        this.showNotification(`Sound ${this.soundEnabled ? 'enabled' : 'disabled'}`, 'info');
    }
    
    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to send message
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const sendBtn = document.getElementById('send-btn');
                if (sendBtn && !sendBtn.disabled) {
                    sendBtn.click();
                }
            }
            
            // Escape to close modals/overlays
            if (e.key === 'Escape') {
                this.closeModals();
            }
            
            // Ctrl/Cmd + / to show keyboard shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                this.showKeyboardShortcuts();
            }
        });
    }
    
    closeModals() {
        const modals = document.querySelectorAll('.modal:not(.hidden)');
        modals.forEach(modal => modal.classList.add('hidden'));
        
        const overlays = document.querySelectorAll('.overlay:not(.hidden)');
        overlays.forEach(overlay => overlay.classList.add('hidden'));
    }
    
    showKeyboardShortcuts() {
        const shortcuts = [
            { key: 'Ctrl+Enter', action: 'Send message' },
            { key: 'Escape', action: 'Close modals' },
            { key: 'Ctrl+/', action: 'Show shortcuts' },
            { key: 'Tab', action: 'Navigate elements' }
        ];
        
        const shortcutModal = this.createShortcutModal(shortcuts);
        document.body.appendChild(shortcutModal);
    }
    
    createShortcutModal(shortcuts) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Keyboard Shortcuts</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="shortcuts-list">
                        ${shortcuts.map(s => `
                            <div class="shortcut-item">
                                <kbd>${s.key}</kbd>
                                <span>${s.action}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        return modal;
    }
    
    // Accessibility improvements
    setupAccessibility() {
        // Add ARIA labels and roles
        this.addAriaLabels();
        
        // Improve focus management
        this.improveFocusManagement();
        
        // Add screen reader announcements
        this.setupScreenReaderSupport();
    }
    
    addAriaLabels() {
        const elements = [
            { selector: '#message-input', label: 'Type your message' },
            { selector: '#send-btn', label: 'Send message' },
            { selector: '#connect-btn', label: 'Connect to room' },
            { selector: '#disconnect-btn', label: 'Disconnect from room' }
        ];
        
        elements.forEach(({ selector, label }) => {
            const element = document.querySelector(selector);
            if (element && !element.getAttribute('aria-label')) {
                element.setAttribute('aria-label', label);
            }
        });
    }
    
    improveFocusManagement() {
        // Trap focus in modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const activeModal = document.querySelector('.modal:not(.hidden)');
                if (activeModal) {
                    this.trapFocus(e, activeModal);
                }
            }
        });
    }
    
    trapFocus(e, container) {
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                lastFocusable.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                firstFocusable.focus();
                e.preventDefault();
            }
        }
    }
    
    setupScreenReaderSupport() {
        // Create live region for announcements
        const liveRegion = document.createElement('div');
        liveRegion.id = 'screen-reader-announcements';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.position = 'absolute';
        liveRegion.style.left = '-10000px';
        liveRegion.style.width = '1px';
        liveRegion.style.height = '1px';
        liveRegion.style.overflow = 'hidden';
        document.body.appendChild(liveRegion);
    }
    
    announceToScreenReader(message) {
        const liveRegion = document.getElementById('screen-reader-announcements');
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }
    
    // Connection status indicator
    setupConnectionIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'connection-indicator';
        indicator.className = 'connection-indicator';
        indicator.innerHTML = '<div class="indicator-dot"></div>';
        
        const container = document.querySelector('.container');
        if (container) {
            container.appendChild(indicator);
        }
    }
    
    updateConnectionUI(isOnline) {
        const indicator = document.getElementById('connection-indicator');
        if (indicator) {
            const dot = indicator.querySelector('.indicator-dot');
            dot.className = `indicator-dot ${isOnline ? 'online' : 'offline'}`;
            indicator.title = isOnline ? 'Online' : 'Offline';
        }
    }
    
    // Progress indicators
    setupProgressIndicators() {
        this.createLoadingOverlay();
    }
    
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay hidden';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p class="loading-text">Connecting...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    
    showLoading(text = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.querySelector('.loading-text').textContent = text;
            overlay.classList.remove('hidden');
        }
    }
    
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
    
    // Tooltips
    setupTooltips() {
        document.addEventListener('mouseover', (e) => {
            if (e.target.hasAttribute('title') && !e.target.querySelector('.tooltip')) {
                this.showTooltip(e.target);
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            if (e.target.hasAttribute('title')) {
                this.hideTooltip(e.target);
            }
        });
    }
    
    showTooltip(element) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = element.getAttribute('title');
        
        element.appendChild(tooltip);
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
        tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
    }
    
    hideTooltip(element) {
        const tooltip = element.querySelector('.tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }
    
    // Utility methods
    vibrate(pattern = [100]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    // Cleanup
    destroy() {
        // Remove event listeners and cleanup resources
        window.removeEventListener('online', this.onlineHandler);
        window.removeEventListener('offline', this.offlineHandler);
        
        // Remove UI elements
        const elementsToRemove = [
            '#install-app-btn',
            '#theme-toggle',
            '#sound-toggle',
            '#connection-indicator',
            '#loading-overlay',
            '#notification-container'
        ];
        
        elementsToRemove.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.remove();
            }
        });
    }
}

// CSS for UI enhancements (to be added to styles)
const enhancementStyles = `
/* Notification System */
.notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
}

.notification {
    background: #1a1f29;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 10px;
    border-left: 4px solid;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease;
}

.notification-success { border-left-color: #28a745; }
.notification-error { border-left-color: #dc3545; }
.notification-warning { border-left-color: #ffc107; }
.notification-info { border-left-color: #0088cc; }

.notification-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.notification-close {
    background: none;
    border: none;
    color: #8899a6;
    cursor: pointer;
    font-size: 1.2rem;
    margin-left: auto;
}

/* Update Banner */
.update-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #0088cc;
    color: white;
    padding: 10px;
    text-align: center;
    z-index: 1001;
}

.update-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
}

/* Connection Indicator */
.connection-indicator {
    position: fixed;
    top: 15px;
    left: 15px;
    z-index: 999;
}

.indicator-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #dc3545;
    transition: background-color 0.3s ease;
}

.indicator-dot.online { background: #28a745; }
.indicator-dot.offline { background: #dc3545; }

/* Loading Overlay */
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 20, 25, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1002;
}

.loading-content {
    text-align: center;
    color: white;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #2a3441;
    border-top: 4px solid #0088cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px;
}

/* Theme Toggle */
.theme-toggle, .sound-toggle, .install-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    min-width: 40px;
    height: 40px;
    padding: 8px;
}

.sound-toggle { right: 60px; }
.install-btn { right: 110px; }

/* Keyboard Shortcuts Modal */
.shortcuts-list {
    display: grid;
    gap: 10px;
}

.shortcut-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #2a3441;
}

kbd {
    background: #2a3441;
    border: 1px solid #3a4551;
    border-radius: 4px;
    padding: 4px 8px;
    font-family: monospace;
    font-size: 0.9rem;
}

/* Tooltips */
.tooltip {
    position: fixed;
    background: #1a1f29;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 0.8rem;
    z-index: 1003;
    pointer-events: none;
    animation: fadeIn 0.2s ease;
}

/* Light Theme */
[data-theme="light"] {
    background: #ffffff;
    color: #333333;
}

[data-theme="light"] .panel {
    background: #f8f9fa;
    border-color: #dee2e6;
}

[data-theme="light"] .notification {
    background: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Animations */
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* Mobile Responsiveness */
@media (max-width: 600px) {
    .notification-container {
        left: 10px;
        right: 10px;
    }
    
    .notification {
        width: 100%;
    }
    
    .theme-toggle, .sound-toggle, .install-btn {
        position: relative;
        top: auto;
        right: auto;
        margin: 5px;
    }
}
`;

// Add styles to document
if (!document.getElementById('ui-enhancement-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'ui-enhancement-styles';
    styleSheet.textContent = enhancementStyles;
    document.head.appendChild(styleSheet);
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIEnhancements;
} else {
    window.UIEnhancements = UIEnhancements;
}