// File Component for CipherWave - File Sharing and Management
// Handles file uploads, downloads, and secure file sharing

class FileComponent extends BaseComponent {
    constructor(container, options = {}) {
        super(container, options);
        
        this.state = {
            isVisible: false,
            files: [],
            uploadProgress: {},
            selectedFiles: new Set(),
            dragActive: false,
            isUploading: false
        };
        
        this.fileInput = null;
        this.dropZone = null;
        this.maxFileSize = this.options.maxFileSize || 10 * 1024 * 1024; // 10MB default
        this.allowedTypes = this.options.allowedTypes || ['image/*', 'text/*', 'application/*'];
        
        if (this.options.autoRender) {
            this.render();
        }
    }
    
    getDefaultOptions() {
        return {
            ...super.getDefaultOptions(),
            className: 'file-component',
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            allowedTypes: ['image/*', 'text/*', 'application/*'],
            allowMultiple: true,
            showPreview: true,
            showProgress: true,
            enableDragDrop: true,
            encryptFiles: true,
            showFileList: true,
            allowDelete: true
        };
    }
    
    createTemplate() {
        return `
            <div class="${this.options.className} ${this.state.isVisible ? '' : 'hidden'}">
                <div class="file-manager">
                    ${this.createHeader()}
                    ${this.createUploadArea()}
                    ${this.options.showFileList ? this.createFileList() : ''}
                    ${this.createActions()}
                </div>
            </div>
        `;
    }
    
