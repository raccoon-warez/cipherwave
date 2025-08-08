// CipherWave UI Elements Diagnostic and Repair Tool
// This script identifies and fixes broken graphical interface elements

console.log('🔧 CipherWave UI Diagnostic Tool Starting...');

class UIElementsFixer {
    constructor() {
        this.issues = [];
        this.fixes = [];
        this.isDevMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        console.log(`🌐 Running in ${this.isDevMode ? 'development' : 'production'} mode`);
    }

    // Check if emojis are rendering properly
    checkEmojiSupport() {
        console.log('🔍 Checking emoji support...');
        
        const testEmojis = ['🔐', '🖥️', '🌐', '📤', '👤', '💬', '🔒', '➕', '❌', '🎲', '🔌'];
        const testDiv = document.createElement('div');
        testDiv.style.fontFamily = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji", "Android Emoji", "EmojiSymbols", sans-serif';
        testDiv.style.position = 'absolute';
        testDiv.style.left = '-9999px';
        document.body.appendChild(testDiv);

        testEmojis.forEach((emoji, index) => {
            testDiv.textContent = emoji;
            const computedStyle = window.getComputedStyle(testDiv);
            const fontFamily = computedStyle.fontFamily;
            
            if (!fontFamily.includes('Emoji') && !fontFamily.includes('Symbol')) {
                this.issues.push({
                    type: 'emoji-fallback',
                    element: emoji,
                    issue: 'Emoji font family not properly set'
                });
            }
        });

        document.body.removeChild(testDiv);
        console.log(`✅ Emoji check completed. Found ${this.issues.filter(i => i.type === 'emoji-fallback').length} issues.`);
    }

    // Check Font Awesome icon loading
    checkFontAwesome() {
        console.log('🔍 Checking Font Awesome icons...');
        
        const faIcons = document.querySelectorAll('[class*="fa-"]');
        const faStylesheet = document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]');
        
        if (!faStylesheet) {
            this.issues.push({
                type: 'font-awesome',
                element: 'stylesheet',
                issue: 'Font Awesome stylesheet not found'
            });
        } else {
            // Check if Font Awesome CSS is actually loaded
            const testIcon = document.createElement('i');
            testIcon.className = 'fas fa-shield-alt';
            testIcon.style.position = 'absolute';
            testIcon.style.left = '-9999px';
            document.body.appendChild(testIcon);
            
            setTimeout(() => {
                const computedStyle = window.getComputedStyle(testIcon, '::before');
                const content = computedStyle.getPropertyValue('content');
                
                if (!content || content === 'none' || content === '""') {
                    this.issues.push({
                        type: 'font-awesome',
                        element: 'icons',
                        issue: 'Font Awesome icons not loading properly'
                    });
                }
                
                document.body.removeChild(testIcon);
                console.log(`✅ Font Awesome check completed. Content: "${content}"`);
            }, 100);
        }

