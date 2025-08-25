// CipherWave Authentication Component - Handles user login and registration
// Provides UI for decentralized identity management

import { BaseComponent } from './BaseComponent.js';
import { IdentityManager } from '../managers/identity-manager.js';
import { StorageManager } from '../managers/storage-manager.js';
import { DevicePairingComponent } from './DevicePairingComponent.js';

export class AuthComponent extends BaseComponent {
    constructor() {
        super();
        this.identityManager = new IdentityManager();
        this.storageManager = null;
        this.devicePairingComponent = null;
        this.isInitialized = false;
        this.currentView = 'welcome'; // welcome, login, register, profile, devices
    }

    async initialize() {
        await this.identityManager.initialize();
        this.isInitialized = true;
        
        // Check if user has existing identity
        if (this.identityManager.hasStoredIdentity()) {
            this.currentView = 'login';
        } else {
            this.currentView = 'welcome';
        }
        
        this.render();
    }

    getHTML() {
        if (!this.isInitialized) {
            return this.getLoadingHTML();
        }

        switch (this.currentView) {
            case 'welcome':
                return this.getWelcomeHTML();
            case 'login':
                return this.getLoginHTML();
            case 'register':
                return this.getRegisterHTML();
            case 'profile':
                return this.getProfileHTML();
            case 'devices':
                return this.getDevicesHTML();
            default:
                return this.getWelcomeHTML();
        }
    }

    getLoadingHTML() {
        return `
            <div class="auth-container">
                <div class="auth-card loading">
                    <div class="loading-spinner"></div>
                    <p>Initializing secure authentication...</p>
                </div>
            </div>
        `;
    }

