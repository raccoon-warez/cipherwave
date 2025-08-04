// Input Component for CipherWave - Enhanced Input Handling
// Provides consistent input behavior, validation, and accessibility

class InputComponent extends BaseComponent {
    constructor(container, options = {}) {
        super(container, options);
        
        this.state = {
            value: this.options.value || '',
            isValid: true,
            isFocused: false,
            errorMessage: '',
            isDisabled: this.options.disabled || false
        };
        
        this.validators = [];
        this.inputElement = null;
        this.debounceTimeout = null;
        
        if (this.options.autoRender) {
            this.render();
        }
    }
    
    getDefaultOptions() {
        return {
            ...super.getDefaultOptions(),
            type: 'text',
            placeholder: '',
            value: '',
            label: '',
            required: false,
            disabled: false,
            readonly: false,
            maxLength: null,
            minLength: null,
            pattern: null,
            autocomplete: 'off',
            showValidation: true,
            validateOnInput: false,
            validateOnBlur: true,
            debounceMs: 300,
            showCharacterCount: false,
            supportsPaste: true,
            autoResize: false,
            multiline: false,
            rows: 3,
            resize: 'vertical'
        };
    }
    
    createTemplate() {
        const inputId = this.options.id || `input-${Date.now()}`;
        const isTextarea = this.options.multiline;
        
        return `
            <div class="input-component ${this.state.isValid ? '' : 'error'} ${this.state.isFocused ? 'focused' : ''} ${this.state.isDisabled ? 'disabled' : ''}">
                ${this.options.label ? this.createLabel(inputId) : ''}
                <div class="input-wrapper">
                    ${isTextarea ? this.createTextarea(inputId) : this.createInput(inputId)}
                    ${this.createInputActions()}
                </div>
                ${this.createValidationMessage()}
                ${this.options.showCharacterCount ? this.createCharacterCount() : ''}
            </div>
        `;
    }
    
    createLabel(inputId) {
        return `
            <label for="${inputId}" class="input-label">
                ${this.escapeHTML(this.options.label)}
                ${this.options.required ? '<span class="required-indicator">*</span>' : ''}
            </label>
        `;
    }
    
    createInput(inputId) {
        const attributes = {
            type: this.options.type,
            id: inputId,
            class: 'input-field',
            placeholder: this.options.placeholder,
            value: this.state.value,
            autocomplete: this.options.autocomplete
        };
        
        if (this.options.required) attributes.required = '';
        if (this.state.isDisabled) attributes.disabled = '';
        if (this.options.readonly) attributes.readonly = '';
        if (this.options.maxLength) attributes.maxlength = this.options.maxLength;
        if (this.options.minLength) attributes.minlength = this.options.minLength;
        if (this.options.pattern) attributes.pattern = this.options.pattern;
        
        const attributeString = Object.entries(attributes)
            .map(([key, value]) => value === '' ? key : `${key}="${this.escapeHTML(String(value))}"`)
            .join(' ');
        
        return `<input ${attributeString}>`;
    }
    
    createTextarea(inputId) {
        const attributes = {
            id: inputId,
            class: 'input-field textarea-field',
            placeholder: this.options.placeholder,
            rows: this.options.rows,
            autocomplete: this.options.autocomplete
        };
        
        if (this.options.required) attributes.required = '';
        if (this.state.isDisabled) attributes.disabled = '';
        if (this.options.readonly) attributes.readonly = '';
        if (this.options.maxLength) attributes.maxlength = this.options.maxLength;
        if (this.options.minLength) attributes.minlength = this.options.minLength;
        if (this.options.resize) attributes.style = `resize: ${this.options.resize}`;
        
        const attributeString = Object.entries(attributes)
            .map(([key, value]) => `${key}="${this.escapeHTML(String(value))}"`)
            .join(' ');
        
        return `<textarea ${attributeString}>${this.escapeHTML(this.state.value)}</textarea>`;
    }
    
    createInputActions() {
        const actions = [];
        
        // Clear button
        if (this.state.value && !this.options.readonly && !this.state.isDisabled) {
            actions.push(`
                <button type="button" class="input-action clear-btn" aria-label="Clear input">
                    <i class="fas fa-times"></i>
                </button>
            `);
        }
        
        // Custom actions
        if (this.options.actions) {
            this.options.actions.forEach(action => {
                actions.push(`
                    <button type="button" class="input-action custom-action" data-action="${action.id}" aria-label="${action.label}">
                        <i class="${action.icon}"></i>
                    </button>
                `);
            });
        }
        
        return actions.length > 0 ? `<div class="input-actions">${actions.join('')}</div>` : '';
    }
    
