# CipherWave Modular Architecture

## Overview

CipherWave has been refactored from a monolithic structure into a modern, modular component-based architecture. This document outlines the new structure, benefits, and usage patterns.

## Architecture Benefits

### Before (Monolithic)
- ❌ 1800+ line HTML files with embedded CSS
- ❌ Mixed development/production UIs
- ❌ No proper component separation
- ❌ Difficult to maintain and test
- ❌ Poor code reusability

### After (Modular)
- ✅ Separate, focused components
- ✅ Reusable component architecture
- ✅ Clean separation of concerns
- ✅ Easy to test and maintain
- ✅ Mobile-first responsive design
- ✅ Consistent component interfaces

## Directory Structure

```
src/
├── components/
│   ├── BaseComponent.js        # Base class for all components
│   ├── SidebarComponent.js     # Navigation sidebar
│   ├── ChatComponent.js        # Chat interface and messaging
│   ├── InputComponent.js       # Enhanced input handling
│   ├── FileComponent.js        # File sharing and management
│   └── SettingsComponent.js    # Application settings
├── styles/
│   ├── base.css               # Base styles and CSS variables
│   ├── components.css         # Component-specific styles
│   └── responsive.css         # Mobile-responsive design
├── utils/
│   └── ComponentLoader.js     # Dynamic component loading
└── CipherWaveApp.js          # Main application orchestrator
```

## Component Architecture

### BaseComponent

All components inherit from `BaseComponent`, which provides:

- **Lifecycle Management**: `render()`, `destroy()`, `beforeDestroy()`, `afterRender()`
- **Event Handling**: Automatic cleanup, custom event emission
- **State Management**: Built-in state tracking with change detection
- **DOM Utilities**: Safe element creation, querying, and manipulation
- **Accessibility**: ARIA support, keyboard navigation
- **Error Handling**: Graceful degradation and error boundaries

```javascript
class MyComponent extends BaseComponent {
    constructor(container, options = {}) {
        super(container, options);
        this.state = { visible: false };
    }
    
    createTemplate() {
        return `<div class="my-component">Content</div>`;
    }
    
    attachEventListeners() {
        const button = this.querySelector('.my-button');
        this.addEventListener(button, 'click', this.handleClick);
    }
    
    handleClick() {
        this.emit('customEvent', { data: 'value' });
    }
}
```

### Component Communication

Components communicate through:

1. **Custom Events**: Components emit events that parents can listen to
2. **Public APIs**: Direct method calls for component interaction
3. **Shared State**: Application-level state management
4. **Event Bus**: Global event system for loose coupling

```javascript
// Event emission
this.emit('messageSend', { message: messageData });

// Event listening
component.addEventListener('messageSend', (event) => {
    console.log('Message:', event.detail.message);
});

// Direct API calls
component.show();
component.updateSettings(newSettings);
```

## Key Components

### SidebarComponent
- **Purpose**: Navigation, user profile, connection status
- **Features**: Collapsible, mobile-responsive, unread badges
- **API**: `setActiveNav()`, `setConnectionStatus()`, `setUnreadCount()`

### ChatComponent
- **Purpose**: Message display, chat interface, real-time updates
- **Features**: Message batching, typing indicators, status tracking
- **API**: `addMessage()`, `updateMessageStatus()`, `setTyping()`

### InputComponent
- **Purpose**: Enhanced input handling with validation
- **Features**: Real-time validation, custom actions, accessibility
- **API**: `setValue()`, `addValidator()`, `focus()`, `validate()`

### FileComponent
- **Purpose**: File sharing, drag-drop, encryption
- **Features**: Progress tracking, file preview, security scanning
- **API**: `processFiles()`, `addFiles()`, `getSelectedFiles()`

### SettingsComponent
- **Purpose**: Application configuration, preferences
- **Features**: Persistent storage, validation, import/export
- **API**: `updateSetting()`, `saveSettings()`, `resetSettings()`

## CSS Architecture

### CSS Variables
All styling uses CSS custom properties for consistency:

```css
:root {
    --primary: #0088cc;
    --bg-primary: #212121;
    --spacing-md: 16px;
    --radius-lg: 12px;
    --transition-fast: 0.15s ease;
}
```

### Component Styles
- **base.css**: Core styles, utilities, variables
- **components.css**: Component-specific styling
- **responsive.css**: Mobile-first responsive design

### Responsive Design
- Mobile-first approach with progressive enhancement
- Breakpoints: 480px, 768px, 1024px
- Touch-friendly interactions
- Safe area handling for notched devices

## Usage Examples

### Basic Component Usage

```javascript
// Create a component
const sidebar = new SidebarComponent(container, {
    showUserProfile: true,
    collapsible: true
});

// Listen to events
sidebar.addEventListener('navigationChange', (event) => {
    const { activeNav } = event.detail;
    showView(activeNav);
});

// Update component state
sidebar.setConnectionStatus('connected');
sidebar.setUnreadCount(5);
```

