// Settings Component for CipherWave - Application Configuration
// Handles user preferences, connection settings, and app configuration

class SettingsComponent extends BaseComponent {
    constructor(container, options = {}) {
        super(container, options);
        
        this.state = {
            isVisible: false,
            activeSection: 'general',
            settings: {
                general: {
                    username: 'CipherWave User',
                    theme: 'dark',
                    language: 'en',
                    notifications: true,
                    soundEnabled: true,
                    autoConnect: false
                },
                connection: {
                    serverPort: 52178,
                    autoDiscovery: true,
                    connectionTimeout: 60000,
                    retryAttempts: 3,
                    useStun: true,
                    useTurn: true
                },
                security: {
                    encryptionMethod: 'chacha20-poly1305',
                    keyDerivationRounds: 100000,
                    autoDestroy: false,
                    destroyAfter: 24,
                    requireAuth: true,
                    allowP2P: true
                },
                privacy: {
                    sharePresence: true,
                    allowDiscovery: false,
                    logMessages: false,
                    clearOnExit: true,
                    hideMetadata: false
                }
            },
            isDirty: false,
            validationErrors: {}
        };
        
        this.inputComponents = new Map();
        
        if (this.options.autoRender) {
            this.render();
        }
    }
    
    getDefaultOptions() {
        return {
            ...super.getDefaultOptions(),
            className: 'settings-view',
            persistSettings: true,
            validateOnChange: true,
            showUnsavedWarning: true,
            sections: ['general', 'connection', 'security', 'privacy']
        };
    }
    
    createTemplate() {
        return `
            <div class="${this.options.className} view ${this.state.isVisible ? 'active' : ''}">
                ${this.createHeader()}
                <div class="settings-container">
                    ${this.createSidebar()}
                    ${this.createContent()}
                </div>
            </div>
        `;
    }
    