    createValidationMessage() {
        if (!this.options.showValidation) return '';
        
        return `
            <div class="validation-message ${this.state.isValid ? 'hidden' : ''}">
                <i class="fas fa-exclamation-triangle"></i>
                <span class="validation-text">${this.escapeHTML(this.state.errorMessage)}</span>
            </div>
        `;
    }
    
    createCharacterCount() {
        const current = this.state.value.length;
        const max = this.options.maxLength;
        const isOverLimit = max && current > max;
        
        return `
            <div class="character-count ${isOverLimit ? 'over-limit' : ''}">
                <span class="current">${current}</span>
                ${max ? `<span class="separator">/</span><span class="max">${max}</span>` : ''}
            </div>
        `;
    }
    
    attachEventListeners() {
        this.inputElement = this.querySelector('.input-field');
        if (!this.inputElement) return;
        
        // Input events
        this.addEventListener(this.inputElement, 'input', this.handleInput);
        this.addEventListener(this.inputElement, 'focus', this.handleFocus);
        this.addEventListener(this.inputElement, 'blur', this.handleBlur);
        this.addEventListener(this.inputElement, 'keydown', this.handleKeyDown);
        this.addEventListener(this.inputElement, 'keyup', this.handleKeyUp);
        
        // Paste support
        if (this.options.supportsPaste) {
            this.addEventListener(this.inputElement, 'paste', this.handlePaste);
        }
        
        // Clear button
        const clearBtn = this.querySelector('.clear-btn');
        if (clearBtn) {
            this.addEventListener(clearBtn, 'click', this.handleClear);
        }
        
        // Custom actions
        const customActions = this.querySelectorAll('.custom-action');
        customActions.forEach(button => {
            this.addEventListener(button, 'click', this.handleCustomAction);
        });
        
        // Auto-resize for textarea
        if (this.options.autoResize && this.options.multiline) {
            this.setupAutoResize();
        }
    }
    
    setupAutoResize() {
        if (!this.inputElement || this.inputElement.tagName !== 'TEXTAREA') return;
        
        const resize = () => {
            this.inputElement.style.height = 'auto';
            this.inputElement.style.height = this.inputElement.scrollHeight + 'px';
        };
        
        this.addEventListener(this.inputElement, 'input', resize);
        
        // Initial resize
        setTimeout(resize, 0);
    }
    
    handleInput(event) {
        const value = event.target.value;
        this.setState({ value });
        
        // Debounced validation
        if (this.options.validateOnInput) {
            this.debouncedValidate();
        }
        
        // Update character count
        if (this.options.showCharacterCount) {
            this.updateCharacterCount();
        }
        
        // Update actions
        this.updateInputActions();
        
        this.emit('input', { value, isValid: this.state.isValid });
    }
    
    handleFocus(event) {
        this.setState({ isFocused: true });
        this.updateClasses();
        this.emit('focus', { value: this.state.value });
    }
    
    handleBlur(event) {
        this.setState({ isFocused: false });
        this.updateClasses();
        
        if (this.options.validateOnBlur) {
            this.validate();
        }
        
        this.emit('blur', { value: this.state.value, isValid: this.state.isValid });
    }
    
    handleKeyDown(event) {
        this.emit('keydown', { event, value: this.state.value });
        
        // Handle special keys
        if (event.key === 'Enter' && !this.options.multiline) {
            event.preventDefault();
            this.emit('submit', { value: this.state.value });
        }
        
        if (event.key === 'Escape') {
            this.inputElement.blur();
            this.emit('escape', { value: this.state.value });
        }
    }
    
    handleKeyUp(event) {
        this.emit('keyup', { event, value: this.state.value });
    }
    
    handlePaste(event) {
        setTimeout(() => {
            const value = this.inputElement.value;
            this.setState({ value });
            this.updateCharacterCount();
            this.updateInputActions();
            this.emit('paste', { value });
        }, 0);
    }
    
    handleClear(event) {
        event.preventDefault();
        this.setValue('');
        this.inputElement.focus();
        this.emit('clear');
    }
    
    handleCustomAction(event) {
        event.preventDefault();
        const actionId = event.currentTarget.dataset.action;
        this.emit('customAction', { actionId, value: this.state.value });
    }
    