    getWelcomeHTML() {
        return `
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-header">
                        <h1>🔐 CipherWave</h1>
                        <p class="subtitle">Secure Decentralized Messaging</p>
                    </div>
                    
                    <div class="auth-content">
                        <div class="feature-list">
                            <div class="feature">
                                <span class="icon">🔒</span>
                                <span>End-to-end encryption</span>
                            </div>
                            <div class="feature">
                                <span class="icon">🌐</span>
                                <span>Decentralized P2P communication</span>
                            </div>
                            <div class="feature">
                                <span class="icon">💾</span>
                                <span>Secure message persistence</span>
                            </div>
                            <div class="feature">
                                <span class="icon">🔑</span>
                                <span>Password-based encryption</span>
                            </div>
                        </div>
                        
                        <div class="auth-buttons">
                            <button class="btn btn-primary" id="create-identity-btn">
                                Create New Identity
                            </button>
                            <p class="auth-link">
                                Already have an identity? 
                                <a href="#" id="login-link">Sign In</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getLoginHTML() {
        return `
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-header">
                        <h2>🔓 Sign In</h2>
                        <p class="subtitle">Enter your password to decrypt your identity</p>
                    </div>
                    
                    <form class="auth-form" id="login-form">
                        <div class="form-group">
                            <label for="login-password">Password</label>
                            <div class="password-input">
                                <input 
                                    type="password" 
                                    id="login-password" 
                                    placeholder="Enter your password"
                                    autocomplete="current-password"
                                    required
                                >
                                <button type="button" class="password-toggle" id="login-password-toggle">
                                    👁️
                                </button>
                            </div>
                        </div>
                        
                        <div class="auth-buttons">
                            <button type="submit" class="btn btn-primary" id="login-btn">
                                Sign In
                            </button>
                            <p class="auth-link">
                                Don't have an identity? 
                                <a href="#" id="register-link">Create New</a>
                            </p>
                        </div>
                    </form>
                    
                    <div class="auth-error" id="auth-error" style="display: none;"></div>
                </div>
            </div>
        `;
    }

    getRegisterHTML() {
        return `
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-header">
                        <h2>🆔 Create Identity</h2>
                        <p class="subtitle">Set up your secure decentralized identity</p>
                    </div>
                    
                    <form class="auth-form" id="register-form">
                        <div class="form-group">
                            <label for="display-name">Display Name</label>
                            <input 
                                type="text" 
                                id="display-name" 
                                placeholder="How others will see you"
                                maxlength="32"
                                required
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="register-password">Password</label>
                            <div class="password-input">
                                <input 
                                    type="password" 
                                    id="register-password" 
                                    placeholder="Choose a strong password"
                                    autocomplete="new-password"
                                    required
                                >
                                <button type="button" class="password-toggle" id="register-password-toggle">
                                    👁️
                                </button>
                            </div>
                            <div class="password-strength" id="password-strength"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="confirm-password">Confirm Password</label>
                            <div class="password-input">
                                <input 
                                    type="password" 
                                    id="confirm-password" 
                                    placeholder="Confirm your password"
                                    autocomplete="new-password"
                                    required
                                >
                            </div>
                        </div>
                        
                        <div class="security-notice">
                            <p><strong>⚠️ Important:</strong> Your password encrypts your identity and messages. If you lose it, your data cannot be recovered.</p>
                        </div>
                        
                        <div class="auth-buttons">
                            <button type="submit" class="btn btn-primary" id="register-btn">
                                Create Identity
                            </button>
                            <p class="auth-link">
                                Already have an identity? 
                                <a href="#" id="back-to-login-link">Sign In</a>
                            </p>
                        </div>
                    </form>
                    
                    <div class="auth-error" id="auth-error" style="display: none;"></div>
                </div>
            </div>
        `;
    }

    getProfileHTML() {
        const profile = this.identityManager.getUserProfile();
        if (!profile) return this.getLoginHTML();

        const stats = this.storageManager ? 'Loading...' : 'Storage not initialized';

        return `
            <div class="auth-container">
                <div class="auth-card profile-card">
                    <div class="auth-header">
                        <h2>👤 User Profile</h2>
                        <button class="btn btn-secondary logout-btn" id="logout-btn">
                            🔒 Logout
                        </button>
                    </div>
                    
                    <div class="profile-content">
                        <div class="profile-info">
                            <div class="info-group">
                                <label>Display Name</label>
                                <p class="info-value">${this.escapeHtml(profile.displayName)}</p>
                            </div>
                            
                            <div class="info-group">
                                <label>Public Key</label>
                                <p class="info-value public-key" title="${profile.publicKey}">
                                    ${profile.publicKey.substring(0, 16)}...${profile.publicKey.substring(-8)}
                                    <button class="copy-btn" data-copy="${profile.publicKey}">📋</button>
                                </p>
                            </div>
                            
                            <div class="info-group">
                                <label>Device ID</label>
                                <p class="info-value device-id">
                                    ${profile.deviceId.substring(0, 8)}...
                                </p>
                            </div>
                            
                            <div class="info-group">
                                <label>Created</label>
                                <p class="info-value">
                                    ${new Date(profile.created).toLocaleString()}
                                </p>
                            </div>
                            
                            <div class="info-group">
                                <label>Trusted Contacts</label>
                                <p class="info-value">${profile.trustedContactsCount}</p>
                            </div>
                        </div>
                        
                        <div class="profile-actions">
                            <button class="btn btn-primary" id="start-chat-btn">
                                💬 Start Chatting
                            </button>
                            <button class="btn btn-secondary" id="manage-devices-btn">
                                🔗 Manage Devices
                            </button>
                            <button class="btn btn-danger" id="delete-identity-btn">
                                🗑️ Delete Identity
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getDevicesHTML() {
        return `
            <div class="auth-container">
                <div class="device-management-container" id="device-management-container">
                    <!-- Device pairing component will be mounted here -->
                </div>
                
                <div class="back-to-profile">
                    <button class="btn btn-secondary" id="back-to-profile-btn">
                        ← Back to Profile
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        super.setupEventListeners();

        // Welcome screen
        this.addEventListener('click', '#create-identity-btn', () => {
            this.currentView = 'register';
            this.render();
        });

        this.addEventListener('click', '#login-link', () => {
            this.currentView = 'login';
            this.render();
        });

        // Login form
        this.addEventListener('submit', '#login-form', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        this.addEventListener('click', '#register-link', () => {
            this.currentView = 'register';
            this.render();
        });

        // Register form
        this.addEventListener('submit', '#register-form', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        this.addEventListener('click', '#back-to-login-link', () => {
            this.currentView = 'login';
            this.render();
        });

        // Password strength checking
        this.addEventListener('input', '#register-password', (e) => {
            this.checkPasswordStrength(e.target.value);
        });

        // Password visibility toggles
        this.addEventListener('click', '.password-toggle', (e) => {
            this.togglePasswordVisibility(e.target);
        });

        // Profile actions
        this.addEventListener('click', '#logout-btn', () => {
            this.handleLogout();
        });

        this.addEventListener('click', '#start-chat-btn', () => {
            this.emit('auth:success', {
                identityManager: this.identityManager,
                storageManager: this.storageManager
            });
        });

        this.addEventListener('click', '#manage-devices-btn', () => {
            this.showDeviceManagement();
        });

        this.addEventListener('click', '#back-to-profile-btn', () => {
            this.currentView = 'profile';
            this.render();
        });

        this.addEventListener('click', '#delete-identity-btn', () => {
            this.handleDeleteIdentity();
        });

        // Copy to clipboard
        this.addEventListener('click', '.copy-btn', (e) => {
            const text = e.target.dataset.copy;
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Copied to clipboard!');
            });
        });
    }

    async handleLogin() {
        const password = this.getElementValue('#login-password');
        const loginBtn = this.getElement('#login-btn');
        
        if (!password) {
            this.showError('Please enter your password');
            return;
        }

        try {
            this.setButtonLoading(loginBtn, true);
            this.hideError();

            const userProfile = await this.identityManager.loginWithPassword(password);
            
            // Initialize storage manager
            this.storageManager = new StorageManager(this.identityManager);
            await this.storageManager.initialize();

            console.log('✅ Login successful:', userProfile);
            this.currentView = 'profile';
            this.render();
            
        } catch (error) {
            console.error('❌ Login failed:', error);
            this.showError('Invalid password or corrupted identity data');
        } finally {
            this.setButtonLoading(loginBtn, false);
        }
    }

    async handleRegister() {
        const displayName = this.getElementValue('#display-name');
        const password = this.getElementValue('#register-password');
        const confirmPassword = this.getElementValue('#confirm-password');
        const registerBtn = this.getElement('#register-btn');

        // Validation
        if (!displayName || !password || !confirmPassword) {
            this.showError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            this.showError('Password must be at least 8 characters long');
            return;
        }

        try {
            this.setButtonLoading(registerBtn, true);
            this.hideError();

            const userProfile = await this.identityManager.createIdentity(password, displayName);
            
            // Initialize storage manager
            this.storageManager = new StorageManager(this.identityManager);
            await this.storageManager.initialize();

            console.log('✅ Registration successful:', userProfile);
            this.currentView = 'profile';
            this.render();
            
        } catch (error) {
            console.error('❌ Registration failed:', error);
            this.showError('Failed to create identity. Please try again.');
        } finally {
            this.setButtonLoading(registerBtn, false);
        }
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            this.identityManager.logout();
            
            if (this.storageManager) {
                this.storageManager.destroy();
                this.storageManager = null;
            }
            
            this.currentView = 'login';
            this.render();
            
            this.emit('auth:logout');
        }
    }

    async showDeviceManagement() {
        if (!this.identityManager.deviceTrustManager) {
            this.showError('Device management not available');
            return;
        }

        try {
            // Initialize device pairing component if not already done
            if (!this.devicePairingComponent) {
                this.devicePairingComponent = new DevicePairingComponent(
                    this.identityManager.deviceTrustManager,
                    this.identityManager.syncCoordinator
                );
            }

            this.currentView = 'devices';
            this.render();

            // Mount the device pairing component
            const container = this.getElement('#device-management-container');
            if (container) {
                this.devicePairingComponent.mount(container);
            }

        } catch (error) {
            console.error('Failed to show device management:', error);
            this.showError('Failed to load device management');
        }
    }

    handleDeleteIdentity() {
        const confirmation = prompt('Type "DELETE" to permanently delete your identity:');
        
        if (confirmation === 'DELETE') {
            this.identityManager.deleteIdentity();
            
            if (this.storageManager) {
                this.storageManager.clearAllData();
                this.storageManager.destroy();
                this.storageManager = null;
            }
            
            this.currentView = 'welcome';
            this.render();
            
            this.showToast('Identity deleted permanently');
            this.emit('auth:deleted');
        }
    }

    checkPasswordStrength(password) {
        const strengthEl = this.getElement('#password-strength');
        if (!strengthEl) return;

        let strength = 0;
        let feedback = [];

        if (password.length >= 8) strength++;
        else feedback.push('At least 8 characters');

        if (/[a-z]/.test(password)) strength++;
        else feedback.push('Lowercase letter');

        if (/[A-Z]/.test(password)) strength++;
        else feedback.push('Uppercase letter');

        if (/[0-9]/.test(password)) strength++;
        else feedback.push('Number');

        if (/[^A-Za-z0-9]/.test(password)) strength++;
        else feedback.push('Special character');

        const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['#ff4444', '#ff8844', '#ffaa44', '#88ff44', '#44ff44'];

        strengthEl.innerHTML = `
            <div class="strength-bar">
                <div class="strength-fill" style="width: ${strength * 20}%; background: ${colors[strength - 1] || '#ccc'}"></div>
            </div>
            <div class="strength-text">${levels[strength - 1] || 'Too Short'}</div>
            ${feedback.length > 0 ? `<div class="strength-feedback">Missing: ${feedback.join(', ')}</div>` : ''}
        `;
    }

    togglePasswordVisibility(toggleBtn) {
        const passwordInput = toggleBtn.previousElementSibling;
        const isHidden = passwordInput.type === 'password';
        
        passwordInput.type = isHidden ? 'text' : 'password';
        toggleBtn.textContent = isHidden ? '🙈' : '👁️';
    }

    showError(message) {
        const errorEl = this.getElement('#auth-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => this.hideError(), 5000);
        }
    }

    hideError() {
        const errorEl = this.getElement('#auth-error');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }

    setButtonLoading(button, loading) {
        if (!button) return;
        
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<div class="loading-spinner small"></div> Processing...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Submit';
        }
    }

    showToast(message, type = 'success') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add to page
        document.body.appendChild(toast);
        
        // Remove after delay
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // Get current authentication state
    getAuthState() {
        return {
            isLoggedIn: this.identityManager?.isLoggedIn || false,
            identityManager: this.identityManager,
            storageManager: this.storageManager,
            userProfile: this.identityManager?.getUserProfile() || null
        };
    }

    // Destroy component and cleanup
    destroy() {
        if (this.devicePairingComponent) {
            this.devicePairingComponent.destroy();
            this.devicePairingComponent = null;
        }
        
        if (this.identityManager) {
            this.identityManager.destroy();
        }
        
        if (this.storageManager) {
            this.storageManager.destroy();
        }
        
        super.destroy();
    }
}