        console.log(`📊 Found ${faIcons.length} Font Awesome icon elements`);
    }

    // Check image loading
    checkImages() {
        console.log('🔍 Checking image loading...');
        
        const images = document.querySelectorAll('img');
        let brokenImages = 0;
        
        images.forEach((img, index) => {
            if (!img.complete || img.naturalHeight === 0) {
                brokenImages++;
                this.issues.push({
                    type: 'image',
                    element: img.src,
                    issue: 'Image failed to load',
                    imgElement: img
                });
            }
        });

        console.log(`📊 Found ${images.length} images, ${brokenImages} broken`);
    }

    // Fix broken emojis by ensuring proper font families
    fixEmojis() {
        console.log('🔧 Fixing emoji rendering...');
        
        // Add comprehensive emoji font fallbacks to document
        const emojiStyle = document.createElement('style');
        emojiStyle.textContent = `
            .emoji-fallback,
            .emoji-fix,
            .logo-icon,
            .welcome-icon,
            [data-emoji] {
                font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji", "Android Emoji", "EmojiSymbols", sans-serif !important;
                font-style: normal !important;
            }
            
            /* Specific emoji element fixes */
            .splash-logo::before,
            .user-avatar::before,
            .chat-avatar::before,
            .contact-avatar::before {
                font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji", "Android Emoji", "EmojiSymbols", sans-serif !important;
            }
        `;
        document.head.appendChild(emojiStyle);

        // Fix existing emoji elements
        const emojiElements = document.querySelectorAll('.logo-icon, .welcome-icon, [class*="emoji"]');
        emojiElements.forEach(elem => {
            elem.classList.add('emoji-fix');
        });

        this.fixes.push('Added emoji font fallbacks and fixed existing emoji elements');
        console.log('✅ Emoji fixes applied');
    }

    // Fix Font Awesome icons with emoji fallbacks
    fixFontAwesome() {
        console.log('🔧 Fixing Font Awesome icons...');
        
        const iconMap = {
            'fa-shield-alt': '🔐',
            'fa-server': '🖥️',
            'fa-network-wired': '🌐',
            'fa-paper-plane': '📤',
            'fa-lock': '🔒',
            'fa-plus': '➕',
            'fa-times': '❌',
            'fa-dice': '🎲',
            'fa-plug': '🔌',
            'fa-user': '👤',
            'fa-comment': '💬',
            'fa-cog': '⚙️',
            'fa-download': '📥',
            'fa-upload': '📤',
            'fa-microphone': '🎤',
            'fa-phone': '📞',
            'fa-video': '📹'
        };

        // Create fallback styles for Font Awesome icons
        const faFallbackStyle = document.createElement('style');
        const fallbackRules = Object.entries(iconMap).map(([faClass, emoji]) => {
            return `.${faClass}:before, .fas.${faClass}:before, .far.${faClass}:before { 
                content: "${emoji}" !important; 
                font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif !important; 
                font-weight: normal !important;
            }`;
        }).join('\n');

        faFallbackStyle.textContent = `
            /* Font Awesome emoji fallbacks */
            ${fallbackRules}
            
            /* Generic fallback for any FA icon that doesn't load */
            [class*="fa-"]:not([class*="fa-"]):before {
                font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif !important;
            }
        `;
        document.head.appendChild(faFallbackStyle);

        // Replace broken Font Awesome icons with emojis directly
        setTimeout(() => {
            const faIcons = document.querySelectorAll('[class*="fa-"]');
            faIcons.forEach(icon => {
                const classes = icon.className.split(' ');
                const faClass = classes.find(cls => cls.startsWith('fa-') && cls !== 'fas' && cls !== 'far' && cls !== 'fab');
                
                if (faClass && iconMap[faClass]) {
                    // Check if the icon is actually rendering
                    const computedStyle = window.getComputedStyle(icon, '::before');
                    const content = computedStyle.getPropertyValue('content');
                    
                    if (!content || content === 'none' || content === '""') {
                        // Replace with emoji
                        icon.innerHTML = `<span class="emoji-fix">${iconMap[faClass]}</span>`;
                        icon.style.fontFamily = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
                    }
                }
            });
        }, 200);

        this.fixes.push('Added Font Awesome emoji fallbacks');
        console.log('✅ Font Awesome fixes applied');
    }

    // Fix broken images
    fixImages() {
        console.log('🔧 Fixing broken images...');
        
        const brokenImages = this.issues.filter(issue => issue.type === 'image');
        
        brokenImages.forEach(issue => {
            const img = issue.imgElement;
            if (img && img.parentElement) {
                // Create emoji fallback based on image context
                let emojiReplacement = '🔐'; // Default to lock emoji
                
                if (img.alt && img.alt.toLowerCase().includes('user')) {
                    emojiReplacement = '👤';
                } else if (img.alt && img.alt.toLowerCase().includes('logo')) {
                    emojiReplacement = '🔐';
                } else if (img.alt && img.alt.toLowerCase().includes('peer')) {
                    emojiReplacement = '👤';
                }
                
                // Replace image with emoji
                const emojiSpan = document.createElement('span');
                emojiSpan.className = 'emoji-fix image-replacement';
                emojiSpan.textContent = emojiReplacement;
                emojiSpan.style.fontSize = '2rem';
                emojiSpan.style.display = 'flex';
                emojiSpan.style.alignItems = 'center';
                emojiSpan.style.justifyContent = 'center';
                emojiSpan.style.width = img.style.width || '48px';
                emojiSpan.style.height = img.style.height || '48px';
                
                img.parentElement.replaceChild(emojiSpan, img);
            }
        });

        // Set up better image error handling for future images
        const imageErrorHandler = (event) => {
            const img = event.target;
            if (img.parentElement) {
                const emojiSpan = document.createElement('span');
                emojiSpan.className = 'emoji-fix image-replacement';
                emojiSpan.textContent = '🔐';
                emojiSpan.style.fontSize = '2rem';
                emojiSpan.style.display = 'flex';
                emojiSpan.style.alignItems = 'center';
                emojiSpan.style.justifyContent = 'center';
                
                img.parentElement.replaceChild(emojiSpan, img);
            }
        };

        // Add error handler to all existing images
        document.querySelectorAll('img').forEach(img => {
            img.addEventListener('error', imageErrorHandler);
        });

        // Add error handler to future images
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'IMG') {
                            node.addEventListener('error', imageErrorHandler);
                        }
                        const imgs = node.querySelectorAll && node.querySelectorAll('img');
                        if (imgs) {
                            imgs.forEach(img => {
                                img.addEventListener('error', imageErrorHandler);
                            });
                        }
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        this.fixes.push('Fixed broken images and added error handling');
        console.log('✅ Image fixes applied');
    }

    // Add visual feedback for successful loading
    addLoadingFeedback() {
        console.log('🔧 Adding visual feedback...');
        
        // Add a subtle indicator that the fixes have been applied
        const indicator = document.createElement('div');
        indicator.id = 'ui-fixes-indicator';
        indicator.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 0.8rem;
                z-index: 10000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                transition: opacity 0.3s ease;
            ">
                🔧 UI Elements Fixed (${this.fixes.length} fixes applied)
            </div>
        `;
        
        document.body.appendChild(indicator);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentElement) {
                    indicator.parentElement.removeChild(indicator);
                }
            }, 300);
        }, 3000);

        console.log('✅ Visual feedback added');
    }

    // Run complete diagnostic and fix cycle
    async runDiagnostic() {
        console.log('🚀 Starting comprehensive UI diagnostic...');
        
        // Run all checks
        this.checkEmojiSupport();
        this.checkFontAwesome();
        this.checkImages();
        
        // Wait a bit for async checks to complete
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log(`📊 Diagnostic completed. Found ${this.issues.length} issues:`);
        this.issues.forEach((issue, index) => {
            console.log(`  ${index + 1}. ${issue.type}: ${issue.issue} (${issue.element})`);
        });
        
        // Apply fixes
        this.fixEmojis();
        this.fixFontAwesome();
        this.fixImages();
        this.addLoadingFeedback();
        
        console.log(`✅ All fixes applied. Total: ${this.fixes.length} fixes`);
        this.fixes.forEach((fix, index) => {
            console.log(`  ${index + 1}. ${fix}`);
        });
        
        return {
            issues: this.issues,
            fixes: this.fixes,
            success: true
        };
    }
}

// Auto-run when DOM is ready
function initUIFixer() {
    const fixer = new UIElementsFixer();
    fixer.runDiagnostic().then(result => {
        console.log('🎉 CipherWave UI diagnostic and repair completed successfully!');
        
        // Make fixer available globally for debugging
        window.cipherWaveUIFixer = fixer;
        
        // Dispatch custom event for other scripts
        window.dispatchEvent(new CustomEvent('cipherwave:ui-fixed', { detail: result }));
    }).catch(error => {
        console.error('❌ UI diagnostic failed:', error);
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUIFixer);
} else {
    initUIFixer();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIElementsFixer;
}