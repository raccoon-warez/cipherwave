// Sidebar Component for CipherWave - Telegram-like Navigation
// Handles navigation, user profile display, and connection status

class SidebarComponent extends BaseComponent {
    constructor(container, options = {}) {
        super(container, options);
        
        this.state = {
            collapsed: false,
            mobileExpanded: false,
            activeNav: 'chat',
            connectionStatus: 'disconnected',
            userInfo: {
                name: 'CipherWave User',
                id: 'CW-XXXXXX',
                avatar: '/cipherwave.png',
                status: 'Online'
            },
            unreadCount: 0
        };
        
        if (this.options.autoRender) {
            this.render();
        }
    }
    
    getDefaultOptions() {
        return {
            ...super.getDefaultOptions(),
            className: 'sidebar',
            showUserProfile: true,
            showConnectionStatus: true,
            collapsible: true,
            mobileResponsive: true
        };
    }
    
    createTemplate() {
        return `
            <div class="${this.options.className} ${this.state.collapsed ? 'collapsed' : ''} ${this.state.mobileExpanded ? 'mobile-expanded' : ''}">
                ${this.createHeader()}
                ${this.options.showUserProfile ? this.createUserProfile() : ''}
                ${this.createNavigation()}
                ${this.options.showConnectionStatus ? this.createConnectionStatus() : ''}
            </div>
        `;
    }
    
    createHeader() {
        return `
            <div class="sidebar-header">
                <div class="app-logo">
                    <img src="/cipherwave.png" alt="CipherWave" class="logo-icon">
                    <span class="logo-text">CipherWave</span>
                </div>
                ${this.options.collapsible ? `
                    <button class="sidebar-toggle" type="button" aria-label="Toggle sidebar">
                        <i class="fas fa-bars"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    createUserProfile() {
        return `
            <div class="user-profile-sidebar">
                <div class="user-avatar-container">
                    <img src="${this.state.userInfo.avatar}" alt="${this.state.userInfo.name}" class="user-avatar">
                    <div class="status-indicator ${this.state.connectionStatus === 'connected' ? 'online' : 'offline'}"></div>
                </div>
                <div class="user-details">
                    <div class="user-name">${this.escapeHTML(this.state.userInfo.name)}</div>
                    <div class="user-status">${this.escapeHTML(this.state.userInfo.status)}</div>
                    <div class="user-id">${this.escapeHTML(this.state.userInfo.id)}</div>
                </div>
            </div>
        `;
    }
    
    createNavigation() {
        const navItems = [
            { id: 'chat', icon: 'fas fa-comments', label: 'Chat', badge: this.state.unreadCount > 0 ? this.state.unreadCount : null },
            { id: 'settings', icon: 'fas fa-cog', label: 'Settings' },
            { id: 'security', icon: 'fas fa-shield-alt', label: 'Security' },
            { id: 'debug', icon: 'fas fa-bug', label: 'Debug' }
        ];
        
        return `
            <nav class="sidebar-nav">
                ${navItems.map(item => `
                    <button class="nav-item ${this.state.activeNav === item.id ? 'active' : ''}" 
                            data-nav="${item.id}" 
                            type="button"
                            aria-label="${item.label}">
                        <i class="${item.icon}"></i>
                        <span>${item.label}</span>
                        ${item.badge ? `<span class="badge">${item.badge > 99 ? '99+' : item.badge}</span>` : ''}
                    </button>
                `).join('')}
            </nav>
        `;
    }
    
    createConnectionStatus() {
        const statusConfig = {
            connected: { dot: 'connected', text: 'Connected', icon: 'fas fa-check-circle' },
            connecting: { dot: 'connecting', text: 'Connecting...', icon: 'fas fa-spinner fa-spin' },
            disconnected: { dot: '', text: 'Disconnected', icon: 'fas fa-times-circle' }
        };
        
        const config = statusConfig[this.state.connectionStatus] || statusConfig.disconnected;
        
        return `
            <div class="connection-status-sidebar">
                <div class="status-indicator-container">
                    <div class="status-dot ${config.dot}"></div>
                    <span>
                        <i class="${config.icon}"></i>
                        ${config.text}
                    </span>
                </div>
            </div>
        `;
    }
    
    attachEventListeners() {
        // Sidebar toggle
        const toggleBtn = this.querySelector('.sidebar-toggle');
        if (toggleBtn) {
            this.addEventListener(toggleBtn, 'click', this.handleToggle);
        }
        
        // Navigation items
        const navItems = this.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            this.addEventListener(item, 'click', this.handleNavClick);
        });
        
        // Mobile responsive handling
        if (this.options.mobileResponsive) {
            this.setupMobileHandling();
        }
        