    createHeader() {
        return `
            <div class="view-header">
                <h2>Settings</h2>
                <div class="header-actions">
                    ${this.state.isDirty ? `
                        <button class="action-btn save-btn" type="button" aria-label="Save settings">
                            <i class="fas fa-save"></i>
                        </button>
                        <button class="action-btn reset-btn" type="button" aria-label="Reset changes">
                            <i class="fas fa-undo"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn export-btn" type="button" aria-label="Export settings">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn import-btn" type="button" aria-label="Import settings">
                        <i class="fas fa-upload"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    createSidebar() {
        const sections = [
            { id: 'general', icon: 'fas fa-cog', label: 'General' },
            { id: 'connection', icon: 'fas fa-network-wired', label: 'Connection' },
            { id: 'security', icon: 'fas fa-shield-alt', label: 'Security' },
            { id: 'privacy', icon: 'fas fa-user-secret', label: 'Privacy' }
        ];
        
        return `
            <div class="settings-sidebar">
                <nav class="settings-nav">
                    ${sections.map(section => `
                        <button class="settings-nav-item ${this.state.activeSection === section.id ? 'active' : ''}" 
                                data-section="${section.id}"
                                type="button">
                            <i class="${section.icon}"></i>
                            <span>${section.label}</span>
                        </button>
                    `).join('')}
                </nav>
            </div>
        `;
    }
    
    createContent() {
        return `
            <div class="settings-content">
                ${this.createSection(this.state.activeSection)}
            </div>
        `;
    }
    
    createSection(sectionId) {
        const sectionData = this.state.settings[sectionId];
        if (!sectionData) return '';
        
        const sectionConfig = this.getSectionConfig(sectionId);
        
        return `
            <div class="settings-section active" data-section="${sectionId}">
                <div class="section-header">
                    <h3>${sectionConfig.title}</h3>
                    <p class="section-description">${sectionConfig.description}</p>
                </div>
                
                <div class="section-content">
                    ${sectionConfig.fields.map(field => this.createField(sectionId, field)).join('')}
                </div>
                
                ${sectionConfig.actions ? this.createSectionActions(sectionId, sectionConfig.actions) : ''}
            </div>
        `;
    }
    
    getSectionConfig(sectionId) {
        const configs = {
            general: {
                title: 'General Settings',
                description: 'Basic application preferences and user information',
                fields: [
                    { key: 'username', type: 'text', label: 'Username', placeholder: 'Enter your username', required: true },
                    { key: 'theme', type: 'select', label: 'Theme', options: [
                        { value: 'dark', label: 'Dark' },
                        { value: 'light', label: 'Light' },
                        { value: 'auto', label: 'Auto' }
                    ]},
                    { key: 'language', type: 'select', label: 'Language', options: [
                        { value: 'en', label: 'English' },
                        { value: 'es', label: 'Español' },
                        { value: 'fr', label: 'Français' },
                        { value: 'de', label: 'Deutsch' }
                    ]},
                    { key: 'notifications', type: 'checkbox', label: 'Enable notifications', description: 'Show desktop notifications for new messages' },
                    { key: 'soundEnabled', type: 'checkbox', label: 'Sound effects', description: 'Play sounds for message events' },
                    { key: 'autoConnect', type: 'checkbox', label: 'Auto-connect', description: 'Automatically connect to the last used room' }
                ]
            },
            connection: {
                title: 'Connection Settings',
                description: 'Network and connectivity configuration',
                fields: [
                    { key: 'serverPort', type: 'number', label: 'Server Port', min: 1024, max: 65535, description: 'Port for hosting signaling server' },
                    { key: 'autoDiscovery', type: 'checkbox', label: 'Auto-discovery', description: 'Automatically discover available servers' },
                    { key: 'connectionTimeout', type: 'number', label: 'Connection Timeout (ms)', min: 5000, max: 300000, step: 1000 },
                    { key: 'retryAttempts', type: 'number', label: 'Retry Attempts', min: 1, max: 10 },
                    { key: 'useStun', type: 'checkbox', label: 'Use STUN servers', description: 'Enable STUN servers for NAT traversal' },
                    { key: 'useTurn', type: 'checkbox', label: 'Use TURN servers', description: 'Enable TURN servers for relay connections' }
                ],
                actions: [
                    { id: 'test-connection', label: 'Test Connection', icon: 'fas fa-plug' },
                    { id: 'reset-servers', label: 'Reset Server List', icon: 'fas fa-sync' }
                ]
            },
            security: {
                title: 'Security Settings',
                description: 'Encryption and security configuration',
                fields: [
                    { key: 'encryptionMethod', type: 'select', label: 'Encryption Method', options: [
                        { value: 'chacha20-poly1305', label: 'ChaCha20-Poly1305 (Recommended)' },
                        { value: 'aes-256-gcm', label: 'AES-256-GCM' },
                        { value: 'xchacha20-poly1305', label: 'XChaCha20-Poly1305' }
                    ]},
                    { key: 'keyDerivationRounds', type: 'number', label: 'Key Derivation Rounds', min: 10000, max: 1000000, step: 10000 },
                    { key: 'autoDestroy', type: 'checkbox', label: 'Auto-destroy messages', description: 'Automatically delete messages after a set time' },
                    { key: 'destroyAfter', type: 'number', label: 'Destroy after (hours)', min: 1, max: 168, condition: 'autoDestroy' },
                    { key: 'requireAuth', type: 'checkbox', label: 'Require authentication', description: 'Require peer authentication before establishing connection' },
                    { key: 'allowP2P', type: 'checkbox', label: 'Allow P2P connections', description: 'Allow direct peer-to-peer connections' }
                ],
                actions: [
                    { id: 'generate-keys', label: 'Generate New Keys', icon: 'fas fa-key' },
                    { id: 'export-keys', label: 'Export Keys', icon: 'fas fa-download' }
                ]
            },
            privacy: {
                title: 'Privacy Settings',
                description: 'Privacy and data protection preferences',
                fields: [
                    { key: 'sharePresence', type: 'checkbox', label: 'Share presence status', description: 'Allow others to see when you are online' },
                    { key: 'allowDiscovery', type: 'checkbox', label: 'Allow discovery', description: 'Allow others to discover your node' },
                    { key: 'logMessages', type: 'checkbox', label: 'Log messages', description: 'Save message history locally' },
                    { key: 'clearOnExit', type: 'checkbox', label: 'Clear on exit', description: 'Clear all data when closing the application' },
                    { key: 'hideMetadata', type: 'checkbox', label: 'Hide metadata', description: 'Hide message timestamps and read receipts' }
                ],
                actions: [
                    { id: 'clear-data', label: 'Clear All Data', icon: 'fas fa-trash', variant: 'danger' },
                    { id: 'export-data', label: 'Export Data', icon: 'fas fa-download' }
                ]
            }
        };
        
        return configs[sectionId] || { title: 'Unknown Section', description: '', fields: [] };
    }
    
    createField(sectionId, field) {
        const fieldId = `${sectionId}-${field.key}`;
        const currentValue = this.state.settings[sectionId][field.key];
        const hasError = this.state.validationErrors[fieldId];
        
        // Check condition
        if (field.condition) {
            const conditionValue = this.state.settings[sectionId][field.condition];
            if (!conditionValue) {
                return '';
            }
        }
        
        return `
            <div class="setting-field ${hasError ? 'error' : ''}" data-field="${fieldId}">
                <div class="field-header">
                    <label for="${fieldId}" class="field-label">
                        ${field.label}
                        ${field.required ? '<span class="required">*</span>' : ''}
                    </label>
                    ${field.description ? `<p class="field-description">${field.description}</p>` : ''}
                </div>
                
                <div class="field-control">
                    ${this.createFieldInput(fieldId, field, currentValue)}
                </div>
                
                ${hasError ? `<div class="field-error">${this.state.validationErrors[fieldId]}</div>` : ''}
            </div>
        `;
    }
    
    createFieldInput(fieldId, field, currentValue) {
        switch (field.type) {
            case 'text':
            case 'password':
                return `
                    <input type="${field.type}" 
                           id="${fieldId}" 
                           class="field-input" 
                           value="${this.escapeHTML(String(currentValue))}"
                           placeholder="${field.placeholder || ''}"
                           ${field.required ? 'required' : ''}
                           ${field.readonly ? 'readonly' : ''}>
                `;
                
            case 'number':
                return `
                    <input type="number" 
                           id="${fieldId}" 
                           class="field-input" 
                           value="${currentValue}"
                           ${field.min !== undefined ? `min="${field.min}"` : ''}
                           ${field.max !== undefined ? `max="${field.max}"` : ''}
                           ${field.step !== undefined ? `step="${field.step}"` : ''}
                           ${field.required ? 'required' : ''}>
                `;
                
            case 'select':
                return `
                    <select id="${fieldId}" class="field-input">
                        ${field.options.map(option => `
                            <option value="${option.value}" ${currentValue === option.value ? 'selected' : ''}>
                                ${option.label}
                            </option>
                        `).join('')}
                    </select>
                `;
                
            case 'checkbox':
                return `
                    <label class="checkbox-label">
                        <input type="checkbox" 
                               id="${fieldId}" 
                               class="field-checkbox" 
                               ${currentValue ? 'checked' : ''}>
                        <span class="checkbox-custom"></span>
                        <span class="checkbox-text">${field.label}</span>
                    </label>
                `;
                
            case 'textarea':
                return `
                    <textarea id="${fieldId}" 
                              class="field-input field-textarea" 
                              rows="${field.rows || 4}"
                              placeholder="${field.placeholder || ''}"
                              ${field.required ? 'required' : ''}>${this.escapeHTML(String(currentValue))}</textarea>
                `;
                
            default:
                return `<span class="field-error">Unknown field type: ${field.type}</span>`;
        }
    }
    
    createSectionActions(sectionId, actions) {
        return `
            <div class="section-actions">
                ${actions.map(action => `
                    <button class="section-action-btn ${action.variant || 'secondary'}-btn" 
                            type="button" 
                            data-action="${action.id}">
                        <i class="${action.icon}"></i>
                        ${action.label}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    attachEventListeners() {
        // Navigation
        const navItems = this.querySelectorAll('.settings-nav-item');
        navItems.forEach(item => {
            this.addEventListener(item, 'click', this.handleNavigation);
        });
        
        // Header actions
        const saveBtn = this.querySelector('.save-btn');
        if (saveBtn) {
            this.addEventListener(saveBtn, 'click', this.handleSave);
        }
        
        const resetBtn = this.querySelector('.reset-btn');
        if (resetBtn) {
            this.addEventListener(resetBtn, 'click', this.handleReset);
        }
        
        const exportBtn = this.querySelector('.export-btn');
        if (exportBtn) {
            this.addEventListener(exportBtn, 'click', this.handleExport);
        }
        
        const importBtn = this.querySelector('.import-btn');
        if (importBtn) {
            this.addEventListener(importBtn, 'click', this.handleImport);
        }
        
        // Field inputs
        this.attachFieldListeners();
        
        // Section actions
        const actionButtons = this.querySelectorAll('.section-action-btn');
        actionButtons.forEach(button => {
            this.addEventListener(button, 'click', this.handleSectionAction);
        });
    }
    
    attachFieldListeners() {
        const inputs = this.querySelectorAll('.field-input, .field-checkbox');
        inputs.forEach(input => {
            const eventType = input.type === 'checkbox' ? 'change' : 'input';
            this.addEventListener(input, eventType, this.handleFieldChange);
            
            if (input.type !== 'checkbox') {
                this.addEventListener(input, 'blur', this.handleFieldBlur);
            }
        });
    }
    
    handleNavigation(event) {
        const sectionId = event.currentTarget.dataset.section;
        if (sectionId && sectionId !== this.state.activeSection) {
            this.setActiveSection(sectionId);
        }
    }
    
    handleFieldChange(event) {
        const fieldId = event.target.id;
        const [sectionId, fieldKey] = fieldId.split('-', 2);
        
        let value;
        if (event.target.type === 'checkbox') {
            value = event.target.checked;
        } else if (event.target.type === 'number') {
            value = parseFloat(event.target.value) || 0;
        } else {
            value = event.target.value;
        }
        
        this.updateSetting(sectionId, fieldKey, value);
        
        if (this.options.validateOnChange) {
            this.validateField(fieldId);
        }
    }
    
    handleFieldBlur(event) {
        const fieldId = event.target.id;
        this.validateField(fieldId);
    }
    
    handleSave() {
        if (this.validateAllFields()) {
            this.saveSettings();
            this.setState({ isDirty: false });
            this.updateHeader();
            this.emit('settingssaved', { settings: this.state.settings });
        }
    }
    
    handleReset() {
        if (this.options.showUnsavedWarning && this.state.isDirty) {
            const confirmed = confirm('Are you sure you want to discard all unsaved changes?');
            if (!confirmed) return;
        }
        
        this.resetSettings();
    }
    
    handleExport() {
        const settings = JSON.stringify(this.state.settings, null, 2);
        const blob = new Blob([settings], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `cipherwave-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.emit('settingsexported');
    }
    
    handleImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const settings = JSON.parse(e.target.result);
                    this.importSettings(settings);
                } catch (error) {
                    alert('Invalid settings file format');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    handleSectionAction(event) {
        const actionId = event.currentTarget.dataset.action;
        this.emit('sectionaction', { action: actionId, section: this.state.activeSection });
        
        // Handle built-in actions
        switch (actionId) {
            case 'clear-data':
                if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
                    this.emit('cleardata');
                }
                break;
                
            case 'test-connection':
                this.emit('testconnection');
                break;
                
            case 'reset-servers':
                this.emit('resetservers');
                break;
                
            case 'generate-keys':
                this.emit('generatekeys');
                break;
                
            case 'export-keys':
                this.emit('exportkeys');
                break;
                
            case 'export-data':
                this.emit('exportdata');
                break;
        }
    }
    
    // Public API methods
    setActiveSection(sectionId) {
        if (this.options.sections.includes(sectionId)) {
            this.setState({ activeSection: sectionId });
            this.updateNavigation();
            this.updateContent();
        }
    }
    
    updateSetting(sectionId, fieldKey, value) {
        const newSettings = {
            ...this.state.settings,
            [sectionId]: {
                ...this.state.settings[sectionId],
                [fieldKey]: value
            }
        };
        
        this.setState({ settings: newSettings, isDirty: true });
        this.updateHeader();
        this.emit('settingchanged', { section: sectionId, field: fieldKey, value });
    }
    
    getSetting(sectionId, fieldKey) {
        return this.state.settings[sectionId]?.[fieldKey];
    }
    
    getAllSettings() {
        return this.state.settings;
    }
    
    validateField(fieldId) {
        const [sectionId, fieldKey] = fieldId.split('-', 2);
        const sectionConfig = this.getSectionConfig(sectionId);
        const field = sectionConfig.fields.find(f => f.key === fieldKey);
        
        if (!field) return true;
        
        const value = this.state.settings[sectionId][fieldKey];
        let isValid = true;
        let errorMessage = '';
        
        // Required validation
        if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
            isValid = false;
            errorMessage = 'This field is required';
        }
        
        // Type-specific validation
        if (isValid && field.type === 'number') {
            if (field.min !== undefined && value < field.min) {
                isValid = false;
                errorMessage = `Value must be at least ${field.min}`;
            } else if (field.max !== undefined && value > field.max) {
                isValid = false;
                errorMessage = `Value must be at most ${field.max}`;
            }
        }
        
        // Update validation state
        if (isValid) {
            delete this.state.validationErrors[fieldId];
        } else {
            this.state.validationErrors[fieldId] = errorMessage;
        }
        
        this.updateFieldError(fieldId);
        return isValid;
    }
    
    validateAllFields() {
        const fieldInputs = this.querySelectorAll('.field-input, .field-checkbox');
        let allValid = true;
        
        fieldInputs.forEach(input => {
            if (!this.validateField(input.id)) {
                allValid = false;
            }
        });
        
        return allValid;
    }
    
    saveSettings() {
        if (this.options.persistSettings) {
            try {
                localStorage.setItem('cipherwave-settings', JSON.stringify(this.state.settings));
            } catch (error) {
                console.error('Failed to save settings:', error);
            }
        }
    }
    
    loadSettings() {
        if (this.options.persistSettings) {
            try {
                const saved = localStorage.getItem('cipherwave-settings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    this.setState({ settings: { ...this.state.settings, ...settings } });
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        }
    }
    
    resetSettings() {
        // Reload default settings
        this.state.settings = {
            general: {
                username: 'CipherWave User',
                theme: 'dark',
                language: 'en',
                notifications: true,
                soundEnabled: true,
                autoConnect: false
            },
            connection: {
                serverPort: 52178,
                autoDiscovery: true,
                connectionTimeout: 60000,
                retryAttempts: 3,
                useStun: true,
                useTurn: true
            },
            security: {
                encryptionMethod: 'chacha20-poly1305',
                keyDerivationRounds: 100000,
                autoDestroy: false,
                destroyAfter: 24,
                requireAuth: true,
                allowP2P: true
            },
            privacy: {
                sharePresence: true,
                allowDiscovery: false,
                logMessages: false,
                clearOnExit: true,
                hideMetadata: false
            }
        };
        
        this.setState({ isDirty: false, validationErrors: {} });
        this.updateContent();
        this.updateHeader();
        this.emit('settingsreset');
    }
    
    importSettings(settings) {
        try {
            // Validate structure
            const requiredSections = ['general', 'connection', 'security', 'privacy'];
            const hasAllSections = requiredSections.every(section => settings[section]);
            
            if (!hasAllSections) {
                throw new Error('Invalid settings structure');
            }
            
            this.setState({ settings, isDirty: true });
            this.updateContent();
            this.updateHeader();
            this.emit('settingsimported', { settings });
            
        } catch (error) {
            console.error('Failed to import settings:', error);
            alert('Failed to import settings: Invalid file format');
        }
    }
    
    // UI Update methods
    updateNavigation() {
        const navItems = this.querySelectorAll('.settings-nav-item');
        navItems.forEach(item => {
            const sectionId = item.dataset.section;
            item.classList.toggle('active', sectionId === this.state.activeSection);
        });
    }
    
    updateContent() {
        const contentContainer = this.querySelector('.settings-content');
        if (contentContainer) {
            contentContainer.innerHTML = this.createSection(this.state.activeSection);
            this.attachFieldListeners();
            
            // Re-attach section action listeners
            const actionButtons = this.querySelectorAll('.section-action-btn');
            actionButtons.forEach(button => {
                this.addEventListener(button, 'click', this.handleSectionAction);
            });
        }
    }
    
    updateHeader() {
        const header = this.querySelector('.view-header');
        if (header) {
            header.outerHTML = this.createHeader();
            
            // Re-attach header listeners
            const saveBtn = this.querySelector('.save-btn');
            if (saveBtn) {
                this.addEventListener(saveBtn, 'click', this.handleSave);
            }
            
            const resetBtn = this.querySelector('.reset-btn');
            if (resetBtn) {
                this.addEventListener(resetBtn, 'click', this.handleReset);
            }
            
            const exportBtn = this.querySelector('.export-btn');
            if (exportBtn) {
                this.addEventListener(exportBtn, 'click', this.handleExport);
            }
            
            const importBtn = this.querySelector('.import-btn');
            if (importBtn) {
                this.addEventListener(importBtn, 'click', this.handleImport);
            }
        }
    }
    
    updateFieldError(fieldId) {
        const fieldContainer = this.querySelector(`[data-field="${fieldId}"]`);
        if (fieldContainer) {
            const hasError = this.state.validationErrors[fieldId];
            fieldContainer.classList.toggle('error', hasError);
            
            let errorElement = fieldContainer.querySelector('.field-error');
            if (hasError) {
                if (!errorElement) {
                    errorElement = this.createElement('div', { className: 'field-error' });
                    fieldContainer.appendChild(errorElement);
                }
                errorElement.textContent = this.state.validationErrors[fieldId];
            } else if (errorElement) {
                errorElement.remove();
            }
        }
    }
    
    show() {
        this.setState({ isVisible: true });
        this.addClass('active');
        this.loadSettings(); // Load settings when showing
        this.emit('settingsshow');
        return this;
    }
    
    hide() {
        this.setState({ isVisible: false });
        this.removeClass('active');
        
        // Warn about unsaved changes
        if (this.options.showUnsavedWarning && this.state.isDirty) {
            const confirmed = confirm('You have unsaved changes. Are you sure you want to close settings?');
            if (!confirmed) {
                this.show();
                return this;
            }
        }
        
        this.emit('settingshide');
        return this;
    }
    
    isDirty() {
        return this.state.isDirty;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsComponent;
} else if (typeof window !== 'undefined') {
    window.SettingsComponent = SettingsComponent;
}