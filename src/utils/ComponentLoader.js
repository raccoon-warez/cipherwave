// Component Loader Utility for CipherWave
// Handles dynamic loading and initialization of components

class ComponentLoader {
    constructor() {
        this.loadedComponents = new Set();
        this.componentRegistry = new Map();
        this.loadingPromises = new Map();
    }
    
    // Register a component class
    register(name, componentClass) {
        this.componentRegistry.set(name, componentClass);
    }
    
    // Load a component script dynamically
    async loadScript(src) {
        if (this.loadingPromises.has(src)) {
            return this.loadingPromises.get(src);
        }
        
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                this.loadedComponents.add(src);
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
        
        this.loadingPromises.set(src, promise);
        return promise;
    }
    
    // Load multiple scripts in parallel
    async loadScripts(scripts) {
        const promises = scripts.map(src => this.loadScript(src));
        return Promise.all(promises);
    }
    
    // Load a component and its dependencies
    async loadComponent(componentName, dependencies = []) {
        try {
            // Load dependencies first
            if (dependencies.length > 0) {
                await this.loadScripts(dependencies);
            }
            
            // Check if component is already registered
            if (this.componentRegistry.has(componentName)) {
                return this.componentRegistry.get(componentName);
            }
            
            // Load component script
            const componentPath = `src/components/${componentName}.js`;
            await this.loadScript(componentPath);
            
            // Check if component was registered after loading
            if (this.componentRegistry.has(componentName)) {
                return this.componentRegistry.get(componentName);
            }
            
            // Try to get from global scope
            const globalName = componentName.replace('Component', '');
            if (window[componentName]) {
                this.register(componentName, window[componentName]);
                return window[componentName];
            }
            
            throw new Error(`Component ${componentName} not found after loading`);
            
        } catch (error) {
            console.error(`Failed to load component ${componentName}:`, error);
            throw error;
        }
    }
    
    // Create a component instance
    async createComponent(componentName, container, options = {}) {
        const ComponentClass = await this.loadComponent(componentName);
        return new ComponentClass(container, options);
    }
    
    // Load all required components for the app
    async loadAppComponents() {
        const components = [
            { name: 'BaseComponent', path: 'src/components/BaseComponent.js' },
            { name: 'SidebarComponent', path: 'src/components/SidebarComponent.js' },
            { name: 'ChatComponent', path: 'src/components/ChatComponent.js' },
            { name: 'InputComponent', path: 'src/components/InputComponent.js' },
            { name: 'FileComponent', path: 'src/components/FileComponent.js' },
            { name: 'SettingsComponent', path: 'src/components/SettingsComponent.js' }
        ];
        
        for (const component of components) {
            await this.loadScript(component.path);
            
            // Auto-register from global scope
            if (window[component.name]) {
                this.register(component.name, window[component.name]);
            }
        }
        
        return this.componentRegistry;
    }
    
    // Check if a script is already loaded
    isLoaded(src) {
        return this.loadedComponents.has(src);
    }
    
    // Get registered component
    getComponent(name) {
        return this.componentRegistry.get(name);
    }
    
    // List all registered components
    listComponents() {
        return Array.from(this.componentRegistry.keys());
    }
    
    // Preload components for faster initialization
    async preloadComponents(componentNames) {
        const promises = componentNames.map(name => this.loadComponent(name));
        return Promise.all(promises);
    }
    
    // Clear loaded components (for testing/reset)
    clear() {
        this.loadedComponents.clear();
        this.componentRegistry.clear();
        this.loadingPromises.clear();
    }
}

// Create global instance
const componentLoader = new ComponentLoader();

// Auto-register components from global scope
if (typeof window !== 'undefined') {
    // Check for existing components
    const componentNames = [
        'BaseComponent',
        'SidebarComponent', 
        'ChatComponent',
        'InputComponent',
        'FileComponent',
        'SettingsComponent'
    ];
    
    componentNames.forEach(name => {
        if (window[name]) {
            componentLoader.register(name, window[name]);
        }
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComponentLoader;
} else if (typeof window !== 'undefined') {
    window.ComponentLoader = ComponentLoader;
    window.componentLoader = componentLoader;
}