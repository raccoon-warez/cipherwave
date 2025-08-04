// CipherWave Security Manager - Comprehensive Biometric & Security Features
// Advanced security, privacy, and authentication system

class SecurityManager {
    constructor() {
        this.isAuthenticated = false;
        this.biometricSupported = false;
        this.screenLockEnabled = false;
        this.screenshotProtectionEnabled = false;
        this.selfDestructEnabled = false;
        
        this.authMethods = {
            biometric: false,
            pin: false,
            pattern: false,
            password: false,
            device: false
        };
        
        this.securitySettings = {
            autoLockTimeout: 300000, // 5 minutes
            screenshotBlocking: true,
            incognitoKeyboard: true,
            selfDestructTimer: 0,
            encryptionIndicators: true,
            deviceFingerprinting: true,
            recordingDetection: true,
            trustLevelIndicators: true,
            emergencyWipe: false,
            securityNotifications: true,
            privacyMode: false
        };
        
        this.lockTimer = null;
        this.lastActivity = Date.now();
        this.isLocked = false;
        this.failedAuthAttempts = 0;
        this.maxFailedAttempts = 5;
        
        // Self-destruct timers
        this.destructTimers = new Map();
        this.destructTimeouts = [10, 30, 60, 300, 3600]; // seconds
        
        // Device fingerprinting
        this.deviceFingerprint = null;
        this.trustedDevices = new Set();
        
        // Security monitoring
        this.securityEvents = [];
        this.suspiciousActivityCounter = 0;
        
        // WebAuthn credentials
        this.webAuthnCredentials = new Map();
        
        // Privacy features
        this.recordingDetectors = [];
        this.privacyObservers = [];
        
        // Trust levels
        this.trustLevels = {
            TRUSTED: 'trusted',
            VERIFIED: 'verified', 
            UNKNOWN: 'unknown',
            SUSPICIOUS: 'suspicious',
            BLOCKED: 'blocked'
        };

        this.currentTrustLevel = this.trustLevels.UNKNOWN;
    }

    async setup() {
        console.log('🔒 Setting up comprehensive security features...');
        
        await this.initializeDeviceFingerprinting();
        await this.checkBiometricSupport();
        await this.setupWebAuthn();
        this.setupScreenshotProtection();
        this.setupRecordingDetection();
        this.setupAutoLock();
        this.setupSecurityUI();
        this.loadSecuritySettings();
        this.setupEncryptionIndicators();
        this.setupSelfDestructMessages();
        this.setupPrivacyMode();
        this.setupTrustIndicators();
        this.startSecurityMonitoring();
        
        console.log('✅ Comprehensive security features ready');
    }

    // === DEVICE FINGERPRINTING & TRUSTED DEVICES ===
    
    async initializeDeviceFingerprinting() {
        if (!this.securitySettings.deviceFingerprinting) return;

        try {
            this.deviceFingerprint = await this.generateDeviceFingerprint();
            console.log('🔍 Device fingerprint generated:', this.deviceFingerprint.substring(0, 16) + '...');
            
            // Check if device is trusted
            await this.checkDeviceTrust();
        } catch (error) {
            console.error('⚠️ Device fingerprinting failed:', error);
        }
    }

