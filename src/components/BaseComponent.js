// Base Component Interface for CipherWave UI Components
// Provides common functionality and lifecycle management

class BaseComponent {
    constructor(container, options = {}) {
        this.container = container;
        this.options = { ...this.getDefaultOptions(), ...options };
        this.element = null;
        this.eventListeners = new Map();
        this.isDestroyed = false;
        
        this.validateContainer();
        this.bindMethods();
    }
    
    getDefaultOptions() {
        return {
            className: '',
            id: '',
            autoRender: true
        };
    }
    
    validateContainer() {
        if (!this.container || !(this.container instanceof Element)) {
            throw new Error('Invalid container element provided to component');
        }
    }
    
    bindMethods() {
        // Bind all methods to preserve 'this' context
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
            .filter(name => name !== 'constructor' && typeof this[name] === 'function');
        
        methods.forEach(method => {
            this[method] = this[method].bind(this);
        });
    }
    
    // Template method - must be implemented by subclasses
    createTemplate() {
        throw new Error('createTemplate() must be implemented by subclass');
    }
    
    // Render the component
    render() {
        if (this.isDestroyed) {
            console.warn('Attempted to render destroyed component');
            return this;
        }
        
        const template = this.createTemplate();
        
        if (typeof template === 'string') {
            this.container.innerHTML = template;
            this.element = this.container.firstElementChild || this.container;
        } else if (template instanceof Element) {
            this.container.innerHTML = '';
            this.container.appendChild(template);
            this.element = template;
        }
        
        this.afterRender();
        return this;
    }
    
    // Hook called after rendering
    afterRender() {
        this.attachEventListeners();
        this.initializeSubComponents();
    }
    
    // Attach event listeners - override in subclasses
    attachEventListeners() {
        // Override in subclasses
    }
    
    // Initialize sub-components - override in subclasses
    initializeSubComponents() {
        // Override in subclasses
    }
    
    // Utility method to add event listeners with cleanup tracking
    addEventListener(element, event, handler, options = {}) {
        if (this.isDestroyed) return;
        
        const wrappedHandler = (e) => {
            if (!this.isDestroyed) {
                handler(e);
            }
        };
        
        element.addEventListener(event, wrappedHandler, options);
        
        // Track for cleanup
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        this.eventListeners.get(element).push({ event, handler: wrappedHandler, options });
    }
    
    // Find element within component
    querySelector(selector) {
        return this.element ? this.element.querySelector(selector) : null;
    }
    
    querySelectorAll(selector) {
        return this.element ? this.element.querySelectorAll(selector) : [];
    }
    
    // Update component options
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        this.onOptionsUpdate();
    }
    
    // Hook for option updates
    onOptionsUpdate() {
        // Override in subclasses if needed
    }
    
    // Show component
    show() {
        if (this.element) {
            this.element.classList.remove('hidden');
            this.element.style.display = '';
        }
        return this;
    }
    
    // Hide component
    hide() {
        if (this.element) {
            this.element.classList.add('hidden');
        }
        return this;
    }
    
    // Toggle visibility
    toggle() {
        if (this.element) {
            if (this.element.classList.contains('hidden')) {
                this.show();
            } else {
                this.hide();
            }
        }
        return this;
    }
    
    // Add CSS classes
    addClass(className) {
        if (this.element && className) {
            this.element.classList.add(className);
        }
        return this;
    }
    
    // Remove CSS classes
    removeClass(className) {
        if (this.element && className) {
            this.element.classList.remove(className);
        }
        return this;
    }
    
    // Check if has class
    hasClass(className) {
        return this.element ? this.element.classList.contains(className) : false;
    }
    
    // Update component state
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.onStateChange();
    }
    
    // Hook for state changes
    onStateChange() {
        // Override in subclasses if needed
    }
    
    // Emit custom events
    emit(eventName, detail = {}) {
        if (this.element && !this.isDestroyed) {
            const event = new CustomEvent(eventName, {
                detail,
                bubbles: true,
                cancelable: true
            });
            this.element.dispatchEvent(event);
        }
    }
    
    // Clean up component
    destroy() {
        if (this.isDestroyed) return;
        
        this.beforeDestroy();
        
        // Remove all event listeners
        this.eventListeners.forEach((listeners, element) => {
            listeners.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
        });
        this.eventListeners.clear();
        
        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        this.isDestroyed = true;
        this.afterDestroy();
    }
    
    // Hook called before destruction
    beforeDestroy() {
        // Override in subclasses
    }
    
    // Hook called after destruction
    afterDestroy() {
        // Override in subclasses
    }
    
    // Utility method for creating DOM elements
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key.startsWith('on') && typeof value === 'function') {
                // Handle event listeners
                const eventName = key.slice(2).toLowerCase();
                this.addEventListener(element, eventName, value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        if (content) {
            if (typeof content === 'string') {
                element.innerHTML = content;
            } else if (content instanceof Element) {
                element.appendChild(content);
            }
        }
        
        return element;
    }
    
    // Utility method for sanitizing HTML
    sanitizeHTML(html) {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = html;
        return tempDiv.innerHTML;
    }
    
    // Utility method for escaping HTML
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Static method to create component instance
    static create(container, options = {}) {
        return new this(container, options);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseComponent;
} else if (typeof window !== 'undefined') {
    window.BaseComponent = BaseComponent;
}