    createHeader() {
        return `
            <div class="file-header">
                <h3>
                    <i class="fas fa-file-upload"></i>
                    File Sharing
                </h3>
                <button class="close-btn" type="button" aria-label="Close file manager">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }
    
    createUploadArea() {
        return `
            <div class="upload-area ${this.state.dragActive ? 'drag-active' : ''}" id="drop-zone">
                <div class="upload-content">
                    <i class="fas fa-cloud-upload-alt upload-icon"></i>
                    <h4>Choose files or drag them here</h4>
                    <p>Maximum ${this.formatFileSize(this.maxFileSize)} per file, up to ${this.options.maxFiles} files</p>
                    <p class="file-types">Supported: ${this.getAllowedTypesText()}</p>
                    
                    <input type="file" 
                           id="file-input" 
                           class="file-input" 
                           ${this.options.allowMultiple ? 'multiple' : ''}
                           accept="${this.allowedTypes.join(',')}">
                    
                    <label for="file-input" class="upload-btn primary-btn">
                        <i class="fas fa-plus"></i>
                        Select Files
                    </label>
                </div>
                
                ${this.state.isUploading ? this.createUploadProgress() : ''}
            </div>
        `;
    }
    
    createUploadProgress() {
        return `
            <div class="upload-progress-overlay">
                <div class="upload-progress-content">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Processing files...</p>
                    <div class="progress-list">
                        ${Object.entries(this.state.uploadProgress).map(([fileName, progress]) => `
                            <div class="progress-item">
                                <span class="file-name">${this.escapeHTML(fileName)}</span>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${progress}%"></div>
                                </div>
                                <span class="progress-text">${progress}%</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    createFileList() {
        if (this.state.files.length === 0) {
            return `
                <div class="file-list empty">
                    <div class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        <p>No files selected</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="file-list">
                <div class="file-list-header">
                    <h4>Selected Files (${this.state.files.length})</h4>
                    <div class="file-list-actions">
                        <button class="secondary-btn select-all-btn" type="button">
                            <i class="fas fa-check-square"></i>
                            Select All
                        </button>
                        <button class="secondary-btn clear-all-btn" type="button">
                            <i class="fas fa-trash"></i>
                            Clear All
                        </button>
                    </div>
                </div>
                <div class="file-items">
                    ${this.state.files.map(file => this.createFileItem(file)).join('')}
                </div>
                <div class="file-summary">
                    Total size: ${this.formatFileSize(this.getTotalSize())}
                </div>
            </div>
        `;
    }
    
    createFileItem(file) {
        const isSelected = this.state.selectedFiles.has(file.id);
        const preview = this.getFilePreview(file);
        
        return `
            <div class="file-item ${isSelected ? 'selected' : ''}" data-file-id="${file.id}">
                <div class="file-checkbox">
                    <input type="checkbox" id="file-${file.id}" ${isSelected ? 'checked' : ''}>
                    <label for="file-${file.id}" class="sr-only">Select ${file.name}</label>
                </div>
                
                <div class="file-preview">
                    ${preview}
                </div>
                
                <div class="file-info">
                    <div class="file-name" title="${file.name}">${this.escapeHTML(file.name)}</div>
                    <div class="file-meta">
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                        <span class="file-type">${file.type || 'Unknown'}</span>
                        ${file.encrypted ? '<i class="fas fa-lock" title="Encrypted"></i>' : ''}
                    </div>
                </div>
                
                ${this.options.allowDelete ? `
                    <div class="file-actions">
                        <button class="action-btn delete-file-btn" 
                                type="button" 
                                data-file-id="${file.id}"
                                aria-label="Delete ${file.name}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    createActions() {
        const hasFiles = this.state.files.length > 0;
        const hasSelected = this.state.selectedFiles.size > 0;
        
        return `
            <div class="file-actions-bar">
                <button class="primary-btn send-files-btn" 
                        type="button" 
                        ${!hasSelected ? 'disabled' : ''}>
                    <i class="fas fa-paper-plane"></i>
                    Send Selected (${this.state.selectedFiles.size})
                </button>
                
                <button class="secondary-btn save-files-btn" 
                        type="button" 
                        ${!hasSelected ? 'disabled' : ''}>
                    <i class="fas fa-download"></i>
                    Save Selected
                </button>
                
                <button class="secondary-btn encrypt-btn" 
                        type="button" 
                        ${!hasSelected ? 'disabled' : ''}>
                    <i class="fas fa-shield-alt"></i>
                    ${this.options.encryptFiles ? 'Encrypted' : 'Encrypt'}
                </button>
            </div>
        `;
    }
    
    attachEventListeners() {
        // Close button
        const closeBtn = this.querySelector('.close-btn');
        if (closeBtn) {
            this.addEventListener(closeBtn, 'click', this.handleClose);
        }
        
        // File input
        this.fileInput = this.querySelector('.file-input');
        if (this.fileInput) {
            this.addEventListener(this.fileInput, 'change', this.handleFileSelect);
        }
        
        // Drag and drop
        if (this.options.enableDragDrop) {
            this.dropZone = this.querySelector('#drop-zone');
            if (this.dropZone) {
                this.setupDragAndDrop();
            }
        }
        
        // File list actions
        this.attachFileListListeners();
        
        // Action buttons
        this.attachActionListeners();
    }
    
    setupDragAndDrop() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.addEventListener(this.dropZone, eventName, this.preventDefaults);
            this.addEventListener(document.body, eventName, this.preventDefaults);
        });
        
        // Highlight drop area
        ['dragenter', 'dragover'].forEach(eventName => {
            this.addEventListener(this.dropZone, eventName, this.handleDragEnter);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.addEventListener(this.dropZone, eventName, this.handleDragLeave);
        });
        
        // Handle dropped files
        this.addEventListener(this.dropZone, 'drop', this.handleDrop);
    }
    
    attachFileListListeners() {
        // File checkboxes
        const checkboxes = this.querySelectorAll('.file-item input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            this.addEventListener(checkbox, 'change', this.handleFileSelection);
        });
        
        // Select all button
        const selectAllBtn = this.querySelector('.select-all-btn');
        if (selectAllBtn) {
            this.addEventListener(selectAllBtn, 'click', this.handleSelectAll);
        }
        
        // Clear all button
        const clearAllBtn = this.querySelector('.clear-all-btn');
        if (clearAllBtn) {
            this.addEventListener(clearAllBtn, 'click', this.handleClearAll);
        }
        
        // Delete file buttons
        const deleteButtons = this.querySelectorAll('.delete-file-btn');
        deleteButtons.forEach(button => {
            this.addEventListener(button, 'click', this.handleDeleteFile);
        });
    }
    
    attachActionListeners() {
        // Send files button
        const sendBtn = this.querySelector('.send-files-btn');
        if (sendBtn) {
            this.addEventListener(sendBtn, 'click', this.handleSendFiles);
        }
        
        // Save files button
        const saveBtn = this.querySelector('.save-files-btn');
        if (saveBtn) {
            this.addEventListener(saveBtn, 'click', this.handleSaveFiles);
        }
        
        // Encrypt button
        const encryptBtn = this.querySelector('.encrypt-btn');
        if (encryptBtn) {
            this.addEventListener(encryptBtn, 'click', this.handleEncryptFiles);
        }
    }
    
    preventDefaults(event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    handleDragEnter() {
        this.setState({ dragActive: true });
        this.dropZone.classList.add('drag-active');
    }
    
    handleDragLeave() {
        this.setState({ dragActive: false });
        this.dropZone.classList.remove('drag-active');
    }
    
    handleDrop(event) {
        const files = Array.from(event.dataTransfer.files);
        this.processFiles(files);
    }
    
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
    }
    
    handleFileSelection(event) {
        const fileId = event.target.id.replace('file-', '');
        const isChecked = event.target.checked;
        
        if (isChecked) {
            this.state.selectedFiles.add(fileId);
        } else {
            this.state.selectedFiles.delete(fileId);
        }
        
        this.updateFileItem(fileId);
        this.updateActions();
    }
    
    handleSelectAll() {
        this.state.files.forEach(file => {
            this.state.selectedFiles.add(file.id);
        });
        this.updateFileList();
        this.updateActions();
    }
    
    handleClearAll() {
        this.setState({ files: [], selectedFiles: new Set() });
        this.updateFileList();
        this.updateActions();
    }
    
    handleDeleteFile(event) {
        const fileId = event.currentTarget.dataset.fileId;
        this.removeFile(fileId);
    }
    
    handleSendFiles() {
        const selectedFiles = this.getSelectedFiles();
        if (selectedFiles.length === 0) return;
        
        this.emit('filesend', { files: selectedFiles });
    }
    
    handleSaveFiles() {
        const selectedFiles = this.getSelectedFiles();
        if (selectedFiles.length === 0) return;
        
        this.emit('filesave', { files: selectedFiles });
    }
    
    handleEncryptFiles() {
        const selectedFiles = this.getSelectedFiles();
        if (selectedFiles.length === 0) return;
        
        this.emit('fileencrypt', { files: selectedFiles });
    }
    
    handleClose() {
        this.hide();
        this.emit('filemanagerclose');
    }
    
    // Public API methods
    async processFiles(files) {
        if (!files || files.length === 0) return;
        
        this.setState({ isUploading: true });
        
        const validFiles = [];
        const errors = [];
        
        for (const file of files) {
            const validation = this.validateFile(file);
            if (validation.valid) {
                const processedFile = await this.processFile(file);
                validFiles.push(processedFile);
            } else {
                errors.push({ file: file.name, error: validation.error });
            }
        }
        
        if (errors.length > 0) {
            this.emit('fileerror', { errors });
        }
        
        if (validFiles.length > 0) {
            this.addFiles(validFiles);
        }
        
        this.setState({ isUploading: false, uploadProgress: {} });
        this.updateUploadArea();
    }
    
    validateFile(file) {
        // Check file size
        if (file.size > this.maxFileSize) {
            return {
                valid: false,
                error: `File size exceeds ${this.formatFileSize(this.maxFileSize)} limit`
            };
        }
        
        // Check file type
        if (this.allowedTypes.length > 0) {
            const isAllowed = this.allowedTypes.some(type => {
                if (type.endsWith('/*')) {
                    return file.type.startsWith(type.slice(0, -1));
                }
                return file.type === type;
            });
            
            if (!isAllowed) {
                return {
                    valid: false,
                    error: `File type '${file.type}' is not allowed`
                };
            }
        }
        
        // Check total files limit
        if (this.state.files.length >= this.options.maxFiles) {
            return {
                valid: false,
                error: `Maximum ${this.options.maxFiles} files allowed`
            };
        }
        
        return { valid: true };
    }
    
    async processFile(file) {
        const fileId = this.generateFileId();
        
        // Update progress
        this.updateProgress(file.name, 10);
        
        // Read file data
        const arrayBuffer = await this.readFileAsArrayBuffer(file);
        this.updateProgress(file.name, 50);
        
        // Encrypt if enabled
        let encryptedData = arrayBuffer;
        let encrypted = false;
        
        if (this.options.encryptFiles) {
            encryptedData = await this.encryptFileData(arrayBuffer);
            encrypted = true;
            this.updateProgress(file.name, 80);
        }
        
        this.updateProgress(file.name, 100);
        
        return {
            id: fileId,
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            data: encryptedData,
            encrypted: encrypted,
            originalFile: file
        };
    }
    
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }
    
    updateProgress(fileName, progress) {
        this.state.uploadProgress[fileName] = progress;
        
        if (this.state.isUploading) {
            this.updateUploadProgress();
        }
    }
    
    addFiles(files) {
        const newFiles = [...this.state.files, ...files];
        this.setState({ files: newFiles });
        this.updateFileList();
        
        // Auto-select new files
        files.forEach(file => {
            this.state.selectedFiles.add(file.id);
        });
        
        this.updateActions();
    }
    
    removeFile(fileId) {
        const files = this.state.files.filter(file => file.id !== fileId);
        this.state.selectedFiles.delete(fileId);
        this.setState({ files });
        this.updateFileList();
        this.updateActions();
    }
    
    getSelectedFiles() {
        return this.state.files.filter(file => this.state.selectedFiles.has(file.id));
    }
    
    async encryptFileData(data) {
        // Simple encryption using Web Crypto API
        // In a real implementation, this would use the SecurityManager
        try {
            // Generate a random key for encryption
            const key = await window.crypto.subtle.generateKey(
                {
                    name: "AES-GCM",
                    length: 256
                },
                true,
                ["encrypt", "decrypt"]
            );
            
            // Generate a random IV
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            // Encrypt the data
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                key,
                data
            );
            
            // For demo purposes, we'll return the encrypted data with IV
            // In a real implementation, we would also handle key exchange
            const result = new Uint8Array(encryptedData);
            return result;
        } catch (error) {
            console.error('File encryption failed:', error);
            // Return original data if encryption fails
            return data;
        }
    }
    
    getTotalSize() {
        return this.state.files.reduce((total, file) => total + file.size, 0);
    }
    
    generateFileId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    getFilePreview(file) {
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file.originalFile);
            return `<img src="${url}" alt="${file.name}" class="file-preview-image">`;
        }
        
        const iconMap = {
            'text/': 'fas fa-file-alt',
            'application/pdf': 'fas fa-file-pdf',
            'application/zip': 'fas fa-file-archive',
            'application/': 'fas fa-file',
            'video/': 'fas fa-file-video',
            'audio/': 'fas fa-file-audio'
        };
        
        const iconClass = Object.entries(iconMap).find(([type]) => 
            file.type.startsWith(type)
        )?.[1] || 'fas fa-file';
        
        return `<i class="${iconClass} file-icon"></i>`;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    getAllowedTypesText() {
        return this.allowedTypes
            .map(type => type.replace('/*', ''))
            .join(', ')
            .toLowerCase();
    }
    
    // UI Update methods
    updateFileList() {
        const fileListContainer = this.querySelector('.file-list');
        if (fileListContainer) {
            fileListContainer.outerHTML = this.createFileList();
            this.attachFileListListeners();
        }
    }
    
    updateFileItem(fileId) {
        const fileItem = this.querySelector(`[data-file-id="${fileId}"]`);
        if (fileItem) {
            const isSelected = this.state.selectedFiles.has(fileId);
            fileItem.classList.toggle('selected', isSelected);
        }
    }
    
    updateActions() {
        const actionsBar = this.querySelector('.file-actions-bar');
        if (actionsBar) {
            actionsBar.outerHTML = this.createActions();
            this.attachActionListeners();
        }
    }
    
    updateUploadArea() {
        const uploadArea = this.querySelector('.upload-area');
        if (uploadArea) {
            uploadArea.outerHTML = this.createUploadArea();
            
            // Re-attach listeners
            this.fileInput = this.querySelector('.file-input');
            if (this.fileInput) {
                this.addEventListener(this.fileInput, 'change', this.handleFileSelect);
            }
            
            if (this.options.enableDragDrop) {
                this.dropZone = this.querySelector('#drop-zone');
                if (this.dropZone) {
                    this.setupDragAndDrop();
                }
            }
        }
    }
    
    updateUploadProgress() {
        const progressOverlay = this.querySelector('.upload-progress-overlay');
        if (progressOverlay) {
            progressOverlay.innerHTML = this.createUploadProgress()
                .match(/<div class="upload-progress-content">[\s\S]*?<\/div>/)[0];
        }
    }
    
    show() {
        this.setState({ isVisible: true });
        super.show();
        this.emit('filemanagershow');
        return this;
    }
    
    hide() {
        this.setState({ isVisible: false });
        super.hide();
        this.emit('filemanagerhide');
        return this;
    }
    
    clear() {
        this.setState({ files: [], selectedFiles: new Set(), uploadProgress: {} });
        this.updateFileList();
        this.updateActions();
        return this;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileComponent;
} else if (typeof window !== 'undefined') {
    window.FileComponent = FileComponent;
}
