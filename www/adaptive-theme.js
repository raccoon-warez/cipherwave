// Adaptive UI & Dynamic Theming Manager
class AdaptiveThemeManager {
    constructor() {
        this.currentTheme = 'auto';
        this.customThemes = new Map();
        this.isHighContrast = false;
        this.colorSchemes = {
            default: {
                name: 'CipherWave Blue',
                primary: '#5682a3',
                primaryDark: '#4a7290',
                background: '#ffffff',
                sidebar: '#f0f4f8',
                chatBg: '#e3f2fd',
                messageReceived: '#f0f4f8',
                messageSent: '#e3f2fd',
                textPrimary: '#212121',
                textSecondary: '#757575',
                border: '#e0e0e0',
                online: '#4caf50',
                away: '#ff9800',
                offline: '#9e9e9e'
            },
            dark: {
                name: 'Dark Mode',
                primary: '#6C63FF',
                primaryDark: '#5a52e0',
                background: '#181A20',
                sidebar: '#23263A',
                chatBg: '#1e1e2e',
                messageReceived: '#2a2d47',
                messageSent: '#6C63FF',
                textPrimary: '#E3E6ED',
                textSecondary: '#A3A8C9',
                border: '#353A50',
                online: '#4caf50',
                away: '#ff9800',
                offline: '#9e9e9e'
            },
            ocean: {
                name: 'Ocean Blue',
                primary: '#0077be',
                primaryDark: '#005a8b',
                background: '#f0f8ff',
                sidebar: '#e6f3ff',
                chatBg: '#cce7ff',
                messageReceived: '#e6f3ff',
                messageSent: '#b3d9ff',
                textPrimary: '#003d5c',
                textSecondary: '#006699',
                border: '#b3d9ff',
                online: '#00cc66',
                away: '#ff9933',
                offline: '#999999'
            },
            forest: {
                name: 'Forest Green',
                primary: '#2d5a27',
                primaryDark: '#1e3d1b',
                background: '#f8fff8',
                sidebar: '#f0f8f0',
                chatBg: '#e8f5e8',
                messageReceived: '#f0f8f0',
                messageSent: '#d4f0d4',
                textPrimary: '#1a331a',
                textSecondary: '#4d664d',
                border: '#d4f0d4',
                online: '#33cc33',
                away: '#ff9933',
                offline: '#999999'
            },
            sunset: {
                name: 'Sunset Orange',
                primary: '#e65100',
                primaryDark: '#bf360c',
                background: '#fff8f5',
                sidebar: '#ffefeb',
                chatBg: '#ffe0d6',
                messageReceived: '#ffefeb',
                messageSent: '#ffd0c2',
                textPrimary: '#4d2c1d',
                textSecondary: '#8d4a2b',
                border: '#ffd0c2',
                online: '#4caf50',
                away: '#ff9800',
                offline: '#999999'
            },
            purple: {
                name: 'Royal Purple',
                primary: '#6a1b9a',
                primaryDark: '#4a148c',
                background: '#faf8ff',
                sidebar: '#f3f0ff',
                chatBg: '#ede7ff',
                messageReceived: '#f3f0ff',
                messageSent: '#d1c4e9',
                textPrimary: '#2e1065',
                textSecondary: '#4527a0',
                border: '#d1c4e9',
                online: '#4caf50',
                away: '#ff9800',
                offline: '#999999'
            }
        };
        
        this.adaptiveComponents = [];
        this.mediaQueries = {
            darkMode: window.matchMedia('(prefers-color-scheme: dark)'),
            highContrast: window.matchMedia('(prefers-contrast: high)'),
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)')
        };
    }

    async setup() {
        console.log('🎨 Setting up adaptive theming...');
        
        this.detectSystemPreferences();
        this.setupThemeListeners();
        this.createThemeSelector();
        this.setupAdaptiveComponents();
        this.initializeTheme();
        this.setupThemeTransitions();
        
        console.log('✅ Adaptive theming ready');
    }

    detectSystemPreferences() {
        // Listen for system theme changes
        this.mediaQueries.darkMode.addListener((e) => {
            if (this.currentTheme === 'auto') {
                this.applyTheme(e.matches ? 'dark' : 'default');
            }
        });

        // Listen for high contrast preference
        this.mediaQueries.highContrast.addListener((e) => {
            this.isHighContrast = e.matches;
            this.applyHighContrastMode(e.matches);
        });

        // Listen for reduced motion preference
        this.mediaQueries.reducedMotion.addListener((e) => {
            this.applyReducedMotion(e.matches);
        });
    }

    setupThemeListeners() {
        // Theme persistence
        const savedTheme = localStorage.getItem('cipherwave-theme');
        if (savedTheme && this.colorSchemes[savedTheme]) {
            this.currentTheme = savedTheme;
        }

        // Custom theme persistence
        const savedCustomThemes = localStorage.getItem('cipherwave-custom-themes');
        if (savedCustomThemes) {
            try {
                const customThemes = JSON.parse(savedCustomThemes);
                Object.entries(customThemes).forEach(([name, theme]) => {
                    this.customThemes.set(name, theme);
                    this.colorSchemes[name] = theme;
                });
            } catch (error) {
                console.warn('Failed to load custom themes:', error);
            }
        }
    }

    createThemeSelector() {
        // Add theme selector to the UI
        const themeSelector = document.createElement('div');
        themeSelector.className = 'theme-selector';
        themeSelector.innerHTML = `
            <div class="theme-selector-header">
                <h3>Choose Theme</h3>
                <button class="theme-close-btn" aria-label="Close theme selector">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="theme-options">
                <div class="theme-option" data-theme="auto">
                    <div class="theme-preview auto-preview"></div>
                    <span>Auto (System)</span>
                </div>
                ${Object.entries(this.colorSchemes).map(([key, theme]) => `
                    <div class="theme-option" data-theme="${key}">
                        <div class="theme-preview" style="background: ${theme.primary}; border: 2px solid ${theme.border};">
                            <div class="preview-message" style="background: ${theme.messageReceived}; color: ${theme.textPrimary};"></div>
                            <div class="preview-message sent" style="background: ${theme.messageSent}; color: ${theme.textPrimary};"></div>
                        </div>
                        <span>${theme.name}</span>
                    </div>
                `).join('')}
            </div>
            <div class="theme-actions">
                <button class="btn-secondary" id="create-custom-theme">
                    <i class="fas fa-palette"></i> Create Custom
                </button>
                <button class="btn-secondary" id="high-contrast-toggle">
                    <i class="fas fa-adjust"></i> High Contrast
                </button>
            </div>
        `;

        // Add theme selector styles
        const themeStyles = document.createElement('style');
        themeStyles.textContent = `
            .theme-selector {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                z-index: 3000;
                max-width: 400px;
                width: 90vw;
                max-height: 80vh;
                overflow-y: auto;
                display: none;
            }

            .theme-selector-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 12px;
                border-bottom: 1px solid #e0e0e0;
            }

            .theme-selector-header h3 {
                margin: 0;
                color: #333;
                font-size: 18px;
                font-weight: 600;
            }

            .theme-close-btn {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #666;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .theme-close-btn:hover {
                background: #f0f0f0;
                color: #333;
            }

            .theme-options {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }

            .theme-option {
                cursor: pointer;
                text-align: center;
                padding: 12px;
                border-radius: 12px;
                transition: all 0.2s;
                border: 2px solid transparent;
            }

            .theme-option:hover {
                background: #f8f8f8;
            }

            .theme-option.selected {
                border-color: var(--tg-primary);
                background: rgba(86, 130, 163, 0.1);
            }

            .theme-preview {
                width: 60px;
                height: 40px;
                border-radius: 8px;
                margin: 0 auto 8px;
                position: relative;
                overflow: hidden;
            }

            .auto-preview {
                background: linear-gradient(45deg, #ffffff 50%, #181A20 50%);
            }

            .preview-message {
                position: absolute;
                width: 20px;
                height: 6px;
                border-radius: 3px;
                top: 8px;
                left: 6px;
            }

            .preview-message.sent {
                top: 20px;
                right: 6px;
                left: auto;
            }

            .theme-option span {
                font-size: 12px;
                color: #666;
                font-weight: 500;
            }

            .theme-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
                padding-top: 12px;
                border-top: 1px solid #e0e0e0;
            }

            .btn-secondary {
                background: #f5f5f5;
                border: 1px solid #ddd;
                color: #666;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .btn-secondary:hover {
                background: #e8e8e8;
                color: #333;
            }

            .btn-secondary.active {
                background: var(--tg-primary);
                color: white;
                border-color: var(--tg-primary);
            }
        `;
        document.head.appendChild(themeStyles);

        // Add theme selector to body
        themeSelector.id = 'theme-selector';
        document.body.appendChild(themeSelector);

        // Add event listeners
        this.setupThemeSelectorEvents(themeSelector);

        // Add theme button to header
        this.addThemeButton();
    }

    addThemeButton() {
        // Add theme button to sidebar actions
        const sidebarActions = document.querySelector('.sidebar-actions');
        if (sidebarActions) {
            const themeBtn = document.createElement('button');
            themeBtn.className = 'action-btn theme-btn';
            themeBtn.innerHTML = '<i class="fas fa-palette"></i>';
            themeBtn.title = 'Change theme';
            themeBtn.setAttribute('aria-label', 'Change theme');
            
            themeBtn.addEventListener('click', () => {
                this.showThemeSelector();
            });
            
            sidebarActions.appendChild(themeBtn);
        }
    }

    setupThemeSelectorEvents(selector) {
        // Theme option clicks
        selector.addEventListener('click', (e) => {
            const themeOption = e.target.closest('.theme-option');
            if (themeOption) {
                const theme = themeOption.dataset.theme;
                this.selectTheme(theme);
                this.updateSelectedTheme(theme);
            }

            // Close button
            if (e.target.closest('.theme-close-btn')) {
                this.hideThemeSelector();
            }

            // High contrast toggle
            if (e.target.closest('#high-contrast-toggle')) {
                this.toggleHighContrast();
            }

            // Create custom theme
            if (e.target.closest('#create-custom-theme')) {
                this.showCustomThemeEditor();
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (selector.style.display === 'block' && !selector.contains(e.target) && !e.target.closest('.theme-btn')) {
                this.hideThemeSelector();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && selector.style.display === 'block') {
                this.hideThemeSelector();
            }
        });
    }

    showThemeSelector() {
        const selector = document.getElementById('theme-selector');
        if (selector) {
            selector.style.display = 'block';
            this.updateSelectedTheme(this.currentTheme);
            
            // Animate in
            requestAnimationFrame(() => {
                selector.style.opacity = '0';
                selector.style.transform = 'translate(-50%, -50%) scale(0.9)';
                selector.style.transition = 'all 0.2s ease';
                
                requestAnimationFrame(() => {
                    selector.style.opacity = '1';
                    selector.style.transform = 'translate(-50%, -50%) scale(1)';
                });
            });
        }
    }

    hideThemeSelector() {
        const selector = document.getElementById('theme-selector');
        if (selector) {
            selector.style.opacity = '0';
            selector.style.transform = 'translate(-50%, -50%) scale(0.9)';
            
            setTimeout(() => {
                selector.style.display = 'none';
            }, 200);
        }
    }

    updateSelectedTheme(selectedTheme) {
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.classList.toggle('selected', option.dataset.theme === selectedTheme);
        });

        // Update high contrast toggle
        const highContrastBtn = document.getElementById('high-contrast-toggle');
        if (highContrastBtn) {
            highContrastBtn.classList.toggle('active', this.isHighContrast);
        }
    }

    selectTheme(themeName) {
        this.currentTheme = themeName;
        localStorage.setItem('cipherwave-theme', themeName);
        
        if (themeName === 'auto') {
            const isDark = this.mediaQueries.darkMode.matches;
            this.applyTheme(isDark ? 'dark' : 'default');
        } else {
            this.applyTheme(themeName);
        }

        this.announceToScreenReader(`Theme changed to ${this.getThemeName(themeName)}`);
    }

    getThemeName(themeKey) {
        if (themeKey === 'auto') return 'Auto (System)';
        return this.colorSchemes[themeKey]?.name || themeKey;
    }

    applyTheme(themeName) {
        const theme = this.colorSchemes[themeName];
        if (!theme) return;

        // Apply CSS custom properties
        const root = document.documentElement;
        Object.entries(theme).forEach(([key, value]) => {
            if (key !== 'name') {
                root.style.setProperty(`--tg-${this.camelToKebab(key)}`, value);
            }
        });

        // Update meta theme color for browsers
        let themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (!themeColorMeta) {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.name = 'theme-color';
            document.head.appendChild(themeColorMeta);
        }
        themeColorMeta.content = theme.primary;

        // Update body class for theme-specific styles
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        document.body.classList.add(`theme-${themeName}`);

        // Trigger adaptive component updates
        this.updateAdaptiveComponents(theme);
    }

    camelToKebab(str) {
        return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }

    setupAdaptiveComponents() {
        // Register components that adapt to theme changes
        this.adaptiveComponents = [
            {
                element: '.messages-container',
                adapt: (theme) => {
                    const container = document.querySelector('.messages-container');
                    if (container) {
                        // Adjust message contrast based on theme
                        const messages = container.querySelectorAll('.message');
                        messages.forEach(message => {
                            this.adaptMessageContrast(message, theme);
                        });
                    }
                }
            },
            {
                element: '.modal',
                adapt: (theme) => {
                    const modals = document.querySelectorAll('.modal');
                    modals.forEach(modal => {
                        // Adapt modal appearance
                        const content = modal.querySelector('.modal-content');
                        if (content) {
                            content.style.background = theme.background;
                            content.style.color = theme.textPrimary;
                        }
                    });
                }
            }
        ];
    }

    updateAdaptiveComponents(theme) {
        this.adaptiveComponents.forEach(component => {
            if (component.adapt) {
                component.adapt(theme);
            }
        });
    }

    adaptMessageContrast(messageElement, theme) {
        // Ensure sufficient contrast for readability
        const isReceived = messageElement.classList.contains('received');
        const backgroundColor = isReceived ? theme.messageReceived : theme.messageSent;
        const textColor = theme.textPrimary;
        
        // Calculate contrast ratio and adjust if needed
        const contrast = this.calculateContrast(backgroundColor, textColor);
        if (contrast < 4.5) {
            // Adjust text color for better contrast
            messageElement.style.color = this.adjustColorForContrast(backgroundColor, textColor);
        }
    }

    calculateContrast(bg, text) {
        // Simplified contrast calculation
        const bgLuminance = this.getLuminance(bg);
        const textLuminance = this.getLuminance(text);
        
        const lighter = Math.max(bgLuminance, textLuminance);
        const darker = Math.min(bgLuminance, textLuminance);
        
        return (lighter + 0.05) / (darker + 0.05);
    }

    getLuminance(color) {
        // Convert hex to RGB and calculate relative luminance
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        
        const sRGB = [r, g, b].map(c => {
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        
        return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    }

    adjustColorForContrast(backgroundColor, textColor) {
        // Adjust text color to meet contrast requirements
        const bgLuminance = this.getLuminance(backgroundColor);
        return bgLuminance > 0.5 ? '#000000' : '#ffffff';
    }

    toggleHighContrast() {
        this.isHighContrast = !this.isHighContrast;
        this.applyHighContrastMode(this.isHighContrast);
        
        // Update button state
        const highContrastBtn = document.getElementById('high-contrast-toggle');
        if (highContrastBtn) {
            highContrastBtn.classList.toggle('active', this.isHighContrast);
        }
        
        this.announceToScreenReader(`High contrast ${this.isHighContrast ? 'enabled' : 'disabled'}`);
    }

    applyHighContrastMode(enabled) {
        const root = document.documentElement;
        
        if (enabled) {
            root.classList.add('high-contrast');
            // Apply high contrast colors
            root.style.setProperty('--tg-border', '#000000');
            root.style.setProperty('--tg-text-secondary', '#000000');
            root.style.setProperty('--contrast-ratio', '21:1');
        } else {
            root.classList.remove('high-contrast');
            // Restore normal colors based on current theme
            this.applyTheme(this.currentTheme === 'auto' ? 
                (this.mediaQueries.darkMode.matches ? 'dark' : 'default') : 
                this.currentTheme);
        }
    }

    applyReducedMotion(enabled) {
        const root = document.documentElement;
        
        if (enabled) {
            root.classList.add('reduced-motion');
        } else {
            root.classList.remove('reduced-motion');
        }
    }

    setupThemeTransitions() {
        // Add smooth transitions between themes
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --theme-transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            * {
                transition: background-color 0.3s ease, 
                           color 0.3s ease, 
                           border-color 0.3s ease;
            }

            .theme-transition {
                transition: var(--theme-transition);
            }

            .reduced-motion * {
                transition: none !important;
                animation: none !important;
            }

            .high-contrast {
                --tg-border: #000000 !important;
                --tg-text-secondary: #000000 !important;
            }

            .high-contrast .message {
                border: 2px solid !important;
            }

            .high-contrast .btn {
                border-width: 3px !important;
            }

            @media (prefers-reduced-motion: reduce) {
                * {
                    transition: none !important;
                    animation: none !important;
                }
            }

            @media (prefers-contrast: high) {
                .high-contrast {
                    --tg-border: #000000 !important;
                    --tg-text-secondary: #000000 !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    showCustomThemeEditor() {
        // Create custom theme editor
        const editor = document.createElement('div');
        editor.className = 'custom-theme-editor';
        editor.innerHTML = `
            <div class="theme-editor-header">
                <h3>Create Custom Theme</h3>
                <button class="theme-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="theme-editor-content">
                <div class="color-input-group">
                    <label>Theme Name</label>
                    <input type="text" id="custom-theme-name" placeholder="My Custom Theme">
                </div>
                <div class="color-input-group">
                    <label>Primary Color</label>
                    <input type="color" id="custom-primary" value="#5682a3">
                </div>
                <div class="color-input-group">
                    <label>Background Color</label>
                    <input type="color" id="custom-background" value="#ffffff">
                </div>
                <div class="color-input-group">
                    <label>Text Color</label>
                    <input type="color" id="custom-text" value="#212121">
                </div>
                <div class="theme-preview-area">
                    <div class="custom-preview">
                        <div class="preview-header" style="background: #5682a3; color: white;">
                            <span>Preview</span>
                        </div>
                        <div class="preview-messages" style="background: #f0f4f8;">
                            <div class="preview-msg received" style="background: #f0f4f8; color: #212121;">Hello!</div>
                            <div class="preview-msg sent" style="background: #e3f2fd; color: #212121;">Hi there!</div>
                        </div>
                    </div>
                </div>
                <div class="theme-editor-actions">
                    <button class="btn-secondary" id="preview-custom-theme">Preview</button>
                    <button class="btn-primary" id="save-custom-theme">Save Theme</button>
                </div>
            </div>
        `;

        // Add editor styles
        const editorStyles = document.createElement('style');
        editorStyles.textContent = `
            .custom-theme-editor {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                z-index: 3001;
                max-width: 500px;
                width: 90vw;
                max-height: 80vh;
                overflow-y: auto;
            }

            .color-input-group {
                margin-bottom: 16px;
            }

            .color-input-group label {
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #333;
            }

            .color-input-group input[type="text"] {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
            }

            .color-input-group input[type="color"] {
                width: 100%;
                height: 40px;
                border: 1px solid #ddd;
                border-radius: 6px;
                cursor: pointer;
            }

            .custom-preview {
                border: 1px solid #ddd;
                border-radius: 8px;
                overflow: hidden;
                margin: 16px 0;
            }

            .preview-header {
                padding: 12px;
                font-weight: 600;
            }

            .preview-messages {
                padding: 16px;
            }

            .preview-msg {
                padding: 8px 12px;
                border-radius: 12px;
                margin-bottom: 8px;
                max-width: 70%;
            }

            .preview-msg.sent {
                margin-left: auto;
            }

            .theme-editor-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                margin-top: 20px;
            }

            .btn-primary {
                background: var(--tg-primary);
                color: white;
                border: 1px solid var(--tg-primary);
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .btn-primary:hover {
                background: var(--tg-primary-dark);
            }
        `;
        document.head.appendChild(editorStyles);

        document.body.appendChild(editor);

        // Setup editor event listeners
        this.setupCustomThemeEditor(editor);
    }

    setupCustomThemeEditor(editor) {
        const inputs = editor.querySelectorAll('input[type="color"]');
        const nameInput = editor.querySelector('#custom-theme-name');
        const preview = editor.querySelector('.custom-preview');

        // Real-time preview updates
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.updateCustomPreview(editor);
            });
        });

        // Preview button
        editor.querySelector('#preview-custom-theme')?.addEventListener('click', () => {
            this.previewCustomTheme(editor);
        });

        // Save button
        editor.querySelector('#save-custom-theme')?.addEventListener('click', () => {
            this.saveCustomTheme(editor);
        });

        // Close button
        editor.querySelector('.theme-close-btn')?.addEventListener('click', () => {
            document.body.removeChild(editor);
        });
    }

    updateCustomPreview(editor) {
        const primary = editor.querySelector('#custom-primary').value;
        const background = editor.querySelector('#custom-background').value;
        const text = editor.querySelector('#custom-text').value;

        const preview = editor.querySelector('.custom-preview');
        const header = preview.querySelector('.preview-header');
        const messages = preview.querySelector('.preview-messages');
        const receivedMsg = preview.querySelector('.preview-msg.received');
        const sentMsg = preview.querySelector('.preview-msg.sent');

        header.style.background = primary;
        messages.style.background = this.lightenColor(background, 10);
        receivedMsg.style.background = this.lightenColor(background, 20);
        receivedMsg.style.color = text;
        sentMsg.style.background = this.lightenColor(primary, 30);
        sentMsg.style.color = text;
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    previewCustomTheme(editor) {
        const theme = this.extractCustomTheme(editor);
        // Temporarily apply the custom theme
        this.applyCustomThemePreview(theme);
        
        // Revert after 3 seconds
        setTimeout(() => {
            this.applyTheme(this.currentTheme);
        }, 3000);
    }

    saveCustomTheme(editor) {
        const theme = this.extractCustomTheme(editor);
        const name = editor.querySelector('#custom-theme-name').value.trim();
        
        if (!name) {
            alert('Please enter a theme name');
            return;
        }

        const themeKey = name.toLowerCase().replace(/\s+/g, '-');
        
        // Save to memory and storage
        this.customThemes.set(themeKey, theme);
        this.colorSchemes[themeKey] = theme;
        
        // Persist to localStorage
        const customThemes = {};
        this.customThemes.forEach((theme, key) => {
            customThemes[key] = theme;
        });
        localStorage.setItem('cipherwave-custom-themes', JSON.stringify(customThemes));
        
        // Apply the new theme
        this.selectTheme(themeKey);
        
        // Close editor and refresh theme selector
        document.body.removeChild(editor);
        this.hideThemeSelector();
        
        // Recreate theme selector with new theme
        const oldSelector = document.getElementById('theme-selector');
        if (oldSelector) {
            document.body.removeChild(oldSelector);
        }
        this.createThemeSelector();
        
        this.announceToScreenReader(`Custom theme "${name}" created and applied`);
    }

    extractCustomTheme(editor) {
        const name = editor.querySelector('#custom-theme-name').value.trim();
        const primary = editor.querySelector('#custom-primary').value;
        const background = editor.querySelector('#custom-background').value;
        const text = editor.querySelector('#custom-text').value;

        return {
            name: name,
            primary: primary,
            primaryDark: this.darkenColor(primary, 15),
            background: background,
            sidebar: this.lightenColor(background, 5),
            chatBg: this.lightenColor(background, 10),
            messageReceived: this.lightenColor(background, 15),
            messageSent: this.lightenColor(primary, 40),
            textPrimary: text,
            textSecondary: this.lightenColor(text, 30),
            border: this.lightenColor(text, 60),
            online: '#4caf50',
            away: '#ff9800',
            offline: '#9e9e9e'
        };
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
            (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
            (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
    }

    applyCustomThemePreview(theme) {
        const root = document.documentElement;
        Object.entries(theme).forEach(([key, value]) => {
            if (key !== 'name') {
                root.style.setProperty(`--tg-${this.camelToKebab(key)}`, value);
            }
        });
    }

    initializeTheme() {
        if (this.currentTheme === 'auto') {
            const isDark = this.mediaQueries.darkMode.matches;
            this.applyTheme(isDark ? 'dark' : 'default');
        } else {
            this.applyTheme(this.currentTheme);
        }

        // Apply initial high contrast if needed
        if (this.mediaQueries.highContrast.matches) {
            this.isHighContrast = true;
            this.applyHighContrastMode(true);
        }

        // Apply reduced motion if needed
        if (this.mediaQueries.reducedMotion.matches) {
            this.applyReducedMotion(true);
        }
    }

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
}

// Export for use in other modules
window.AdaptiveThemeManager = AdaptiveThemeManager;