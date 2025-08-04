// CipherWave File Manager - Dynamically loaded for file sharing features
// Only loaded when file sharing is needed to reduce initial bundle size

export class FileManager {
    constructor() {
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
        this.allowedTypes = {
            images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
            videos: ['video/mp4', 'video/webm', 'video/ogg', 'video/mov', 'video/avi'],
            audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a'],
            documents: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed']
        };
        
        this.uploadQueue = [];
        this.activeUploads = new Map();
        this.compressionSettings = {
            image: { quality: 0.8, maxWidth: 1920, maxHeight: 1080 },
            video: { quality: 0.7, maxWidth: 1280, maxHeight: 720 }
        };
        
        this.chunkSize = 64 * 1024; // 64KB chunks for large files
        this.thumbnailSize = { width: 300, height: 200 };
        
        console.log('📁 File manager loaded');
    }
    
    async setup() {
        console.log('📁 Setting up file sharing system...');
        
        this.setupDragAndDrop();
        this.setupFileInput();
        this.setupClipboardPaste();
        this.createFileUploadUI();
    }
    
    setupDragAndDrop() {
        const dropZone = document.body;
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove('drag-over');
            }
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFileSelection(files);
        });
    }
    
    setupFileInput() {
        // Create hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.style.display = 'none';
        fileInput.id = 'fileInput';
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFileSelection(files);
        });
        
        document.body.appendChild(fileInput);
        
        // Add file share button if it doesn't exist
        this.createFileShareButton();
    }
    
    setupClipboardPaste() {
        document.addEventListener('paste', (e) => {
            const items = Array.from(e.clipboardData.items);
            const files = items
                .filter(item => item.kind === 'file')
                .map(item => item.getAsFile());
            
            if (files.length > 0) {
                e.preventDefault();
                this.handleFileSelection(files);
            }
        });
    }
    
    createFileShareButton() {
        const chatPanel = document.getElementById('chat-panel');
        if (!chatPanel || document.getElementById('fileShareBtn')) {
            return;
        }
        
        const messageInputGroup = chatPanel.querySelector('.message-input-group');
        if (!messageInputGroup) {
            return;
        }
        
        const fileBtn = document.createElement('button');
        fileBtn.id = 'fileShareBtn';
        fileBtn.className = 'btn btn-secondary';
        fileBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
        fileBtn.title = 'Share file';
        
        fileBtn.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        messageInputGroup.insertBefore(fileBtn, messageInputGroup.lastElementChild);
    }
    
    createFileUploadUI() {
        // Add drag-drop overlay styles
        if (!document.getElementById('fileManagerStyles')) {
            const styles = document.createElement('style');
            styles.id = 'fileManagerStyles';
            styles.textContent = `
                .drag-over::after {
                    content: "Drop files to send";
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 136, 204, 0.8);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    z-index: 10000;
                    pointer-events: none;
                }
                
                .file-upload-progress {
                    background: #1a1f29;
                    border: 1px solid #2a3441;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 10px 0;
                    max-width: 400px;
                }
                
                .file-upload-info {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .file-upload-icon {
                    font-size: 2rem;
                    margin-right: 15px;
                    color: #0088cc;
                }
                
                .file-upload-details h4 {
                    margin: 0 0 5px 0;
                    color: #ffffff;
                }
                
                .file-upload-details p {
                    margin: 0;
                    color: #8899a6;
                    font-size: 0.9rem;
                }
                
                .file-upload-progress-bar {
                    width: 100%;
                    height: 6px;
                    background: #2a3441;
                    border-radius: 3px;
                    overflow: hidden;
                }
                
                .file-upload-progress-fill {
                    height: 100%;
                    background: #0088cc;
                    transition: width 0.3s ease;
                }
                
                .file-preview {
                    max-width: 200px;
                    max-height: 200px;
                    border-radius: 8px;
                    margin: 10px 0;
                }
            `;
            document.head.appendChild(styles);
        }
    }
    
    async handleFileSelection(files) {
        console.log(`📁 Processing ${files.length} file(s)`);
        
        for (const file of files) {
            if (this.validateFile(file)) {
                await this.processFile(file);
            }
        }
    }
    
    validateFile(file) {
        // Check file size
        if (file.size > this.maxFileSize) {
            this.showError(`File "${file.name}" is too large (max ${this.maxFileSize / 1024 / 1024}MB)`);
            return false;
        }
        
        // Check file type
        const isAllowed = Object.values(this.allowedTypes)
            .flat()
            .some(type => file.type === type || file.type.startsWith(type.split('/')[0]));
        
        if (!isAllowed) {
            this.showError(`File type "${file.type}" is not allowed`);
            return false;
        }
        
        return true;
    }
    
    async processFile(file) {
        const fileId = this.generateFileId();
        const uploadInfo = {
            id: fileId,
            file: file,
            status: 'processing',
            progress: 0,
            chunks: [],
            thumbnail: null
        };
        
        this.activeUploads.set(fileId, uploadInfo);
        
        try {
            // Show upload progress UI
            this.showUploadProgress(uploadInfo);
            
            // Generate thumbnail for images/videos
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                uploadInfo.thumbnail = await this.generateThumbnail(file);
            }
            
            // Compress if needed
            const processedFile = await this.compressFile(file);
            
            // Split into chunks
            uploadInfo.chunks = await this.splitFileIntoChunks(processedFile);
            uploadInfo.status = 'ready';
            
            // Send file metadata first
            await this.sendFileMetadata(uploadInfo);
            
            // Send chunks
            await this.sendFileChunks(uploadInfo);
            
            uploadInfo.status = 'completed';
            this.updateUploadProgress(uploadInfo);
            
            console.log(`✅ File "${file.name}" sent successfully`);
            
        } catch (error) {
            console.error(`❌ Failed to process file "${file.name}":`, error);
            uploadInfo.status = 'error';
            uploadInfo.error = error.message;
            this.updateUploadProgress(uploadInfo);
        }
    }
    
    async generateThumbnail(file) {
        return new Promise((resolve) => {
            if (file.type.startsWith('image/')) {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate dimensions
                    const { width, height } = this.calculateThumbnailSize(img.width, img.height);
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw thumbnail
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = URL.createObjectURL(file);
            } else {
                resolve(null);
            }
        });
    }
    
    calculateThumbnailSize(originalWidth, originalHeight) {
        const { width: maxWidth, height: maxHeight } = this.thumbnailSize;
        
        const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
        
        return {
            width: Math.round(originalWidth * ratio),
            height: Math.round(originalHeight * ratio)
        };
    }
    
    async compressFile(file) {
        // For now, return the original file
        // Compression can be implemented later for specific file types
        return file;
    }
    
    async splitFileIntoChunks(file) {
        const chunks = [];
        const totalChunks = Math.ceil(file.size / this.chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            chunks.push({
                index: i,
                data: await this.fileToBase64(chunk),
                size: chunk.size
            });
        }
        
        return chunks;
    }
    
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    async sendFileMetadata(uploadInfo) {
        const metadata = {
            type: 'file_metadata',
            fileId: uploadInfo.id,
            name: uploadInfo.file.name,
            size: uploadInfo.file.size,
            type: uploadInfo.file.type,
            chunks: uploadInfo.chunks.length,
            thumbnail: uploadInfo.thumbnail,
            timestamp: Date.now()
        };
        
        // Emit to connection manager
        if (window.cipherWave && window.cipherWave.connectionManager) {
            await window.cipherWave.connectionManager.sendData(metadata);
        }
    }
    
    async sendFileChunks(uploadInfo) {
        for (let i = 0; i < uploadInfo.chunks.length; i++) {
            const chunk = uploadInfo.chunks[i];
            
            const chunkMessage = {
                type: 'file_chunk',
                fileId: uploadInfo.id,
                chunkIndex: chunk.index,
                data: chunk.data,
                isLast: i === uploadInfo.chunks.length - 1
            };
            
            // Send chunk
            if (window.cipherWave && window.cipherWave.connectionManager) {
                await window.cipherWave.connectionManager.sendData(chunkMessage);
            }
            
            // Update progress
            uploadInfo.progress = ((i + 1) / uploadInfo.chunks.length) * 100;
            this.updateUploadProgress(uploadInfo);
            
            // Small delay to prevent overwhelming the connection
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    showUploadProgress(uploadInfo) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;
        
        const progressElement = document.createElement('div');
        progressElement.className = 'file-upload-progress';
        progressElement.id = `upload-${uploadInfo.id}`;
        
        progressElement.innerHTML = `
            <div class="file-upload-info">
                <div class="file-upload-icon">
                    <i class="fas fa-file"></i>
                </div>
                <div class="file-upload-details">
                    <h4>${uploadInfo.file.name}</h4>
                    <p>${this.formatFileSize(uploadInfo.file.size)} • ${uploadInfo.file.type}</p>
                </div>
            </div>
            <div class="file-upload-progress-bar">
                <div class="file-upload-progress-fill" style="width: 0%"></div>
            </div>
        `;
        
        messagesContainer.appendChild(progressElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    updateUploadProgress(uploadInfo) {
        const progressElement = document.getElementById(`upload-${uploadInfo.id}`);
        if (!progressElement) return;
        
        const progressFill = progressElement.querySelector('.file-upload-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${uploadInfo.progress}%`;
        }
        
        if (uploadInfo.status === 'completed') {
            setTimeout(() => {
                if (progressElement.parentElement) {
                    progressElement.remove();
                }
            }, 2000);
        } else if (uploadInfo.status === 'error') {
            progressElement.style.borderColor = '#ff6b6b';
            const details = progressElement.querySelector('.file-upload-details p');
            if (details) {
                details.textContent = `Error: ${uploadInfo.error}`;
                details.style.color = '#ff6b6b';
            }
        }
    }
    
    generateFileId() {
        return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    showError(message) {
        if (window.cipherWave && window.cipherWave.uiManager) {
            window.cipherWave.uiManager.showError(message);
        } else {
            console.error(message);
        }
    }
    
    destroy() {
        this.activeUploads.clear();
        this.uploadQueue = [];
        
        // Remove file input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.remove();
        }
        
        // Remove file share button
        const fileBtn = document.getElementById('fileShareBtn');
        if (fileBtn) {
            fileBtn.remove();
        }
        
        // Remove styles
        const styles = document.getElementById('fileManagerStyles');
        if (styles) {
            styles.remove();
        }
        
        console.log('🗑️ File manager destroyed');
    }
}