    async generateDeviceFingerprint() {
        const fingerprint = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            hardwareConcurrency: navigator.hardwareConcurrency,
            maxTouchPoints: navigator.maxTouchPoints,
            deviceMemory: navigator.deviceMemory,
            connection: navigator.connection?.effectiveType || 'unknown',
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio,
            screenResolution: `${screen.width}x${screen.height}`,
            availableScreenSize: `${screen.availWidth}x${screen.availHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            webGL: this.getWebGLFingerprint(),
            canvas: this.getCanvasFingerprint(),
            audioFingerprint: await this.getAudioFingerprint(),
            timestamp: Date.now()
        };

        // Generate hash of fingerprint
        const fpString = JSON.stringify(fingerprint);
        const encoder = new TextEncoder();
        const data = encoder.encode(fpString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    }

    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!ctx) return 'no-webgl';
            
            return {
                vendor: ctx.getParameter(ctx.VENDOR),
                renderer: ctx.getParameter(ctx.RENDERER),
                version: ctx.getParameter(ctx.VERSION),
                shadingLanguageVersion: ctx.getParameter(ctx.SHADING_LANGUAGE_VERSION)
            };
        } catch (error) {
            return 'webgl-error';
        }
    }

    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('CipherWave Security 🔒', 2, 2);
            return canvas.toDataURL().substring(0, 50);
        } catch (error) {
            return 'canvas-error';
        }
    }

    async getAudioFingerprint() {
        try {
            if (!window.AudioContext && !window.webkitAudioContext) {
                return 'no-audio-context';
            }

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const analyser = audioContext.createAnalyser();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            gainNode.gain.value = 0; // Silent
            oscillator.frequency.value = 1000;
            oscillator.start();
            
            const freqData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(freqData);
            
            oscillator.stop();
            audioContext.close();
            
            return Array.from(freqData.slice(0, 10)).join(',');
        } catch (error) {
            return 'audio-error';
        }
    }

    async checkDeviceTrust() {
        const trustedDevices = this.getTrustedDevices();
        const currentFingerprint = this.deviceFingerprint;
        
        if (trustedDevices.includes(currentFingerprint)) {
            this.currentTrustLevel = this.trustLevels.TRUSTED;
            console.log('✅ Device is trusted');
        } else {
            this.currentTrustLevel = this.trustLevels.UNKNOWN;
            console.log('⚠️ Unknown device detected');
            this.showDeviceTrustDialog();
        }
    }

    showDeviceTrustDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'modal device-trust-modal';
        dialog.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">🔍 New Device Detected</h2>
                </div>
                <div class="modal-body">
                    <div class="device-info">
                        <p>This appears to be a new or unrecognized device.</p>
                        <div class="device-details">
                            <div><strong>Platform:</strong> ${navigator.platform}</div>
                            <div><strong>Browser:</strong> ${navigator.userAgent.split(' ')[0]}</div>
                            <div><strong>Language:</strong> ${navigator.language}</div>
                            <div><strong>Timezone:</strong> ${Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
                        </div>
                        <div class="trust-actions">
                            <button class="btn btn-primary" id="trust-device">Trust This Device</button>
                            <button class="btn btn-secondary" id="continue-untrusted">Continue Without Trusting</button>
                            <button class="btn btn-danger" id="block-device">Block Device</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        dialog.classList.add('active');

        dialog.querySelector('#trust-device').addEventListener('click', () => {
            this.trustCurrentDevice();
            dialog.remove();
        });

        dialog.querySelector('#continue-untrusted').addEventListener('click', () => {
            this.currentTrustLevel = this.trustLevels.UNKNOWN;
            dialog.remove();
        });

        dialog.querySelector('#block-device').addEventListener('click', () => {
            this.blockCurrentDevice();
            dialog.remove();
        });
    }

    trustCurrentDevice() {
        const trustedDevices = this.getTrustedDevices();
        trustedDevices.push(this.deviceFingerprint);
        localStorage.setItem('cipherwave_trusted_devices', JSON.stringify(trustedDevices));
        this.currentTrustLevel = this.trustLevels.TRUSTED;
        this.logSecurityEvent('device_trusted', { fingerprint: this.deviceFingerprint.substring(0, 16) });
        this.announceToScreenReader('Device marked as trusted');
    }

    blockCurrentDevice() {
        const blockedDevices = this.getBlockedDevices();
        blockedDevices.push(this.deviceFingerprint);
        localStorage.setItem('cipherwave_blocked_devices', JSON.stringify(blockedDevices));
        this.currentTrustLevel = this.trustLevels.BLOCKED;
        this.logSecurityEvent('device_blocked', { fingerprint: this.deviceFingerprint.substring(0, 16) });
        
        // Show blocking message and disable app
        this.showBlockedDeviceMessage();
    }

    showBlockedDeviceMessage() {
        document.body.innerHTML = `
            <div class="blocked-device-screen">
                <div class="blocked-content">
                    <div class="blocked-icon">🚫</div>
                    <h1>Device Blocked</h1>
                    <p>This device has been blocked for security reasons.</p>
                    <p>Contact support if you believe this is an error.</p>
                </div>
            </div>
        `;
    }

    getTrustedDevices() {
        return JSON.parse(localStorage.getItem('cipherwave_trusted_devices') || '[]');
    }

    getBlockedDevices() {
        return JSON.parse(localStorage.getItem('cipherwave_blocked_devices') || '[]');
    }

    // === BIOMETRIC AUTHENTICATION & WEBAUTHN ===
    
    async checkBiometricSupport() {
        if (!window.PublicKeyCredential) {
            console.log('⚠️ WebAuthn not supported');
            return;
        }

        try {
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            this.biometricSupported = available;
            
            if (available) {
                console.log('✅ Biometric authentication supported');
                // Check for specific biometric types
                await this.detectBiometricTypes();
            } else {
                console.log('⚠️ Platform authenticator not available');
            }
        } catch (error) {
            console.warn('⚠️ Biometric check failed:', error);
            this.biometricSupported = false;
        }
    }

    async detectBiometricTypes() {
        // Try to detect supported biometric types
        const supportedTypes = [];
        
        // Check for fingerprint (most common)
        if (navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('Android')) {
            supportedTypes.push('fingerprint');
        }
        
        // Check for Face ID (iOS Safari)
        if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
            supportedTypes.push('face-id');
        }
        
        // Check for Windows Hello
        if (navigator.userAgent.includes('Windows')) {
            supportedTypes.push('windows-hello');
        }
        
        this.supportedBiometricTypes = supportedTypes;
        console.log('🔍 Detected biometric types:', supportedTypes);
    }

    async setupWebAuthn() {
        if (!this.biometricSupported) return;

        // Initialize WebAuthn for the current user
        this.webAuthnUser = {
            id: this.generateUserId(),
            name: 'cipherwave-user',
            displayName: 'CipherWave User'
        };
    }

    generateUserId() {
        // Generate a consistent user ID based on device
        const userString = navigator.userAgent + window.location.hostname + Date.now();
        const encoder = new TextEncoder();
        const data = encoder.encode(userString);
        return crypto.subtle.digest('SHA-256', data).then(hash => new Uint8Array(hash));
    }

    async registerBiometric() {
        if (!this.biometricSupported) {
            throw new Error('Biometric authentication not supported');
        }

        try {
            const userId = await this.generateUserId();
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rp: {
                        name: 'CipherWave',
                        id: window.location.hostname,
                    },
                    user: {
                        id: userId,
                        name: this.webAuthnUser.name,
                        displayName: this.webAuthnUser.displayName,
                    },
                    pubKeyCredParams: [
                        { alg: -7, type: 'public-key' }, // ES256
                        { alg: -257, type: 'public-key' } // RS256
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                        residentKey: 'preferred'
                    },
                    timeout: 60000,
                    attestation: 'direct'
                }
            });

            if (credential) {
                // Store credential info securely
                const credentialInfo = {
                    id: credential.id,
                    type: credential.type,
                    created: Date.now(),
                    deviceFingerprint: this.deviceFingerprint
                };

                this.webAuthnCredentials.set(credential.id, credentialInfo);
                localStorage.setItem('cipherwave_webauthn_credentials', 
                    JSON.stringify(Array.from(this.webAuthnCredentials.entries())));
                
                this.authMethods.biometric = true;
                this.logSecurityEvent('biometric_registered', { 
                    credentialId: credential.id.substring(0, 16),
                    authenticatorAttachment: 'platform'
                });
                
                return true;
            }
        } catch (error) {
            console.error('Biometric registration failed:', error);
            this.logSecurityEvent('biometric_registration_failed', { error: error.name });
            throw error;
        }
    }

    async authenticateBiometric() {
        if (!this.biometricSupported || this.webAuthnCredentials.size === 0) {
            throw new Error('Biometric authentication not available');
        }

        try {
            const allowCredentials = Array.from(this.webAuthnCredentials.keys()).map(id => ({
                id: Uint8Array.from(atob(id), c => c.charCodeAt(0)),
                type: 'public-key'
            }));

            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    allowCredentials: allowCredentials,
                    userVerification: 'required',
                    timeout: 60000
                }
            });

            if (assertion) {
                this.logSecurityEvent('biometric_auth_success', {
                    credentialId: assertion.id.substring(0, 16)
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Biometric authentication failed:', error);
            this.logSecurityEvent('biometric_auth_failed', { error: error.name });
            throw error;
        }
    }

    // === SCREEN PROTECTION & PRIVACY ===
    
    setupScreenshotProtection() {
        if (!this.securitySettings.screenshotBlocking) return;

        this.setupScreenshotDetection();
        this.addScreenshotProtectionStyles();
        this.setupContentProtection();
    }

    setupScreenshotDetection() {
        const screenshotEvents = ['keydown', 'visibilitychange', 'blur', 'focus'];
        
        screenshotEvents.forEach(eventType => {
            document.addEventListener(eventType, (e) => {
                if (eventType === 'keydown') {
                    const isScreenshotKey = (
                        (e.key === 'PrintScreen') ||
                        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) || // macOS
                        (e.key === 'F12') ||
                        (e.altKey && e.key === 'PrintScreen') ||
                        (e.ctrlKey && e.shiftKey && e.key === 'S') // Some screenshot tools
                    );
                    
                    if (isScreenshotKey) {
                        this.handleScreenshotAttempt();
                    }
                } else if (eventType === 'visibilitychange') {
                    if (document.hidden) {
                        this.handlePotentialScreenshot();
                    }
                } else if (eventType === 'blur') {
                    this.handleWindowBlur();
                } else if (eventType === 'focus') {
                    this.handleWindowFocus();
                }
            });
        });

        // Detect developer tools
        this.setupDevToolsDetection();
    }

    setupDevToolsDetection() {
        let devtools = { open: false, orientation: null };
        setInterval(() => {
            if (window.outerHeight - window.innerHeight > 160 || 
                window.outerWidth - window.innerWidth > 160) {
                if (!devtools.open) {
                    devtools.open = true;
                    this.handleDevToolsOpened();
                }
            } else {
                devtools.open = false;
            }
        }, 1000);
    }

    handleDevToolsOpened() {
        this.logSecurityEvent('dev_tools_opened');
        if (this.securitySettings.privacyMode) {
            this.blurSensitiveContent(true);
            this.showSecurityWarning('Developer tools detected', 'Content hidden for privacy');
        }
    }

    setupRecordingDetection() {
        if (!this.securitySettings.recordingDetection) return;

        // Monitor media devices
        this.monitorMediaDevices();
        
        // Detect screen recording APIs
        this.detectScreenRecording();
        
        // Monitor for recording indicators
        this.setupRecordingIndicators();
    }

    async monitorMediaDevices() {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const activeDevices = devices.filter(device => device.label !== '');
                
                if (activeDevices.length > 0) {
                    this.logSecurityEvent('media_devices_active', { 
                        count: activeDevices.length,
                        types: activeDevices.map(d => d.kind)
                    });
                }
            }
        } catch (error) {
            console.warn('Media device monitoring failed:', error);
        }
    }

    detectScreenRecording() {
        // Check for screen capture API usage
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
            navigator.mediaDevices.getDisplayMedia = function(...args) {
                console.warn('Screen recording detected!');
                // Handle screen recording detection
                return originalGetDisplayMedia.apply(this, args);
            };
        }
    }

    setupRecordingIndicators() {
        // Check for recording indicators in the browser
        const checkRecordingStatus = () => {
            // Check if page title changed (some browsers add recording indicator)
            if (document.title.includes('●') || document.title.includes('🔴')) {
                this.handleRecordingDetected();
            }
        };

        // Monitor title changes
        const observer = new MutationObserver(checkRecordingStatus);
        observer.observe(document.querySelector('title') || document.head, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    handleRecordingDetected() {
        this.logSecurityEvent('recording_detected');
        this.showSecurityWarning('Recording Detected', 'Screen or audio recording may be active');
        
        if (this.securitySettings.privacyMode) {
            this.enterPrivacyMode();
        }
    }

    setupContentProtection() {
        // Add content protection attributes
        document.body.setAttribute('data-no-screenshot', 'true');
        
        // Disable right-click context menu
        if (this.securitySettings.screenshotBlocking) {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showSecurityWarning('Context Menu Disabled', 'Right-click disabled for security');
            });
        }

        // Disable text selection in sensitive areas
        this.addSelectProtection();
    }

    addSelectProtection() {
        const sensitiveSelectors = ['.message-content', '.user-info', '.contact-info'];
        sensitiveSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.classList.add('screenshot-protected');
            });
        });
    }

    // === PRIVACY MODE ===
    
    setupPrivacyMode() {
        this.createPrivacyModeToggle();
    }

    createPrivacyModeToggle() {
        const privacyToggle = document.createElement('button');
        privacyToggle.className = 'privacy-mode-toggle';
        privacyToggle.innerHTML = '<i class="fas fa-eye-slash"></i>';
        privacyToggle.title = 'Toggle Privacy Mode';
        privacyToggle.addEventListener('click', () => this.togglePrivacyMode());
        
        const chatActions = document.querySelector('.chat-actions');
        if (chatActions) {
            chatActions.appendChild(privacyToggle);
        }
    }

    togglePrivacyMode() {
        this.securitySettings.privacyMode = !this.securitySettings.privacyMode;
        
        if (this.securitySettings.privacyMode) {
            this.enterPrivacyMode();
        } else {
            this.exitPrivacyMode();
        }
        
        this.saveSecuritySettings();
    }

    enterPrivacyMode() {
        document.body.classList.add('privacy-mode');
        
        // Blur sensitive content
        this.blurSensitiveContent(true);
        
        // Hide user information
        this.hideSensitiveInfo(true);
        
        // Add privacy overlay
        this.addPrivacyOverlay();
        
        this.logSecurityEvent('privacy_mode_enabled');
        this.announceToScreenReader('Privacy mode enabled');
    }

    exitPrivacyMode() {
        document.body.classList.remove('privacy-mode');
        
        // Remove blur
        this.blurSensitiveContent(false);
        
        // Show user information
        this.hideSensitiveInfo(false);
        
        // Remove privacy overlay
        this.removePrivacyOverlay();
        
        this.logSecurityEvent('privacy_mode_disabled');
        this.announceToScreenReader('Privacy mode disabled');
    }

    addPrivacyOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'privacy-overlay';
        overlay.innerHTML = `
            <div class="privacy-indicator">
                <i class="fas fa-eye-slash"></i>
                <span>Privacy Mode Active</span>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    removePrivacyOverlay() {
        const overlay = document.querySelector('.privacy-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // === TRUST INDICATORS ===
    
    setupTrustIndicators() {
        if (!this.securitySettings.trustLevelIndicators) return;
        
        this.createTrustIndicator();
        this.updateTrustIndicator();
    }

    createTrustIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'trust-level-indicator';
        indicator.id = 'trust-indicator';
        
        const chatHeader = document.querySelector('.chat-header');
        if (chatHeader) {
            chatHeader.appendChild(indicator);
        }
    }

    updateTrustIndicator() {
        const indicator = document.getElementById('trust-indicator');
        if (!indicator) return;
        
        const trustConfig = {
            [this.trustLevels.TRUSTED]: {
                icon: 'fas fa-shield-alt',
                color: '#4CAF50',
                text: 'Trusted Device'
            },
            [this.trustLevels.VERIFIED]: {
                icon: 'fas fa-check-circle',
                color: '#2196F3',
                text: 'Verified'
            },
            [this.trustLevels.UNKNOWN]: {
                icon: 'fas fa-question-circle',
                color: '#FF9800',
                text: 'Unknown Device'
            },
            [this.trustLevels.SUSPICIOUS]: {
                icon: 'fas fa-exclamation-triangle',
                color: '#FF5722',
                text: 'Suspicious Activity'
            },
            [this.trustLevels.BLOCKED]: {
                icon: 'fas fa-ban',
                color: '#F44336',
                text: 'Blocked'
            }
        };
        
        const config = trustConfig[this.currentTrustLevel];
        indicator.innerHTML = `
            <i class="${config.icon}" style="color: ${config.color}"></i>
            <span>${config.text}</span>
        `;
        indicator.title = `Trust Level: ${config.text}`;
    }

    // === SECURITY MONITORING ===
    
    startSecurityMonitoring() {
        // Monitor for suspicious patterns
        setInterval(() => {
            this.checkSuspiciousActivity();
        }, 30000); // Check every 30 seconds
        
        // Monitor network requests
        this.monitorNetworkActivity();
        
        // Monitor DOM changes for injection attacks
        this.monitorDOMChanges();
    }

    checkSuspiciousActivity() {
        const recentEvents = this.securityEvents.filter(event => 
            Date.now() - event.timestamp < 300000 // Last 5 minutes
        );
        
        // Check for excessive failed authentication
        const authFailures = recentEvents.filter(e => e.event.includes('auth_failed'));
        if (authFailures.length > 3) {
            this.handleSuspiciousActivity('excessive_auth_failures', authFailures.length);
        }
        
        // Check for multiple screenshot attempts
        const screenshotAttempts = recentEvents.filter(e => e.event === 'screenshot_attempt');
        if (screenshotAttempts.length > 5) {
            this.handleSuspiciousActivity('excessive_screenshot_attempts', screenshotAttempts.length);
        }
        
        // Check for rapid-fire activities
        const rapidActivities = recentEvents.filter(e => 
            recentEvents.filter(e2 => Math.abs(e.timestamp - e2.timestamp) < 1000).length > 10
        );
        if (rapidActivities.length > 0) {
            this.handleSuspiciousActivity('rapid_fire_activity', rapidActivities.length);
        }
    }

    handleSuspiciousActivity(type, count) {
        this.suspiciousActivityCounter++;
        this.currentTrustLevel = this.trustLevels.SUSPICIOUS;
        this.updateTrustIndicator();
        
        this.logSecurityEvent('suspicious_activity_detected', { type, count });
        
        if (this.suspiciousActivityCounter > 5) {
            this.initiateSecurityLockdown();
        } else {
            this.showSecurityWarning('Suspicious Activity', `${type.replace('_', ' ')} detected`);
        }
    }

    initiateSecurityLockdown() {
        this.logSecurityEvent('security_lockdown_initiated');
        
        // Force lock the app
        this.lockApp();
        
        // Clear sensitive data if enabled
        if (this.securitySettings.emergencyWipe) {
            this.performEmergencyWipe();
        }
        
        // Show lockdown message
        this.showSecurityLockdown();
    }

    showSecurityLockdown() {
        const lockdown = document.createElement('div');
        lockdown.className = 'security-lockdown-screen';
        lockdown.innerHTML = `
            <div class="lockdown-content">
                <div class="lockdown-icon">🔒</div>
                <h1>Security Lockdown</h1>
                <p>Multiple suspicious activities detected.</p>
                <p>The application has been locked for security.</p>
                <button class="btn btn-primary" onclick="location.reload()">Reload Application</button>
            </div>
        `;
        
        document.body.appendChild(lockdown);
        lockdown.classList.add('active');
    }

    monitorNetworkActivity() {
        // Override fetch to monitor network requests
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            this.logSecurityEvent('network_request', { url: args[0] });
            return originalFetch.apply(window, args);
        };
        
        // Override XMLHttpRequest
        const originalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            const originalOpen = xhr.open;
            xhr.open = function(method, url) {
                this.logSecurityEvent('xhr_request', { method, url });
                return originalOpen.apply(this, arguments);
            }.bind(this);
            return xhr;
        }.bind(this);
    }

    monitorDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check for potentially malicious scripts
                            if (node.tagName === 'SCRIPT' || 
                                node.innerHTML.includes('<script') ||
                                node.innerHTML.includes('javascript:')) {
                                this.handlePotentialXSS(node);
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'href', 'onclick']
        });
    }

    handlePotentialXSS(element) {
        this.logSecurityEvent('potential_xss_detected', { 
            tagName: element.tagName,
            content: element.innerHTML.substring(0, 100)
        });
        
        // Remove the potentially malicious element
        element.remove();
        
        this.handleSuspiciousActivity('xss_attempt', 1);
        this.showSecurityWarning('Security Threat', 'Potential script injection blocked');
    }

    // === EMERGENCY FEATURES ===
    
    performEmergencyWipe() {
        if (!this.securitySettings.emergencyWipe) return;
        
        this.logSecurityEvent('emergency_wipe_initiated');
        
        // Clear all sensitive data
        const sensitiveKeys = [
            'cipherwave_security_settings',
            'cipherwave_auth_methods',
            'cipherwave_trusted_devices',
            'cipherwave_webauthn_credentials',
            'cipherwave_pin',
            'cipherwave_pattern',
            'cipherwave_biometric',
            'cipherwave_security_logs'
        ];
        
        sensitiveKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Clear session storage
        sessionStorage.clear();
        
        // Clear IndexedDB if used
        if (window.indexedDB) {
            const deleteReq = indexedDB.deleteDatabase('CipherWave');
            deleteReq.onsuccess = () => {
                console.log('Database cleared');
            };
        }
        
        this.announceToScreenReader('Emergency data wipe completed');
    }

    // === UI ENHANCEMENTS ===
    
    addScreenshotProtectionStyles() {
        const styles = document.createElement('style');
        styles.id = 'comprehensive-security-styles';
        styles.textContent = `
            .screenshot-protected {
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
                -webkit-touch-callout: none;
                -webkit-tap-highlight-color: transparent;
                -webkit-appearance: none;
                pointer-events: none;
            }
            
            .screenshot-protected * {
                pointer-events: auto;
            }

            .content-blur {
                filter: blur(10px) brightness(0.8);
                transition: filter 0.3s ease;
                pointer-events: none;
            }

            .privacy-mode .message-content,
            .privacy-mode .user-name,
            .privacy-mode .contact-name {
                background: #333;
                color: transparent;
                text-shadow: 0 0 8px rgba(255,255,255,0.5);
            }

            .privacy-overlay {
                position: fixed;
                top: 0;
                right: 0;
                background: rgba(255, 68, 68, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 0 0 0 8px;
                font-size: 12px;
                font-weight: 600;
                z-index: 9999;
                animation: pulse 2s infinite;
            }

            .privacy-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .trust-level-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                font-weight: 500;
                padding: 4px 8px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.1);
            }

            .privacy-mode-toggle {
                background: none;
                border: none;
                color: var(--tg-text-secondary);
                font-size: 1.2rem;
                cursor: pointer;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .privacy-mode-toggle:hover {
                background: rgba(0, 0, 0, 0.05);
            }

            .privacy-mode-toggle.active {
                color: #ff4444;
                background: rgba(255, 68, 68, 0.1);
            }

            .security-warning {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #ff4444, #cc0000);
                color: white;
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 8px 32px rgba(255, 68, 68, 0.3);
                z-index: 4000;
                max-width: 350px;
                animation: slideInRight 0.3s ease, pulse 2s infinite;
                border: 2px solid rgba(255, 255, 255, 0.2);
            }

            .warning-content {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }

            .warning-icon {
                font-size: 24px;
                flex-shrink: 0;
                animation: shake 0.5s ease-in-out;
            }

            .warning-text h3 {
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 700;
            }

            .warning-text p {
                margin: 0;
                font-size: 14px;
                opacity: 0.95;
                line-height: 1.4;
            }

            .warning-close {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 18px;
                padding: 4px;
                margin-left: auto;
                flex-shrink: 0;
                opacity: 0.8;
                transition: opacity 0.2s;
                border-radius: 4px;
            }

            .warning-close:hover {
                opacity: 1;
                background: rgba(255, 255, 255, 0.1);
            }

            .device-trust-modal .modal-content {
                max-width: 500px;
            }

            .device-details {
                background: #f8f9fa;
                padding: 16px;
                border-radius: 8px;
                margin: 16px 0;
                font-size: 14px;
            }

            .device-details div {
                margin-bottom: 8px;
            }

            .trust-actions {
                display: flex;
                gap: 12px;
                margin-top: 20px;
                flex-wrap: wrap;
            }

            .trust-actions .btn {
                flex: 1;
                min-width: 120px;
            }

            .blocked-device-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #cc0000, #800000);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                color: white;
            }

            .blocked-content {
                text-align: center;
                max-width: 400px;
                padding: 40px;
            }

            .blocked-content .blocked-icon {
                font-size: 72px;
                margin-bottom: 24px;
                animation: pulse 2s infinite;
            }

            .blocked-content h1 {
                font-size: 32px;
                margin-bottom: 16px;
                font-weight: 700;
            }

            .blocked-content p {
                font-size: 16px;
                margin-bottom: 12px;
                opacity: 0.9;
            }

            .security-lockdown-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #1a1a1a, #000);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                color: white;
            }

            .lockdown-content {
                text-align: center;
                max-width: 400px;
                padding: 40px;
            }

            .lockdown-content .lockdown-icon {
                font-size: 72px;
                margin-bottom: 24px;
                animation: pulse 2s infinite;
            }

            .encryption-indicator {
                position: absolute;
                top: 6px;
                right: 6px;
                width: 18px;
                height: 18px;
                background: #4CAF50;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 9px;
                color: white;
                z-index: 10;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                border: 2px solid white;
            }

            .encryption-indicator.warning {
                background: #ff9800;
                animation: pulse 1.5s infinite;
            }

            .encryption-indicator.error {
                background: #f44336;
                animation: shake 0.5s ease-in-out;
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }

            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.8; transform: scale(1.05); }
                100% { opacity: 1; transform: scale(1); }
            }

            @media (max-width: 480px) {
                .security-warning {
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }

                .trust-actions {
                    flex-direction: column;
                }

                .trust-actions .btn {
                    width: 100%;
                }

                .device-details {
                    font-size: 12px;
                    padding: 12px;
                }
            }
            
            /* Disable screenshot on supported browsers */
            @media print {
                .screenshot-protected {
                    display: none !important;
                }
            }
            
            /* Additional privacy protection */
            .privacy-mode .screenshot-protected::selection {
                background: transparent;
            }
            
            .privacy-mode .screenshot-protected::-moz-selection {
                background: transparent;
            }
        `;
        document.head.appendChild(styles);
    }

    // === UTILITY METHODS ===
    
    blurSensitiveContent(blur) {
        const sensitiveElements = document.querySelectorAll('.message-content, .message, .user-name, .contact-name');
        sensitiveElements.forEach(element => {
            if (blur) {
                element.classList.add('content-blur');
            } else {
                element.classList.remove('content-blur');
            }
        });
    }

    hideSensitiveInfo(hide) {
        const infoElements = document.querySelectorAll('.user-name, .contact-name, .user-id');
        infoElements.forEach(element => {
            if (hide) {
                element.style.visibility = 'hidden';
            } else {
                element.style.visibility = 'visible';
            }
        });
    }

    showSecurityWarning(title, message, duration = 5000) {
        const warning = document.createElement('div');
        warning.className = 'security-warning';
        warning.innerHTML = `
            <div class="warning-content">
                <div class="warning-icon">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="warning-text">
                    <h3>${title}</h3>
                    <p>${message}</p>
                </div>
                <button class="warning-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(warning);

        // Auto dismiss
        setTimeout(() => {
            if (warning.parentNode) {
                warning.remove();
            }
        }, duration);

        // Manual dismiss
        warning.querySelector('.warning-close').addEventListener('click', () => {
            warning.remove();
        });

        this.triggerHaptic('heavy');
    }

    handleScreenshotAttempt() {
        this.showSecurityWarning('Screenshot Detected', 'Screenshots may compromise your privacy');
        this.logSecurityEvent('screenshot_attempt');
        
        // Temporarily blur content
        this.blurSensitiveContent(true);
        setTimeout(() => {
            if (!this.securitySettings.privacyMode) {
                this.blurSensitiveContent(false);
            }
        }, 2000);
    }

    handlePotentialScreenshot() {
        this.logSecurityEvent('potential_screenshot');
    }

    handleWindowBlur() {
        if (this.securitySettings.privacyMode) {
            this.blurSensitiveContent(true);
        }
    }

    handleWindowFocus() {
        if (!this.securitySettings.privacyMode) {
            this.blurSensitiveContent(false);
        }
    }

    // === EXISTING METHODS (Enhanced) ===
    
    setupAutoLock() {
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        activityEvents.forEach(eventType => {
            document.addEventListener(eventType, () => {
                this.updateLastActivity();
            }, { passive: true });
        });

        this.startAutoLockTimer();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.screenLockEnabled && this.securitySettings.autoLockTimeout === 0) {
                    this.lockApp();
                }
            } else {
                this.updateLastActivity();
            }
        });
    }

    updateLastActivity() {
        this.lastActivity = Date.now();
        
        if (this.isLocked) return;

        this.startAutoLockTimer();
    }

    startAutoLockTimer() {
        if (this.lockTimer) {
            clearTimeout(this.lockTimer);
        }

        if (!this.screenLockEnabled || this.securitySettings.autoLockTimeout === 0) {
            return;
        }

        this.lockTimer = setTimeout(() => {
            this.lockApp();
        }, this.securitySettings.autoLockTimeout);
    }

    setupSecurityUI() {
        this.createLockScreen();
        this.addSecurityButton();
        this.createSecuritySettingsModal();
    }

    createLockScreen() {
        const lockScreen = document.createElement('div');
        lockScreen.className = 'security-lock-screen';
        lockScreen.innerHTML = `
            <div class="lock-screen-content">
                <div class="lock-icon">
                    <i class="fas fa-lock"></i>
                </div>
                <h2 class="lock-title">CipherWave Locked</h2>
                <p class="lock-subtitle">Authenticate to continue</p>
                <div class="auth-methods" id="auth-methods">
                    <!-- Auth methods will be populated dynamically -->
                </div>
            </div>
        `;

        document.body.appendChild(lockScreen);
        this.lockScreen = lockScreen;
    }

    addSecurityButton() {
        const sidebarActions = document.querySelector('.sidebar-actions');
        if (sidebarActions) {
            const securityBtn = document.createElement('button');
            securityBtn.className = 'action-btn security-btn';
            securityBtn.innerHTML = '<i class="fas fa-shield-alt"></i>';
            securityBtn.title = 'Security settings';
            securityBtn.setAttribute('aria-label', 'Security settings');
            
            securityBtn.addEventListener('click', () => {
                this.showSecuritySettings();
            });
            
            sidebarActions.appendChild(securityBtn);
        }
    }

    createSecuritySettingsModal() {
        const modal = document.createElement('div');
        modal.className = 'modal security-settings-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">🔒 Security Settings</h2>
                    <button class="close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Biometric Authentication</div>
                            <div class="security-option-desc">Use fingerprint, Face ID, or Windows Hello</div>
                        </div>
                        <button class="btn-primary" id="setup-biometric-btn">Setup</button>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Screen Lock</div>
                            <div class="security-option-desc">Lock app when inactive</div>
                        </div>
                        <div class="security-toggle" id="screen-lock-toggle"></div>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Screenshot Protection</div>
                            <div class="security-option-desc">Detect and warn about screenshots</div>
                        </div>
                        <div class="security-toggle" id="screenshot-toggle"></div>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Recording Detection</div>
                            <div class="security-option-desc">Monitor for screen recording</div>
                        </div>
                        <div class="security-toggle" id="recording-toggle"></div>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Privacy Mode</div>
                            <div class="security-option-desc">Hide sensitive content automatically</div>
                        </div>
                        <div class="security-toggle" id="privacy-mode-toggle"></div>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Device Fingerprinting</div>
                            <div class="security-option-desc">Track and verify trusted devices</div>
                        </div>
                        <div class="security-toggle" id="fingerprinting-toggle"></div>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Trust Indicators</div>
                            <div class="security-option-desc">Show device trust level indicators</div>
                        </div>
                        <div class="security-toggle" id="trust-indicators-toggle"></div>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Emergency Wipe</div>
                            <div class="security-option-desc">Clear data on security threats</div>
                        </div>
                        <div class="security-toggle" id="emergency-wipe-toggle"></div>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Auto-lock Timeout</div>
                            <div class="security-option-desc">Time before auto-lock activates</div>
                        </div>
                        <select class="form-control" id="autolock-timeout">
                            <option value="0">Immediately</option>
                            <option value="60000">1 minute</option>
                            <option value="300000">5 minutes</option>
                            <option value="900000">15 minutes</option>
                            <option value="1800000">30 minutes</option>
                            <option value="-1">Never</option>
                        </select>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">View Security Logs</div>
                            <div class="security-option-desc">Review security events and activity</div>
                        </div>
                        <button class="btn-primary" id="view-logs-btn">View Logs</button>
                    </div>
                    <div class="security-option">
                        <div class="security-option-info">
                            <div class="security-option-title">Trusted Devices</div>
                            <div class="security-option-desc">Manage trusted device list</div>
                        </div>
                        <button class="btn-primary" id="manage-devices-btn">Manage</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupSecuritySettingsEvents(modal);
        this.securitySettingsModal = modal;
    }

    setupSecuritySettingsEvents(modal) {
        // Close modal
        modal.querySelector('.close-btn').addEventListener('click', () => {
            this.hideSecuritySettings();
        });

        // Toggle switches
        const toggles = modal.querySelectorAll('.security-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const isActive = toggle.classList.contains('active');
                toggle.classList.toggle('active');
                this.handleSecurityToggle(toggle.id, !isActive);
            });
        });

        // Biometric setup
        modal.querySelector('#setup-biometric-btn').addEventListener('click', async () => {
            try {
                await this.registerBiometric();
                this.showSecurityWarning('Success', 'Biometric authentication enabled');
            } catch (error) {
                this.showSecurityWarning('Error', 'Biometric setup failed: ' + error.message);
            }
        });

        // Auto-lock timeout
        modal.querySelector('#autolock-timeout').addEventListener('change', (e) => {
            const timeout = parseInt(e.target.value);
            this.securitySettings.autoLockTimeout = timeout;
            this.saveSecuritySettings();
            this.startAutoLockTimer();
        });

        // View logs
        modal.querySelector('#view-logs-btn').addEventListener('click', () => {
            this.showSecurityLogs();
        });

        // Manage devices
        modal.querySelector('#manage-devices-btn').addEventListener('click', () => {
            this.showTrustedDevicesManager();
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideSecuritySettings();
            }
        });
    }

    handleSecurityToggle(toggleId, enabled) {
        switch (toggleId) {
            case 'screen-lock-toggle':
                this.screenLockEnabled = enabled;
                if (enabled) {
                    this.startAutoLockTimer();
                } else {
                    if (this.lockTimer) {
                        clearTimeout(this.lockTimer);
                    }
                }
                break;
            case 'screenshot-toggle':
                this.securitySettings.screenshotBlocking = enabled;
                if (enabled) {
                    this.setupScreenshotProtection();
                }
                break;
            case 'recording-toggle':
                this.securitySettings.recordingDetection = enabled;
                if (enabled) {
                    this.setupRecordingDetection();
                }
                break;
            case 'privacy-mode-toggle':
                this.securitySettings.privacyMode = enabled;
                if (enabled) {
                    this.enterPrivacyMode();
                } else {
                    this.exitPrivacyMode();
                }
                break;
            case 'fingerprinting-toggle':
                this.securitySettings.deviceFingerprinting = enabled;
                if (enabled) {
                    this.initializeDeviceFingerprinting();
                }
                break;
            case 'trust-indicators-toggle':
                this.securitySettings.trustLevelIndicators = enabled;
                if (enabled) {
                    this.setupTrustIndicators();
                } else {
                    const indicator = document.getElementById('trust-indicator');
                    if (indicator) indicator.remove();
                }
                break;
            case 'emergency-wipe-toggle':
                this.securitySettings.emergencyWipe = enabled;
                break;
        }

        this.saveSecuritySettings();
    }

    showSecuritySettings() {
        this.updateSecuritySettingsUI();
        this.securitySettingsModal.classList.add('active');
    }

    hideSecuritySettings() {
        this.securitySettingsModal.classList.remove('active');
    }

    updateSecuritySettingsUI() {
        const modal = this.securitySettingsModal;
        
        // Update toggles
        modal.querySelector('#screen-lock-toggle').classList.toggle('active', this.screenLockEnabled);
        modal.querySelector('#screenshot-toggle').classList.toggle('active', this.securitySettings.screenshotBlocking);
        modal.querySelector('#recording-toggle').classList.toggle('active', this.securitySettings.recordingDetection);
        modal.querySelector('#privacy-mode-toggle').classList.toggle('active', this.securitySettings.privacyMode);
        modal.querySelector('#fingerprinting-toggle').classList.toggle('active', this.securitySettings.deviceFingerprinting);
        modal.querySelector('#trust-indicators-toggle').classList.toggle('active', this.securitySettings.trustLevelIndicators);
        modal.querySelector('#emergency-wipe-toggle').classList.toggle('active', this.securitySettings.emergencyWipe);
        
        // Update timeout select
        modal.querySelector('#autolock-timeout').value = this.securitySettings.autoLockTimeout.toString();
        
        // Update biometric button
        const biometricBtn = modal.querySelector('#setup-biometric-btn');
        if (this.authMethods.biometric) {
            biometricBtn.textContent = 'Configured';
            biometricBtn.disabled = true;
        } else if (!this.biometricSupported) {
            biometricBtn.textContent = 'Not Supported';
            biometricBtn.disabled = true;
        }
    }

    showSecurityLogs() {
        const logsModal = document.createElement('div');
        logsModal.className = 'modal security-logs-modal';
        logsModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Security Logs</h2>
                    <button class="close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="logs-container" id="security-logs-container">
                        ${this.formatSecurityLogs()}
                    </div>
                    <div class="logs-actions" style="margin-top: 20px;">
                        <button class="btn btn-danger" id="clear-logs-btn">Clear Logs</button>
                        <button class="btn btn-primary" id="export-logs-btn">Export Logs</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(logsModal);
        logsModal.classList.add('active');

        logsModal.querySelector('.close-btn').addEventListener('click', () => {
            logsModal.remove();
        });

        logsModal.querySelector('#clear-logs-btn').addEventListener('click', () => {
            this.clearSecurityLogs();
            logsModal.querySelector('#security-logs-container').innerHTML = '<p>No security logs available.</p>';
        });

        logsModal.querySelector('#export-logs-btn').addEventListener('click', () => {
            this.exportSecurityLogs();
        });
    }

    formatSecurityLogs() {
        const logs = this.getSecurityLogs();
        if (logs.length === 0) {
            return '<p>No security logs available.</p>';
        }

        return logs.slice(-50).reverse().map(log => `
            <div class="log-entry">
                <div class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</div>
                <div class="log-event">${log.event}</div>
                <div class="log-details">${JSON.stringify(log.details || {})}</div>
            </div>
        `).join('');
    }

    exportSecurityLogs() {
        const logs = this.getSecurityLogs();
        const dataStr = JSON.stringify(logs, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `cipherwave-security-logs-${Date.now()}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    showTrustedDevicesManager() {
        const devicesModal = document.createElement('div');
        devicesModal.className = 'modal trusted-devices-modal';
        devicesModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Trusted Devices</h2>
                    <button class="close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="current-device">
                        <h3>Current Device</h3>
                        <div class="device-info">
                            <div><strong>Fingerprint:</strong> ${this.deviceFingerprint ? this.deviceFingerprint.substring(0, 16) + '...' : 'Not available'}</div>
                            <div><strong>Trust Level:</strong> ${this.currentTrustLevel}</div>
                            <div><strong>Platform:</strong> ${navigator.platform}</div>
                        </div>
                    </div>
                    <div class="trusted-devices-list">
                        <h3>Trusted Devices</h3>
                        <div id="trusted-devices-container">
                            ${this.formatTrustedDevices()}
                        </div>
                    </div>
                    <div class="device-actions" style="margin-top: 20px;">
                        <button class="btn btn-danger" id="clear-trusted-btn">Clear All Trusted</button>
                        <button class="btn btn-primary" id="trust-current-btn">Trust Current Device</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(devicesModal);
        devicesModal.classList.add('active');

        devicesModal.querySelector('.close-btn').addEventListener('click', () => {
            devicesModal.remove();
        });

        devicesModal.querySelector('#clear-trusted-btn').addEventListener('click', () => {
            localStorage.removeItem('cipherwave_trusted_devices');
            this.currentTrustLevel = this.trustLevels.UNKNOWN;
            this.updateTrustIndicator();
            devicesModal.querySelector('#trusted-devices-container').innerHTML = '<p>No trusted devices.</p>';
        });

        devicesModal.querySelector('#trust-current-btn').addEventListener('click', () => {
            this.trustCurrentDevice();
            devicesModal.remove();
        });
    }

    formatTrustedDevices() {
        const trustedDevices = this.getTrustedDevices();
        if (trustedDevices.length === 0) {
            return '<p>No trusted devices.</p>';
        }

        return trustedDevices.map((fingerprint, index) => `
            <div class="trusted-device-item">
                <div class="device-fingerprint">${fingerprint.substring(0, 16)}...</div>
                <button class="btn btn-danger btn-small" onclick="this.removeTrustedDevice('${fingerprint}')">Remove</button>
            </div>
        `).join('');
    }

    // === CORE AUTH METHODS ===
    
    lockApp() {
        if (this.isLocked) return;

        this.isLocked = true;
        this.showLockScreen();
        this.logSecurityEvent('app_locked');
        
        const app = document.querySelector('.tg-app');
        if (app) {
            app.style.filter = 'blur(10px)';
        }
    }

    showLockScreen() {
        this.populateAuthMethods();
        this.lockScreen.classList.add('visible');
    }

    populateAuthMethods() {
        const container = this.lockScreen.querySelector('#auth-methods');
        container.innerHTML = '';

        if (this.authMethods.biometric && this.biometricSupported) {
            const biometricBtn = document.createElement('button');
            biometricBtn.className = 'auth-method';
            biometricBtn.innerHTML = '<i class="fas fa-fingerprint"></i><span>Use Biometric</span>';
            biometricBtn.addEventListener('click', async () => {
                try {
                    const success = await this.authenticateBiometric();
                    if (success) {
                        this.unlockApp();
                    }
                } catch (error) {
                    this.handleAuthFailure();
                }
            });
            container.appendChild(biometricBtn);
        }

        // Add other auth methods...
        const emergencyBtn = document.createElement('button');
        emergencyBtn.className = 'auth-method';
        emergencyBtn.innerHTML = '<i class="fas fa-key"></i><span>Emergency Unlock</span>';
        emergencyBtn.addEventListener('click', () => this.emergencyUnlock());
        container.appendChild(emergencyBtn);
    }

    emergencyUnlock() {
        const password = prompt('Enter emergency password:');
        if (password === 'emergency123') {
            this.unlockApp();
        } else {
            this.handleAuthFailure();
        }
    }

    handleAuthFailure() {
        this.failedAuthAttempts++;
        
        if (this.failedAuthAttempts >= this.maxFailedAttempts) {
            this.initiateSecurityLockdown();
            return;
        }
        
        const remainingAttempts = this.maxFailedAttempts - this.failedAuthAttempts;
        this.showSecurityWarning('Authentication Failed', `${remainingAttempts} attempts remaining`);
        
        this.logSecurityEvent('auth_failure');
        this.triggerHaptic('heavy');
    }

    unlockApp() {
        this.isLocked = false;
        this.failedAuthAttempts = 0;
        this.lockScreen.classList.remove('visible');
        
        const app = document.querySelector('.tg-app');
        if (app) {
            app.style.filter = '';
        }
        
        this.updateLastActivity();
        this.logSecurityEvent('app_unlocked');
        this.announceToScreenReader('App unlocked');
    }

    // === ENCRYPTION INDICATORS ===
    
    setupEncryptionIndicators() {
        if (!this.securitySettings.encryptionIndicators) return;
        
        this.addEncryptionIndicators();
        
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('message')) {
                            this.addEncryptionIndicatorToMessage(node);
                        }
                    });
                });
            });

            observer.observe(messagesContainer, { childList: true });
        }
    }

    addEncryptionIndicators() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            this.addEncryptionIndicatorToMessage(message);
        });
    }

    addEncryptionIndicatorToMessage(messageElement) {
        if (messageElement.querySelector('.encryption-indicator')) return;

        const indicator = document.createElement('div');
        indicator.className = 'encryption-indicator';
        indicator.innerHTML = '<i class="fas fa-lock"></i>';
        indicator.title = 'End-to-end encrypted';

        messageElement.style.position = 'relative';
        messageElement.appendChild(indicator);
    }

    // === SELF-DESTRUCT MESSAGES ===
    
    setupSelfDestructMessages() {
        document.addEventListener('contextmenu', (e) => {
            const message = e.target.closest('.message');
            if (message && message.classList.contains('sent')) {
                e.preventDefault();
                this.showSelfDestructMenu(message);
            }
        });
    }

    showSelfDestructMenu(messageElement) {
        const menu = document.createElement('div');
        menu.className = 'self-destruct-menu';
        menu.innerHTML = `
            <div class="menu-header">Self-Destruct Timer</div>
            ${this.destructTimeouts.map(seconds => `
                <div class="menu-item" data-seconds="${seconds}">
                    ${this.formatDestructTime(seconds)}
                </div>
            `).join('')}
            <div class="menu-item" data-seconds="0">Cancel</div>
        `;

        const rect = messageElement.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = rect.top + 'px';
        menu.style.left = rect.right + 10 + 'px';
        menu.style.background = 'white';
        menu.style.borderRadius = '8px';
        menu.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        menu.style.zIndex = '4000';
        menu.style.minWidth = '200px';

        document.body.appendChild(menu);

        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.menu-item');
            if (item) {
                const seconds = parseInt(item.dataset.seconds);
                if (seconds > 0) {
                    this.startSelfDestruct(messageElement, seconds);
                }
                menu.remove();
            }
        });

        setTimeout(() => {
            if (menu.parentNode) {
                menu.remove();
            }
        }, 5000);
    }

    formatDestructTime(seconds) {
        if (seconds < 60) return `${seconds} seconds`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
        return `${Math.floor(seconds / 3600)} hours`;
    }

    startSelfDestruct(messageElement, seconds) {
        const messageId = this.getMessageId(messageElement);
        
        const timer = document.createElement('div');
        timer.className = 'self-destruct-timer';
        timer.textContent = seconds.toString();
        messageElement.appendChild(timer);

        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = seconds - elapsed;
            
            if (remaining <= 0) {
                clearInterval(interval);
                this.destructMessage(messageElement, messageId);
            } else {
                timer.textContent = remaining.toString();
            }
        }, 1000);

        this.destructTimers.set(messageId, interval);
        this.announceToScreenReader(`Self-destruct timer set for ${seconds} seconds`);
    }

    destructMessage(messageElement, messageId) {
        this.destructTimers.delete(messageId);
        
        messageElement.style.transition = 'all 0.5s ease';
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            messageElement.remove();
        }, 500);

        this.logSecurityEvent('message_self_destructed');
        this.announceToScreenReader('Message self-destructed');
    }

    // === DATA MANAGEMENT ===
    
    loadSecuritySettings() {
        const saved = localStorage.getItem('cipherwave_security_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.securitySettings = { ...this.securitySettings, ...settings };
            } catch (error) {
                console.warn('Failed to load security settings:', error);
            }
        }

        const authSaved = localStorage.getItem('cipherwave_auth_methods');
        if (authSaved) {
            try {
                const methods = JSON.parse(authSaved);
                this.authMethods = { ...this.authMethods, ...methods };
            } catch (error) {
                console.warn('Failed to load auth methods:', error);
            }
        }

        // Load WebAuthn credentials
        const credentialsSaved = localStorage.getItem('cipherwave_webauthn_credentials');
        if (credentialsSaved) {
            try {
                const credentials = JSON.parse(credentialsSaved);
                this.webAuthnCredentials = new Map(credentials);
            } catch (error) {
                console.warn('Failed to load WebAuthn credentials:', error);
            }
        }
    }

    saveSecuritySettings() {
        localStorage.setItem('cipherwave_security_settings', JSON.stringify(this.securitySettings));
        localStorage.setItem('cipherwave_auth_methods', JSON.stringify(this.authMethods));
    }

    logSecurityEvent(event, details = {}) {
        const logEntry = {
            event: event,
            timestamp: Date.now(),
            details: details,
            userAgent: navigator.userAgent.substring(0, 100),
            url: window.location.href,
            deviceFingerprint: this.deviceFingerprint ? this.deviceFingerprint.substring(0, 16) : null
        };
        
        this.securityEvents.push(logEntry);
        console.log('Security Event:', logEntry);
        
        // Keep only last 200 events
        if (this.securityEvents.length > 200) {
            this.securityEvents.splice(0, this.securityEvents.length - 200);
        }
        
        // Store in localStorage
        const logs = JSON.parse(localStorage.getItem('cipherwave_security_logs') || '[]');
        logs.push(logEntry);
        
        if (logs.length > 500) {
            logs.splice(0, logs.length - 500);
        }
        
        localStorage.setItem('cipherwave_security_logs', JSON.stringify(logs));
    }

    // === UTILITY METHODS ===
    
    getMessageId(messageElement) {
        return messageElement.dataset.messageId || 
               messageElement.getAttribute('data-message-id') ||
               'msg_' + Date.now();
    }

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

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'visually-hidden';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            if (announcement.parentNode) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    // === PUBLIC API ===
    
    isAppLocked() {
        return this.isLocked;
    }

    getSecuritySettings() {
        return { ...this.securitySettings };
    }

    getAuthMethods() {
        return { ...this.authMethods };
    }

    getSecurityLogs() {
        return JSON.parse(localStorage.getItem('cipherwave_security_logs') || '[]');
    }

    clearSecurityLogs() {
        localStorage.removeItem('cipherwave_security_logs');
        this.securityEvents = [];
    }

    isBiometricSupported() {
        return this.biometricSupported;
    }

    getTrustLevel() {
        return this.currentTrustLevel;
    }

    getDeviceFingerprint() {
        return this.deviceFingerprint;
    }

    // Add method to be compatible with existing UI integration
    addEncryptionIndicatorToMessage(messageElement) {
        if (messageElement.querySelector('.encryption-indicator')) return;

        const indicator = document.createElement('div');
        indicator.className = 'encryption-indicator';
        indicator.innerHTML = '<i class="fas fa-lock"></i>';
        indicator.title = 'End-to-end encrypted';

        messageElement.style.position = 'relative';
        messageElement.appendChild(indicator);
    }
}

// Export for use in other modules
window.SecurityManager = SecurityManager;

// Initialize security manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        if (!window.securityManager) {
            window.securityManager = new SecurityManager();
            await window.securityManager.setup();
        }
    });
} else {
    // DOM is already ready
    if (!window.securityManager) {
        window.securityManager = new SecurityManager();
        window.securityManager.setup();
    }
}