### Application Integration

```javascript
// Initialize the main application
const app = new CipherWaveApp(document.getElementById('app'), {
    debug: true,
    persistState: true,
    theme: 'dark'
});

// Access components
const chatComponent = app.getComponent('chat');
chatComponent.addMessage({
    content: 'Hello, World!',
    type: 'sent',
    timestamp: Date.now()
});
```

### Dynamic Component Loading

```javascript
// Load component dynamically
const ComponentClass = await componentLoader.loadComponent('ChatComponent');
const chat = new ComponentClass(container, options);

// Preload multiple components
await componentLoader.preloadComponents([
    'SidebarComponent',
    'SettingsComponent'
]);
```

## Testing Strategy

### Unit Testing
Each component can be tested in isolation:

```javascript
describe('SidebarComponent', () => {
    let component;
    let container;
    
    beforeEach(() => {
        container = document.createElement('div');
        component = new SidebarComponent(container);
    });
    
    afterEach(() => {
        component.destroy();
    });
    
    it('should render correctly', () => {
        expect(container.querySelector('.sidebar')).toBeTruthy();
    });
    
    it('should emit navigation events', () => {
        const handler = jest.fn();
        component.addEventListener('navigationChange', handler);
        
        component.setActiveNav('settings');
        expect(handler).toHaveBeenCalled();
    });
});
```

### Integration Testing
Test component interactions:

```javascript
describe('Chat Integration', () => {
    it('should update sidebar unread count when message received', async () => {
        const app = new CipherWaveApp(container);
        const sidebar = app.getComponent('sidebar');
        const chat = app.getComponent('chat');
        
        // Simulate message received
        chat.addMessage({ content: 'Test', type: 'received' });
        
        expect(sidebar.state.unreadCount).toBe(1);
    });
});
```

## Migration Guide

### From Monolithic to Modular

1. **Replace HTML file**: Use `index-modular.html` instead of `index.html`
2. **Update imports**: Include component scripts in correct order
3. **Initialize application**: Use `CipherWaveApp` instead of direct script execution
4. **Update custom code**: Use component APIs instead of direct DOM manipulation

### Compatibility
- **Existing managers**: SecurityManager, MessageManager, ConnectionManager work unchanged
- **External dependencies**: Crypto-js, Font Awesome remain the same
- **API compatibility**: Core functionality maintains same interface

## Performance Benefits

### Bundle Size Reduction
- **Lazy loading**: Components loaded on demand
- **Tree shaking**: Unused components excluded
- **Code splitting**: Separate component bundles

### Runtime Performance
- **Memory management**: Automatic cleanup prevents leaks
- **Event optimization**: Efficient event delegation
- **DOM optimization**: Minimal DOM manipulation
- **Render batching**: Optimized UI updates

### Mobile Performance
- **Touch optimization**: Better touch targets and interactions
- **Responsive images**: Adaptive resource loading
- **Keyboard handling**: Mobile keyboard optimizations
- **PWA features**: Service worker integration

## Deployment

### Development
```bash
# Serve with development server
python -m http.server 8000
# Access: http://localhost:8000/index-modular.html
```

### Production
```bash
# Build optimized version
npm run build

# Deploy static files
# All components are pre-loaded for production
```

### CDN Integration
Components can be served from CDN:

```html
<script src="https://cdn.cipherwave.com/components/BaseComponent.js"></script>
<script src="https://cdn.cipherwave.com/components/SidebarComponent.js"></script>
```

## Future Enhancements

### Planned Features
- **Hot module replacement**: Development-time component updates
- **Component marketplace**: Third-party component integration
- **Visual component editor**: Drag-drop component builder
- **Theme marketplace**: User-created themes
- **Plugin system**: Extensible functionality

### Architecture Evolution
- **Web Components**: Migration to native web components
- **TypeScript**: Type-safe component development
- **State management**: Redux/Zustand integration
- **Testing framework**: Built-in testing utilities

## Best Practices

### Component Development
1. **Single Responsibility**: Each component has one clear purpose
2. **Composition over Inheritance**: Favor component composition
3. **Immutable State**: Use immutable update patterns
4. **Error Boundaries**: Handle errors gracefully
5. **Accessibility**: WCAG 2.1 AA compliance

### Performance
1. **Lazy Loading**: Load components when needed
2. **Event Cleanup**: Always clean up event listeners
3. **Memory Management**: Prevent memory leaks
4. **Render Optimization**: Minimize DOM updates
5. **Bundle Optimization**: Tree shake unused code

### Maintainability
1. **Documentation**: Document all public APIs
2. **Testing**: Maintain high test coverage
3. **Code Review**: Review all component changes
4. **Versioning**: Semantic versioning for components
5. **Backwards Compatibility**: Maintain API stability