    debouncedValidate() {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this.validate();
        }, this.options.debounceMs);
    }
    
    // Public API methods
    addValidator(validatorFn, errorMessage) {
        this.validators.push({ fn: validatorFn, message: errorMessage });
        return this;
    }
    
    removeValidator(validatorFn) {
        this.validators = this.validators.filter(validator => validator.fn !== validatorFn);
        return this;
    }
    
    validate() {
        const value = this.state.value;
        let isValid = true;
        let errorMessage = '';
        
        // Built-in validation
        if (this.options.required && !value.trim()) {
            isValid = false;
            errorMessage = 'This field is required';
        } else if (this.options.minLength && value.length < this.options.minLength) {
            isValid = false;
            errorMessage = `Minimum length is ${this.options.minLength} characters`;
        } else if (this.options.maxLength && value.length > this.options.maxLength) {
            isValid = false;
            errorMessage = `Maximum length is ${this.options.maxLength} characters`;
        } else if (this.options.pattern && !new RegExp(this.options.pattern).test(value)) {
            isValid = false;
            errorMessage = 'Invalid format';
        }
        
        // Custom validators
        if (isValid && this.validators.length > 0) {
            for (const validator of this.validators) {
                if (!validator.fn(value)) {
                    isValid = false;
                    errorMessage = validator.message;
                    break;
                }
            }
        }
        
        this.setState({ isValid, errorMessage });
        this.updateValidationDisplay();
        this.updateClasses();
        
        return isValid;
    }
    
    setValue(value) {
        this.setState({ value: String(value) });
        
        if (this.inputElement) {
            this.inputElement.value = this.state.value;
        }
        
        this.updateCharacterCount();
        this.updateInputActions();
        this.emit('change', { value: this.state.value });
        
        return this;
    }
    
    getValue() {
        return this.state.value;
    }
    
    focus() {
        if (this.inputElement) {
            this.inputElement.focus();
        }
        return this;
    }
    
    blur() {
        if (this.inputElement) {
            this.inputElement.blur();
        }
        return this;
    }
    
    select() {
        if (this.inputElement) {
            this.inputElement.select();
        }
        return this;
    }
    
    clear() {
        this.setValue('');
        return this;
    }
    
    disable() {
        this.setState({ isDisabled: true });
        if (this.inputElement) {
            this.inputElement.disabled = true;
        }
        this.updateClasses();
        return this;
    }
    
    enable() {
        this.setState({ isDisabled: false });
        if (this.inputElement) {
            this.inputElement.disabled = false;
        }
        this.updateClasses();
        return this;
    }
    
    isValid() {
        return this.state.isValid;
    }
    
    getErrorMessage() {
        return this.state.errorMessage;
    }
    
    updateClasses() {
        if (this.element) {
            this.element.className = `input-component ${this.state.isValid ? '' : 'error'} ${this.state.isFocused ? 'focused' : ''} ${this.state.isDisabled ? 'disabled' : ''}`;
        }
    }
    
    updateValidationDisplay() {
        if (!this.options.showValidation) return;
        
        const validationMessage = this.querySelector('.validation-message');
        if (validationMessage) {
            const validationText = validationMessage.querySelector('.validation-text');
            
            if (this.state.isValid) {
                validationMessage.classList.add('hidden');
            } else {
                validationMessage.classList.remove('hidden');
                if (validationText) {
                    validationText.textContent = this.state.errorMessage;
                }
            }
        }
    }
    
    updateCharacterCount() {
        if (!this.options.showCharacterCount) return;
        
        const characterCount = this.querySelector('.character-count');
        if (characterCount) {
            const current = characterCount.querySelector('.current');
            const isOverLimit = this.options.maxLength && this.state.value.length > this.options.maxLength;
            
            if (current) {
                current.textContent = this.state.value.length;
            }
            
            characterCount.classList.toggle('over-limit', isOverLimit);
        }
    }
    
    updateInputActions() {
        const actionsContainer = this.querySelector('.input-actions');
        if (actionsContainer) {
            actionsContainer.outerHTML = this.createInputActions();
            
            // Re-attach event listeners
            const clearBtn = this.querySelector('.clear-btn');
            if (clearBtn) {
                this.addEventListener(clearBtn, 'click', this.handleClear);
            }
            
            const customActions = this.querySelectorAll('.custom-action');
            customActions.forEach(button => {
                this.addEventListener(button, 'click', this.handleCustomAction);
            });
        }
    }
    
    beforeDestroy() {
        clearTimeout(this.debounceTimeout);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputComponent;
} else if (typeof window !== 'undefined') {
    window.InputComponent = InputComponent;
}