        // Header click for mobile expansion
        const header = this.querySelector('.sidebar-header');
        if (header && this.options.mobileResponsive) {
            this.addEventListener(header, 'click', this.handleMobileHeaderClick);
        }
    }
    
    setupMobileHandling() {
        // Handle window resize
        this.addEventListener(window, 'resize', this.handleResize);
        
        // Initial check
        this.handleResize();
        
        // Click outside to collapse on mobile
        this.addEventListener(document, 'click', this.handleOutsideClick);
    }
    
    handleToggle(event) {
        event.preventDefault();
        this.toggleCollapse();
    }
    
    handleNavClick(event) {
        event.preventDefault();
        const navId = event.currentTarget.dataset.nav;
        if (navId) {
            this.setActiveNav(navId);
            this.emit('navigationChange', { activeNav: navId, previousNav: this.state.activeNav });
        }
    }
    
    handleMobileHeaderClick(event) {
        if (window.innerWidth <= 768) {
            event.preventDefault();
            this.toggleMobileExpansion();
        }
    }
    
    handleResize() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile && !this.state.collapsed) {
            // Auto-collapse on mobile unless expanded
            this.setState({ collapsed: true });
            this.updateClasses();
        } else if (!isMobile && this.state.mobileExpanded) {
            // Remove mobile expansion on desktop
            this.setState({ mobileExpanded: false });
            this.updateClasses();
        }
    }
    
    handleOutsideClick(event) {
        if (window.innerWidth <= 768 && this.state.mobileExpanded) {
            if (!this.element.contains(event.target)) {
                this.setState({ mobileExpanded: false });
                this.updateClasses();
            }
        }
    }
    
    toggleCollapse() {
        this.setState({ collapsed: !this.state.collapsed });
        this.updateClasses();
        this.emit('sidebarToggle', { collapsed: this.state.collapsed });
    }
    
    toggleMobileExpansion() {
        this.setState({ mobileExpanded: !this.state.mobileExpanded });
        this.updateClasses();
    }
    
    setActiveNav(navId) {
        const previousNav = this.state.activeNav;
        this.setState({ activeNav: navId });
        this.updateNavigationClasses();
        
        // Auto-collapse mobile expansion after navigation
        if (window.innerWidth <= 768 && this.state.mobileExpanded) {
            setTimeout(() => {
                this.setState({ mobileExpanded: false });
                this.updateClasses();
            }, 200);
        }
    }
    
    updateNavigationClasses() {
        const navItems = this.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const navId = item.dataset.nav;
            if (navId === this.state.activeNav) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    updateClasses() {
        if (this.element) {
            this.element.className = `${this.options.className} ${this.state.collapsed ? 'collapsed' : ''} ${this.state.mobileExpanded ? 'mobile-expanded' : ''}`;
        }
    }
    
    // Public API methods
    setConnectionStatus(status) {
        this.setState({ connectionStatus: status });
        this.updateConnectionStatus();
    }
    
    updateConnectionStatus() {
        const statusContainer = this.querySelector('.connection-status-sidebar');
        if (statusContainer) {
            statusContainer.innerHTML = this.createConnectionStatus().match(/<div class="status-indicator-container">[\s\S]*?<\/div>/)[0];
        }
    }
    
    setUserInfo(userInfo) {
        this.setState({ userInfo: { ...this.state.userInfo, ...userInfo } });
        this.updateUserProfile();
    }
    
    updateUserProfile() {
        if (!this.options.showUserProfile) return;
        
        const profileContainer = this.querySelector('.user-profile-sidebar');
        if (profileContainer) {
            profileContainer.outerHTML = this.createUserProfile();
        }
    }
    
    setUnreadCount(count) {
        this.setState({ unreadCount: Math.max(0, count) });
        this.updateUnreadBadge();
    }
    
    updateUnreadBadge() {
        const chatNavItem = this.querySelector('.nav-item[data-nav="chat"]');
        if (chatNavItem) {
            const existingBadge = chatNavItem.querySelector('.badge');
            
            if (this.state.unreadCount > 0) {
                const badgeText = this.state.unreadCount > 99 ? '99+' : this.state.unreadCount.toString();
                
                if (existingBadge) {
                    existingBadge.textContent = badgeText;
                } else {
                    const badge = this.createElement('span', { className: 'badge' }, badgeText);
                    chatNavItem.appendChild(badge);
                }
            } else if (existingBadge) {
                existingBadge.remove();
            }
        }
    }
    
    collapse() {
        if (!this.state.collapsed) {
            this.toggleCollapse();
        }
    }
    
    expand() {
        if (this.state.collapsed) {
            this.toggleCollapse();
        }
    }
    
    getActiveNav() {
        return this.state.activeNav;
    }
    
    isCollapsed() {
        return this.state.collapsed;
    }
    
    onStateChange() {
        // Auto-update UI when state changes
        this.updateClasses();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SidebarComponent;
} else if (typeof window !== 'undefined') {
    window.SidebarComponent = SidebarComponent;
}