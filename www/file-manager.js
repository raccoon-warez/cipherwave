// Enhanced File Sharing & Media Manager with Security Integration
class FileManager {
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
        
        this.dragActive = false;
        this.cameraStream = null;
        this.isCapturing = false;
        this.incomingChunks = null;
        this.currentCameraMode = 'user'; // 'user' or 'environment'
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        
        // Security integration
        this.encryptionEnabled = true;
        this.chunkSize = 64 * 1024; // 64KB chunks for large files
        this.thumbnailSize = { width: 300, height: 200 };
        
        // Performance monitoring
        this.performanceMetrics = {
            uploadStartTime: null,
            compressionTime: 0,
            encryptionTime: 0
        };
    }

    async setup() {
        console.log('📁 Setting up enhanced file sharing system...');
        
        this.setupDragAndDrop();
        this.setupFileInput();
        this.setupCameraCapture();
        this.setupVideoRecording();
        this.setupClipboardPaste();
        this.createFileUploadUI();
        this.setupProgressIndicators();
        this.setupKeyboardShortcuts();
        this.setupAccessibilityFeatures();
        
        console.log('✅ Enhanced file sharing system ready');
    }

    setupDragAndDrop() {
        const messagesContainer = document.querySelector('.messages-container');
        const inputArea = document.querySelector('.input-area');
        
        if (!messagesContainer || !inputArea) return;

        // Create enhanced drop zone overlay
        this.createDropZone();

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Handle drag enter/over with visual feedback
        ['dragenter', 'dragover'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                this.showDropZone();
                // Add drag counter for better UX
                if (!this.dragCounter) this.dragCounter = 0;
                if (eventName === 'dragenter') this.dragCounter++;
            }, false);
        });

        // Handle drag leave with counter
        document.addEventListener('dragleave', (e) => {
            this.dragCounter--;
            if (this.dragCounter <= 0) {
                this.hideDropZone();
                this.dragCounter = 0;
            }
        }, false);

        // Handle drop with file validation
        document.addEventListener('drop', (e) => {
            this.dragCounter = 0;
            this.hideDropZone();
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleFilesDrop(files);
                this.triggerHaptic('medium');
            }
        }, false);
    }

    createDropZone() {
        const dropZone = document.createElement('div');
        dropZone.className = 'file-drop-zone';
        dropZone.setAttribute('role', 'dialog');
        dropZone.setAttribute('aria-label', 'File drop zone');
        dropZone.innerHTML = `
            <div class="drop-zone-content">
                <div class="drop-zone-icon">
                    <i class="fas fa-cloud-upload-alt" aria-hidden="true"></i>
                </div>
                <div class="drop-zone-text">Drop files here to share</div>
                <div class="drop-zone-types">Images, videos, documents, and more</div>
                <div class="drop-zone-limit">Max ${Math.round(this.maxFileSize / (1024 * 1024))}MB per file</div>
            </div>
        `;

        document.body.appendChild(dropZone);

        // Enhanced styles with better mobile support
        const styles = document.createElement('style');
        styles.textContent = `
            .file-drop-zone {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                height: 100dvh;
                background: rgba(86, 130, 163, 0.95);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 3000;
                display: none;
                align-items: center;
                justify-content: center;
                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                overscroll-behavior: contain;
            }

            .file-drop-zone.visible {
                display: flex;
                animation: dropZoneIn 0.3s ease-out;
            }

            @keyframes dropZoneIn {
                from {
                    opacity: 0;
                    backdrop-filter: blur(0px);
                    -webkit-backdrop-filter: blur(0px);
                }
                to {
                    opacity: 1;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }
            }

            .drop-zone-content {
                text-align: center;
                color: white;
                padding: 40px;
                border: 3px dashed rgba(255, 255, 255, 0.8);
                border-radius: 24px;
                background: rgba(255, 255, 255, 0.15);
                max-width: 400px;
                margin: 0 20px;
                animation: dropZoneScale 0.3s ease-out 0.1s both;
            }

            @keyframes dropZoneScale {
                from {
                    transform: scale(0.8) translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: scale(1) translateY(0);
                    opacity: 1;
                }
            }

            .drop-zone-icon {
                font-size: 64px;
                margin-bottom: 20px;
                animation: dropZoneBounce 2s infinite;
                filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
            }

            .drop-zone-text {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 12px;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }

            .drop-zone-types {
                font-size: 16px;
                opacity: 0.9;
                margin-bottom: 8px;
            }

            .drop-zone-limit {
                font-size: 14px;
                opacity: 0.8;
                font-style: italic;
            }

            @keyframes dropZoneBounce {
                0%, 20%, 50%, 80%, 100% {
                    transform: translateY(0);
                }
                40% {
                    transform: translateY(-15px);
                }
                60% {
                    transform: translateY(-8px);
                }
            }

            .file-input-container {
                position: relative;
                display: inline-block;
            }

            .file-input-hidden {
                position: absolute;
                opacity: 0;
                width: 0;
                height: 0;
                overflow: hidden;
                pointer-events: none;
            }

            .attachment-menu {
                position: fixed;
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                z-index: 3000;
                display: none;
                min-width: 220px;
                border: 1px solid #e0e0e0;
                overflow: hidden;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }

            .attachment-menu.visible {
                display: block;
                animation: attachmentMenuIn 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            @keyframes attachmentMenuIn {
                from {
                    opacity: 0;
                    transform: scale(0.85) translateY(15px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            .attachment-option {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px 20px;
                cursor: pointer;
                transition: all 0.2s ease;
                color: #333;
                border-bottom: 1px solid #f5f5f5;
                position: relative;
                overflow: hidden;
                min-height: 56px;
            }

            .attachment-option:last-child {
                border-bottom: none;
            }

            .attachment-option::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                height: 100%;
                width: 4px;
                background: var(--tg-primary);
                transform: scaleY(0);
                transition: transform 0.2s ease;
            }

            .attachment-option:hover {
                background: #f8f9fa;
                transform: translateX(4px);
            }

            .attachment-option:hover::before {
                transform: scaleY(1);
            }

            .attachment-option:active {
                background: #e9ecef;
                transform: translateX(2px) scale(0.98);
            }

            .attachment-icon {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--tg-primary);
                font-size: 18px;
                flex-shrink: 0;
            }

            .attachment-option-text {
                font-weight: 500;
                font-size: 15px;
            }

            .attachment-option-desc {
                font-size: 12px;
                color: #666;
                margin-top: 2px;
            }

            .file-upload-progress {
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                z-index: 2000;
                min-width: 320px;
                max-width: 420px;
                display: none;
                border: 1px solid #e0e0e0;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                overflow: hidden;
            }

            .file-upload-progress.visible {
                display: block;
                animation: progressSlideUp 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            @keyframes progressSlideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .upload-progress-header {
                padding: 16px 20px;
                border-bottom: 1px solid #f0f0f0;
                font-weight: 600;
                color: #333;
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            }

            .upload-progress-header h4 {
                margin: 0;
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .upload-item {
                padding: 16px 20px;
                border-bottom: 1px solid #f5f5f5;
                transition: background-color 0.2s ease;
            }

            .upload-item:last-child {
                border-bottom: none;
            }

            .upload-item:hover {
                background: #fafbfc;
            }

            .upload-item.error {
                background: rgba(244, 67, 54, 0.05);
                border-left: 4px solid #f44336;
            }

            .upload-item.completed {
                background: rgba(76, 175, 80, 0.05);
                border-left: 4px solid #4caf50;
            }

            .upload-file-info {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 10px;
            }

            .upload-file-icon {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                color: white;
                flex-shrink: 0;
                position: relative;
                overflow: hidden;
            }

            .upload-file-icon::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%);
            }

            .upload-file-icon.image { 
                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
            }
            .upload-file-icon.video { 
                background: linear-gradient(135deg, #FF9800 0%, #f57c00 100%); 
            }
            .upload-file-icon.audio { 
                background: linear-gradient(135deg, #9C27B0 0%, #7b1fa2 100%); 
            }
            .upload-file-icon.document { 
                background: linear-gradient(135deg, #2196F3 0%, #1976d2 100%); 
            }
            .upload-file-icon.archive { 
                background: linear-gradient(135deg, #607D8B 0%, #455a64 100%); 
            }

            .upload-file-details {
                flex: 1;
                min-width: 0;
            }

            .upload-file-name {
                font-weight: 600;
                color: #333;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 14px;
                line-height: 1.4;
            }

            .upload-file-size {
                font-size: 12px;
                color: #666;
                margin-top: 2px;
            }

            .upload-file-speed {
                font-size: 11px;
                color: #999;
                margin-top: 1px;
            }

            .upload-progress-bar {
                height: 6px;
                background: #f0f0f0;
                border-radius: 3px;
                overflow: hidden;
                margin-top: 10px;
                position: relative;
            }

            .upload-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--tg-primary) 0%, var(--tg-primary-dark) 100%);
                transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                border-radius: 3px;
                position: relative;
                overflow: hidden;
            }

            .upload-progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                right: 0;
                background-image: linear-gradient(45deg, rgba(255,255,255,.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.2) 50%, rgba(255,255,255,.2) 75%, transparent 75%, transparent);
                background-size: 20px 20px;
                animation: progressStripes 1s linear infinite;
            }

            @keyframes progressStripes {
                0% {
                    background-position: 0 0;
                }
                100% {
                    background-position: 20px 0;
                }
            }

            .upload-cancel-btn {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                flex-shrink: 0;
                font-size: 14px;
            }

            .upload-cancel-btn:hover {
                background: #f0f0f0;
                color: #333;
                transform: scale(1.1);
            }

            .upload-cancel-btn:active {
                transform: scale(0.95);
            }

            .camera-capture-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                height: 100dvh;
                background: rgba(0, 0, 0, 0.95);
                z-index: 3001;
                display: none;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                overscroll-behavior: contain;
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
            }

            .camera-capture-modal.visible {
                display: flex;
                animation: cameraModalIn 0.3s ease-out;
            }

            @keyframes cameraModalIn {
                from {
                    opacity: 0;
                    backdrop-filter: blur(0px);
                    -webkit-backdrop-filter: blur(0px);
                }
                to {
                    opacity: 1;
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                }
            }

            .camera-container {
                position: relative;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                background: #000;
            }

            .camera-preview {
                max-width: 90vw;
                max-height: 70vh;
                border-radius: 16px;
                background: #000;
                object-fit: cover;
            }

            .camera-overlay {
                position: absolute;
                top: 16px;
                left: 16px;
                right: 16px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                pointer-events: none;
            }

            .camera-info {
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
            }

            .camera-controls {
                display: flex;
                gap: 20px;
                margin-top: 24px;
                align-items: center;
            }

            .camera-control-btn {
                background: rgba(255, 255, 255, 0.15);
                border: 2px solid rgba(255, 255, 255, 0.3);
                color: white;
                width: 64px;
                height: 64px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                position: relative;
                overflow: hidden;
            }

            .camera-control-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .camera-control-btn:hover {
                background: rgba(255, 255, 255, 0.25);
                border-color: rgba(255, 255, 255, 0.5);
                transform: scale(1.05);
            }

            .camera-control-btn:hover::before {
                opacity: 1;
            }

            .camera-control-btn:active {
                transform: scale(0.95);
            }

            .camera-control-btn.capture {
                background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
                border-color: #ff6666;
                width: 80px;
                height: 80px;
                font-size: 28px;
                box-shadow: 0 4px 16px rgba(255, 68, 68, 0.4);
            }

            .camera-control-btn.capture:hover {
                background: linear-gradient(135deg, #ff3333 0%, #bb0000 100%);
                box-shadow: 0 6px 20px rgba(255, 68, 68, 0.6);
            }

            .camera-control-btn.recording {
                animation: recordingPulse 1.5s ease-in-out infinite;
            }

            @keyframes recordingPulse {
                0%, 100% {
                    box-shadow: 0 4px 16px rgba(255, 68, 68, 0.4);
                }
                50% {
                    box-shadow: 0 4px 16px rgba(255, 68, 68, 0.8), 0 0 0 8px rgba(255, 68, 68, 0.2);
                }
            }

            /* File message styles */
            .file-message {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--tg-message-received);
                border-radius: 18px;
                margin: 8px 0;
                max-width: 340px;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid rgba(0, 0, 0, 0.05);
                position: relative;
                overflow: hidden;
            }

            .file-message::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%);
                pointer-events: none;
            }

            .file-message.sent {
                background: var(--tg-message-sent);
                align-self: flex-end;
                margin-left: auto;
            }

            .file-message:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .file-message:active {
                transform: translateY(0) scale(0.98);
            }

            .file-message-icon {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                color: white;
                flex-shrink: 0;
                position: relative;
                overflow: hidden;
            }

            .file-message-icon::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%);
            }

            .file-message-info {
                flex: 1;
                min-width: 0;
            }

            .file-message-name {
                font-weight: 600;
                color: var(--tg-text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 14px;
                margin-bottom: 4px;
                line-height: 1.3;
            }

            .file-message-size {
                font-size: 12px;
                color: var(--tg-text-secondary);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .file-message-download {
                background: var(--tg-primary);
                color: white;
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                transition: all 0.2s ease;
                flex-shrink: 0;
                position: relative;
                overflow: hidden;
            }

            .file-message-download::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .file-message-download:hover {
                background: var(--tg-primary-dark);
                transform: scale(1.1);
            }

            .file-message-download:hover::before {
                opacity: 1;
            }

            .file-message-download:active {
                transform: scale(0.95);
            }

            .image-preview {
                max-width: 320px;
                max-height: 240px;
                border-radius: 16px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                object-fit: cover;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                position: relative;
            }

            .image-preview:hover {
                transform: scale(1.02);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            }

            .image-preview:active {
                transform: scale(0.98);
            }

            .video-preview {
                max-width: 320px;
                max-height: 240px;
                border-radius: 16px;
                cursor: pointer;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                transition: all 0.2s ease;
            }

            .video-preview:hover {
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            }

            /* Enhanced mobile responsiveness */
            @media (max-width: 768px) {
                .file-upload-progress {
                    right: 10px;
                    left: 10px;
                    min-width: auto;
                    max-width: none;
                    bottom: 60px;
                }

                .camera-preview {
                    max-width: 95vw;
                    max-height: 65vh;
                    border-radius: 12px;
                }

                .camera-controls {
                    gap: 16px;
                    margin-top: 20px;
                }

                .camera-control-btn {
                    width: 56px;
                    height: 56px;
                    font-size: 20px;
                }

                .camera-control-btn.capture {
                    width: 72px;
                    height: 72px;
                    font-size: 24px;
                }

                .file-message {
                    max-width: 300px;
                }

                .image-preview {
                    max-width: 280px;
                    max-height: 200px;
                    border-radius: 12px;
                }

                .video-preview {
                    max-width: 280px;
                    max-height: 200px;
                    border-radius: 12px;
                }

                .attachment-menu {
                    min-width: 200px;
                    border-radius: 12px;
                }

                .attachment-option {
                    padding: 14px 16px;
                    min-height: 48px;
                }

                .drop-zone-content {
                    padding: 32px 24px;
                    border-radius: 20px;
                }

                .drop-zone-icon {
                    font-size: 48px;
                }

                .drop-zone-text {
                    font-size: 20px;
                }
            }

            @media (max-width: 480px) {
                .camera-controls {
                    gap: 12px;
                }

                .camera-control-btn {
                    width: 48px;
                    height: 48px;
                    font-size: 18px;
                }

                .camera-control-btn.capture {
                    width: 64px;
                    height: 64px;
                    font-size: 22px;
                }

                .file-message {
                    max-width: 260px;
                    padding: 10px 12px;
                }

                .file-message-icon {
                    width: 36px;
                    height: 36px;
                    font-size: 16px;
                }

                .file-message-download {
                    width: 32px;
                    height: 32px;
                    font-size: 14px;
                }

                .image-preview {
                    max-width: 240px;
                    max-height: 180px;
                }

                .video-preview {
                    max-width: 240px;
                    max-height: 180px;
                }
            }

            /* Accessibility improvements */
            @media (prefers-reduced-motion: reduce) {
                .file-drop-zone,
                .attachment-menu,
                .camera-capture-modal,
                .file-upload-progress {
                    animation: none !important;
                }

                .drop-zone-icon,
                .camera-control-btn.recording {
                    animation: none !important;
                }

                .upload-progress-fill::after {
                    animation: none !important;
                }
            }

            @media (prefers-contrast: high) {
                .file-drop-zone {
                    background: rgba(0, 0, 0, 0.9);
                }

                .drop-zone-content {
                    border-color: white;
                    background: rgba(0, 0, 0, 0.8);
                }

                .attachment-menu,
                .file-upload-progress {
                    border: 2px solid #000;
                }

                .file-message {
                    border: 2px solid var(--tg-text-primary);
                }
            }

            /* Focus styles for keyboard navigation */
            .attachment-option:focus,
            .camera-control-btn:focus,
            .upload-cancel-btn:focus,
            .file-message-download:focus {
                outline: 3px solid var(--tg-primary);
                outline-offset: 2px;
            }

            /* Loading states */
            .upload-item.processing .upload-file-icon {
                animation: processingRotate 1s linear infinite;
            }

            @keyframes processingRotate {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }
        `;
        document.head.appendChild(styles);
    }

    showDropZone() {
        const dropZone = document.querySelector('.file-drop-zone');
        if (dropZone) {
            dropZone.classList.add('visible');
            this.dragActive = true;
            // Focus management for accessibility
            dropZone.focus();
        }
    }

    hideDropZone() {
        const dropZone = document.querySelector('.file-drop-zone');
        if (dropZone) {
            dropZone.classList.remove('visible');
            this.dragActive = false;
        }
    }

    setupFileInput() {
        const attachmentBtn = document.querySelector('.attachment-btn');
        if (!attachmentBtn) return;

        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.className = 'file-input-hidden';
        fileInput.accept = this.getAllowedTypesString();
        fileInput.setAttribute('aria-label', 'Select files to upload');

        // Create enhanced attachment menu
        this.createAttachmentMenu();

        // Setup event listeners
        attachmentBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAttachmentMenu(e);
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
            e.target.value = ''; // Reset input
        });

        document.body.appendChild(fileInput);
        this.fileInput = fileInput;
    }

    createAttachmentMenu() {
        const menu = document.createElement('div');
        menu.className = 'attachment-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Attachment options');
        menu.innerHTML = `
            <div class="attachment-option" data-action="file" role="menuitem" tabindex="0">
                <i class="fas fa-file attachment-icon" aria-hidden="true"></i>
                <div>
                    <div class="attachment-option-text">Document</div>
                    <div class="attachment-option-desc">PDF, DOC, TXT</div>
                </div>
            </div>
            <div class="attachment-option" data-action="image" role="menuitem" tabindex="0">
                <i class="fas fa-image attachment-icon" aria-hidden="true"></i>
                <div>
                    <div class="attachment-option-text">Photo</div>
                    <div class="attachment-option-desc">JPG, PNG, GIF</div>
                </div>
            </div>
            <div class="attachment-option" data-action="camera" role="menuitem" tabindex="0">
                <i class="fas fa-camera attachment-icon" aria-hidden="true"></i>
                <div>
                    <div class="attachment-option-text">Take Photo</div>
                    <div class="attachment-option-desc">Use camera</div>
                </div>
            </div>
            <div class="attachment-option" data-action="video" role="menuitem" tabindex="0">
                <i class="fas fa-video attachment-icon" aria-hidden="true"></i>
                <div>
                    <div class="attachment-option-text">Video</div>
                    <div class="attachment-option-desc">MP4, WebM</div>
                </div>
            </div>
            <div class="attachment-option" data-action="record-video" role="menuitem" tabindex="0">
                <i class="fas fa-video attachment-icon" aria-hidden="true"></i>
                <div>
                    <div class="attachment-option-text">Record Video</div>
                    <div class="attachment-option-desc">Use camera</div>
                </div>
            </div>
        `;

        document.body.appendChild(menu);

        // Setup event listeners
        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.attachment-option');
            if (option) {
                this.handleAttachmentOption(option.dataset.action);
                this.hideAttachmentMenu();
            }
        });

        // Keyboard navigation
        menu.addEventListener('keydown', (e) => {
            const options = menu.querySelectorAll('.attachment-option');
            const currentIndex = Array.from(options).indexOf(document.activeElement);
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    const nextIndex = (currentIndex + 1) % options.length;
                    options[nextIndex].focus();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    const prevIndex = (currentIndex - 1 + options.length) % options.length;
                    options[prevIndex].focus();
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    if (document.activeElement.dataset.action) {
                        this.handleAttachmentOption(document.activeElement.dataset.action);
                        this.hideAttachmentMenu();
                    }
                    break;
                case 'Escape':
                    this.hideAttachmentMenu();
                    break;
            }
        });

        // Hide menu when clicking outside
        document.addEventListener('click', (e) => {
            const attachmentBtn = document.querySelector('.attachment-btn');
            if (!menu.contains(e.target) && !attachmentBtn.contains(e.target) && menu.classList.contains('visible')) {
                this.hideAttachmentMenu();
            }
        });

        this.attachmentMenu = menu;
    }

    showAttachmentMenu(event) {
        const menu = this.attachmentMenu;
        if (!menu) return;

        menu.classList.add('visible');

        // Position menu with better mobile handling
        const rect = event.target.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        let x = rect.left;
        let y = rect.top - menuRect.height - 12;

        // Adjust if menu goes off screen
        if (x + menuRect.width > window.innerWidth - 20) {
            x = window.innerWidth - menuRect.width - 20;
        }
        if (x < 20) {
            x = 20;
        }
        if (y < 20) {
            y = rect.bottom + 12;
        }

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // Focus first option for accessibility
        const firstOption = menu.querySelector('.attachment-option');
        if (firstOption) {
            firstOption.focus();
        }

        this.announceToScreenReader('Attachment menu opened');
    }

    hideAttachmentMenu() {
        if (this.attachmentMenu) {
            this.attachmentMenu.classList.remove('visible');
            this.announceToScreenReader('Attachment menu closed');
        }
    }

    handleAttachmentOption(action) {
        switch (action) {
            case 'file':
                this.fileInput.accept = this.getAllowedTypesString();
                this.fileInput.click();
                break;
            case 'image':
                this.fileInput.accept = this.allowedTypes.images.join(',');
                this.fileInput.click();
                break;
            case 'camera':
                this.openCameraCapture('photo');
                break;
            case 'video':
                this.fileInput.accept = this.allowedTypes.videos.join(',');
                this.fileInput.click();
                break;
            case 'record-video':
                this.openCameraCapture('video');
                break;
        }
    }

    getAllowedTypesString() {
        const allTypes = Object.values(this.allowedTypes).flat();
        return allTypes.join(',');
    }

    async setupCameraCapture() {
        // Check camera support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('⚠️ Camera access not supported');
            return;
        }

        this.createCameraCaptureModal();
    }

    createCameraCaptureModal() {
        const modal = document.createElement('div');
        modal.className = 'camera-capture-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Camera capture');
        modal.innerHTML = `
            <div class="camera-container">
                <video class="camera-preview" autoplay muted playsinline></video>
                <div class="camera-overlay">
                    <div class="camera-info">
                        <span id="camera-mode">Photo Mode</span>
                    </div>
                </div>
            </div>
            <div class="camera-controls">
                <button class="camera-control-btn close" title="Close camera" aria-label="Close camera">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
                <button class="camera-control-btn capture" title="Take photo" aria-label="Take photo">
                    <i class="fas fa-camera" aria-hidden="true"></i>
                </button>
                <button class="camera-control-btn switch" title="Switch camera" aria-label="Switch camera">
                    <i class="fas fa-sync-alt" aria-hidden="true"></i>
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        modal.querySelector('.close').addEventListener('click', () => {
            this.closeCameraCapture();
        });

        modal.querySelector('.capture').addEventListener('click', () => {
            if (this.captureMode === 'photo') {
                this.capturePhoto();
            } else if (this.captureMode === 'video') {
                this.toggleVideoRecording();
            }
        });

        modal.querySelector('.switch').addEventListener('click', () => {
            this.switchCamera();
        });

        // Keyboard support
        modal.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Escape':
                    this.closeCameraCapture();
                    break;
                case ' ':
                case 'Enter':
                    if (e.target.classList.contains('capture')) {
                        e.preventDefault();
                        if (this.captureMode === 'photo') {
                            this.capturePhoto();
                        } else if (this.captureMode === 'video') {
                            this.toggleVideoRecording();
                        }
                    }
                    break;
            }
        });

        this.cameraModal = modal;
    }

    async openCameraCapture(mode = 'photo') {
        this.captureMode = mode;
        
        try {
            // Request camera permissions
            const constraints = {
                video: { 
                    facingMode: this.currentCameraMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: mode === 'video'
            };

            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);

            const video = this.cameraModal.querySelector('.camera-preview');
            video.srcObject = this.cameraStream;

            // Update UI based on mode
            const modeText = this.cameraModal.querySelector('#camera-mode');
            const captureBtn = this.cameraModal.querySelector('.capture');
            const captureIcon = captureBtn.querySelector('i');

            if (mode === 'video') {
                modeText.textContent = 'Video Mode';
                captureIcon.className = 'fas fa-video';
                captureBtn.setAttribute('title', 'Start recording');
                captureBtn.setAttribute('aria-label', 'Start recording');
            } else {
                modeText.textContent = 'Photo Mode';
                captureIcon.className = 'fas fa-camera';
                captureBtn.setAttribute('title', 'Take photo');
                captureBtn.setAttribute('aria-label', 'Take photo');
            }

            this.cameraModal.classList.add('visible');
            this.announceToScreenReader(`Camera opened in ${mode} mode`);

        } catch (error) {
            console.error('❌ Camera access failed:', error);
            this.showCameraPermissionPrompt();
        }
    }

    closeCameraCapture() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }

        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }

        this.cameraModal.classList.remove('visible');
        this.isRecording = false;
        this.announceToScreenReader('Camera closed');
    }

    capturePhoto() {
        const video = this.cameraModal.querySelector('.camera-preview');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(video, 0, 0);

        // Remove EXIF data by re-encoding
        canvas.toBlob((blob) => {
            const file = new File([blob], `photo_${Date.now()}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });

            this.closeCameraCapture();
            this.handleFileSelection([file]);
            this.triggerHaptic('medium');
            this.announceToScreenReader('Photo captured');
        }, 'image/jpeg', 0.92);
    }

    async switchCamera() {
        if (this.cameraStream) {
            const videoTrack = this.cameraStream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            this.currentCameraMode = settings.facingMode === 'user' ? 'environment' : 'user';

            try {
                this.cameraStream.getTracks().forEach(track => track.stop());
                
                const constraints = {
                    video: { 
                        facingMode: this.currentCameraMode,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: this.captureMode === 'video'
                };

                this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);

                const video = this.cameraModal.querySelector('.camera-preview');
                video.srcObject = this.cameraStream;

                this.announceToScreenReader(`Switched to ${this.currentCameraMode === 'user' ? 'front' : 'back'} camera`);

            } catch (error) {
                console.warn('⚠️ Camera switch failed:', error);
                this.announceToScreenReader('Camera switch failed');
            }
        }
    }

    setupVideoRecording() {
        // Enhanced video recording support
        this.recordedChunks = [];
    }

    toggleVideoRecording() {
        if (!this.isRecording) {
            this.startVideoRecording();
        } else {
            this.stopVideoRecording();
        }
    }

    startVideoRecording() {
        try {
            const options = {
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: 1000000 // 1 Mbps
            };

            this.mediaRecorder = new MediaRecorder(this.cameraStream, options);
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                const file = new File([blob], `video_${Date.now()}.webm`, {
                    type: 'video/webm',
                    lastModified: Date.now()
                });

                this.closeCameraCapture();
                this.handleFileSelection([file]);
                this.announceToScreenReader('Video recording completed');
            };

            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;

            // Update UI
            const captureBtn = this.cameraModal.querySelector('.capture');
            const captureIcon = captureBtn.querySelector('i');
            captureBtn.classList.add('recording');
            captureIcon.className = 'fas fa-stop';
            captureBtn.setAttribute('title', 'Stop recording');
            captureBtn.setAttribute('aria-label', 'Stop recording');

            this.announceToScreenReader('Video recording started');

        } catch (error) {
            console.error('❌ Video recording failed:', error);
            this.announceToScreenReader('Video recording failed');
        }
    }

    stopVideoRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;

            // Reset UI
            const captureBtn = this.cameraModal.querySelector('.capture');
            const captureIcon = captureBtn.querySelector('i');
            captureBtn.classList.remove('recording');
            captureIcon.className = 'fas fa-video';
            captureBtn.setAttribute('title', 'Start recording');
            captureBtn.setAttribute('aria-label', 'Start recording');
        }
    }

    showCameraPermissionPrompt() {
        const permissionModal = document.createElement('div');
        permissionModal.className = 'camera-permission-modal';
        permissionModal.innerHTML = `
            <div class="permission-modal-content">
                <div class="permission-icon">
                    <i class="fas fa-camera"></i>
                </div>
                <h3>Camera Access Required</h3>
                <p>CipherWave needs camera access to take photos and record videos. Please allow camera access in your browser settings.</p>
                <div class="permission-actions">
                    <button class="btn btn-primary" onclick="this.closest('.camera-permission-modal').remove()">
                        Got it
                    </button>
                </div>
            </div>
        `;

        // Add styles for permission modal
        const styles = document.createElement('style');
        styles.textContent = `
            .camera-permission-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 3002;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            }

            .permission-modal-content {
                background: white;
                border-radius: 16px;
                padding: 32px;
                max-width: 400px;
                margin: 20px;
                text-align: center;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }

            .permission-icon {
                font-size: 48px;
                color: var(--tg-primary);
                margin-bottom: 20px;
            }

            .permission-modal-content h3 {
                margin: 0 0 16px 0;
                color: #333;
                font-size: 20px;
            }

            .permission-modal-content p {
                margin: 0 0 24px 0;
                color: #666;
                line-height: 1.5;
            }

            .permission-actions {
                display: flex;
                justify-content: center;
            }
        `;
        document.head.appendChild(styles);

        document.body.appendChild(permissionModal);

        setTimeout(() => {
            permissionModal.remove();
            styles.remove();
        }, 8000);
    }

    setupClipboardPaste() {
        document.addEventListener('paste', (e) => {
            const items = Array.from(e.clipboardData.items);
            const files = items
                .filter(item => item.kind === 'file')
                .map(item => item.getAsFile())
                .filter(file => file);

            if (files.length > 0) {
                e.preventDefault();
                this.handleFileSelection(files);
                this.announceToScreenReader(`${files.length} file${files.length !== 1 ? 's' : ''} pasted`);
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + V for file upload
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
                e.preventDefault();
                const attachmentBtn = document.querySelector('.attachment-btn');
                if (attachmentBtn) {
                    attachmentBtn.click();
                }
            }

            // Escape to close attachment menu
            if (e.key === 'Escape' && this.attachmentMenu?.classList.contains('visible')) {
                this.hideAttachmentMenu();
            }
        });
    }

    setupAccessibilityFeatures() {
        // Add ARIA live region for file upload announcements
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'visually-hidden';
        liveRegion.id = 'file-upload-announcements';
        document.body.appendChild(liveRegion);

        // Add keyboard shortcuts help
        const helpButton = document.createElement('button');
        helpButton.className = 'keyboard-help-btn visually-hidden';
        helpButton.textContent = 'Keyboard shortcuts: Ctrl+Shift+V to open file menu, Escape to close menus';
        helpButton.setAttribute('aria-label', 'File upload keyboard shortcuts');
        document.body.appendChild(helpButton);
    }

    handleFilesDrop(files) {
        this.handleFileSelection(files);
    }

    handleFileSelection(files) {
        const validFiles = Array.from(files).filter(file => {
            if (file.size > this.maxFileSize) {
                this.showFileSizeError(file);
                return false;
            }

            if (!this.isFileTypeAllowed(file)) {
                this.showFileTypeError(file);
                return false;
            }

            return true;
        });

        if (validFiles.length === 0) return;

        // Start performance tracking
        this.performanceMetrics.uploadStartTime = performance.now();

        validFiles.forEach(file => {
            this.processFile(file);
        });

        this.announceToScreenReader(`${validFiles.length} file${validFiles.length !== 1 ? 's' : ''} selected for upload`);
    }

    isFileTypeAllowed(file) {
        const allTypes = Object.values(this.allowedTypes).flat();
        return allTypes.includes(file.type);
    }

    getFileCategory(file) {
        for (const [category, types] of Object.entries(this.allowedTypes)) {
            if (types.includes(file.type)) {
                return category;
            }
        }
        return 'document';
    }

    showFileSizeError(file) {
        const maxSizeMB = Math.round(this.maxFileSize / (1024 * 1024));
        const fileSizeMB = Math.round(file.size / (1024 * 1024));
        
        this.showNotification(
            `File "${file.name}" is too large (${fileSizeMB}MB). Maximum size allowed is ${maxSizeMB}MB.`,
            'error'
        );
    }

    showFileTypeError(file) {
        this.showNotification(
            `File type "${file.type}" is not supported.`,
            'error'
        );
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `file-notification ${type}`;
        notification.textContent = message;
        notification.setAttribute('role', 'alert');

        // Add styles
        const styles = `
            .file-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 12px;
                padding: 16px 20px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 3000;
                max-width: 400px;
                animation: notificationIn 0.3s ease-out;
                border-left: 4px solid var(--tg-primary);
            }

            .file-notification.error {
                border-left-color: #f44336;
                background: #fff5f5;
            }

            .file-notification.success {
                border-left-color: #4caf50;
                background: #f0fff4;
            }

            @keyframes notificationIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            @media (max-width: 480px) {
                .file-notification {
                    left: 10px;
                    right: 10px;
                    top: 10px;
                }
            }
        `;

        // Add styles if not already added
        if (!document.querySelector('#file-notification-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'file-notification-styles';
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }

        document.body.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'notificationIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    async processFile(file) {
        const fileId = this.generateFileId();
        const category = this.getFileCategory(file);

        // Add to upload queue
        const uploadItem = {
            id: fileId,
            file: file,
            originalFile: file, // Keep reference to original
            category: category,
            progress: 0,
            status: 'processing',
            startTime: Date.now(),
            speed: 0
        };

        this.uploadQueue.push(uploadItem);
        this.showUploadProgress(uploadItem);

        try {
            // Remove EXIF data and compress if needed
            const compressionStart = performance.now();
            const processedFile = await this.processFileForSecurity(file, category);
            this.performanceMetrics.compressionTime = performance.now() - compressionStart;
            
            uploadItem.file = processedFile;
            uploadItem.status = 'uploading';
            this.updateUploadProgress(uploadItem);

            // Start upload
            await this.uploadFile(uploadItem);

        } catch (error) {
            console.error('❌ File processing failed:', error);
            uploadItem.status = 'error';
            this.updateUploadProgress(uploadItem);
            this.showNotification(`Failed to process ${file.name}`, 'error');
        }
    }

    async processFileForSecurity(file, category) {
        if (category === 'images') {
            return await this.processImageForSecurity(file);
        }
        
        // For other file types, return as-is but could add more processing
        return file;
    }

    async processImageForSecurity(file) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const { maxWidth, maxHeight, quality } = this.compressionSettings.image;
                
                // Calculate new dimensions
                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;
                
                // Draw image (this removes EXIF data)
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob with specified quality
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    generateFileId() {
        return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    setupProgressIndicators() {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'file-upload-progress';
        progressContainer.setAttribute('role', 'status');
        progressContainer.setAttribute('aria-label', 'File upload progress');
        progressContainer.innerHTML = `
            <div class="upload-progress-header">
                <h4>
                    <i class="fas fa-cloud-upload-alt" aria-hidden="true"></i>
                    Uploading Files
                </h4>
                <button class="upload-cancel-btn" title="Cancel all uploads" aria-label="Cancel all uploads">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
            <div class="upload-items-container"></div>
        `;

        document.body.appendChild(progressContainer);

        // Setup cancel all button
        progressContainer.querySelector('.upload-cancel-btn').addEventListener('click', () => {
            this.cancelAllUploads();
        });

        this.progressContainer = progressContainer;
    }

    showUploadProgress(uploadItem) {
        const container = this.progressContainer.querySelector('.upload-items-container');
        
        const itemElement = document.createElement('div');
        itemElement.className = 'upload-item';
        itemElement.dataset.fileId = uploadItem.id;
        itemElement.setAttribute('role', 'progressbar');
        itemElement.setAttribute('aria-valuenow', '0');
        itemElement.setAttribute('aria-valuemin', '0');
        itemElement.setAttribute('aria-valuemax', '100');
        
        const iconClass = uploadItem.category.replace(/s$/, ''); // Remove plural 's'
        const fileSize = this.formatFileSize(uploadItem.file.size);

        itemElement.innerHTML = `
            <div class="upload-file-info">
                <div class="upload-file-icon ${iconClass}">
                    <i class="fas fa-${this.getFileIcon(uploadItem.category)}" aria-hidden="true"></i>
                </div>
                <div class="upload-file-details">
                    <div class="upload-file-name">${uploadItem.file.name}</div>
                    <div class="upload-file-size">${fileSize}</div>
                    <div class="upload-file-speed"></div>
                </div>
                <button class="upload-cancel-btn" title="Cancel upload" aria-label="Cancel ${uploadItem.file.name} upload">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: 0%"></div>
            </div>
        `;

        container.appendChild(itemElement);

        // Setup cancel button
        itemElement.querySelector('.upload-cancel-btn').addEventListener('click', () => {
            this.cancelUpload(uploadItem.id);
        });

        this.progressContainer.classList.add('visible');
    }

    updateUploadProgress(uploadItem) {
        const itemElement = document.querySelector(`[data-file-id="${uploadItem.id}"]`);
        if (!itemElement) return;

        const progressFill = itemElement.querySelector('.upload-progress-fill');
        const speedElement = itemElement.querySelector('.upload-file-speed');
        
        if (progressFill) {
            progressFill.style.width = `${uploadItem.progress}%`;
            itemElement.setAttribute('aria-valuenow', uploadItem.progress.toString());
        }

        // Update speed display
        if (speedElement && uploadItem.speed > 0) {
            speedElement.textContent = `${this.formatFileSize(uploadItem.speed)}/s`;
        }

        // Update status classes
        itemElement.className = `upload-item ${uploadItem.status}`;

        if (uploadItem.status === 'completed') {
            setTimeout(() => {
                itemElement.remove();
                this.checkHideProgressContainer();
            }, 2000);
        } else if (uploadItem.status === 'error') {
            setTimeout(() => {
                itemElement.remove();
                this.checkHideProgressContainer();
            }, 5000);
        }
    }

    checkHideProgressContainer() {
        const container = this.progressContainer.querySelector('.upload-items-container');
        if (container.children.length === 0) {
            this.progressContainer.classList.remove('visible');
        }
    }

    getFileIcon(category) {
        const icons = {
            images: 'image',
            videos: 'video',
            audio: 'music',
            documents: 'file-alt',
            archives: 'file-archive'
        };
        return icons[category] || 'file';
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async uploadFile(uploadItem) {
        const startTime = Date.now();
        let lastProgressTime = startTime;
        let lastProgressBytes = 0;

        // Simulate more realistic upload progress
        const progressStep = () => {
            if (uploadItem.progress < 100 && uploadItem.status === 'uploading') {
                const currentTime = Date.now();
                const elapsed = currentTime - lastProgressTime;
                
                // Simulate variable upload speed
                const increment = Math.random() * 15 + 5; // 5-20% increment
                uploadItem.progress = Math.min(100, uploadItem.progress + increment);
                
                // Calculate upload speed
                if (elapsed > 1000) { // Update speed every second
                    const bytesThisSecond = (uploadItem.progress - lastProgressBytes) / 100 * uploadItem.file.size;
                    uploadItem.speed = bytesThisSecond / (elapsed / 1000);
                    lastProgressTime = currentTime;
                    lastProgressBytes = uploadItem.progress;
                }
                
                this.updateUploadProgress(uploadItem);
                
                if (uploadItem.progress >= 100) {
                    uploadItem.status = 'completed';
                    this.handleUploadComplete(uploadItem);
                } else {
                    setTimeout(progressStep, 200 + Math.random() * 300);
                }
            }
        };

        progressStep();
    }

    async handleUploadComplete(uploadItem) {
        const uploadTime = Date.now() - uploadItem.startTime;
        console.log(`📁 File upload completed in ${uploadTime}ms`);

        // Create file message in chat
        const messageElement = this.createFileMessage(uploadItem);
        
        // Add to messages container
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.appendChild(messageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Send file data via WebRTC with encryption
        await this.sendFileData(uploadItem);

        this.announceToScreenReader(`File ${uploadItem.file.name} uploaded successfully`);
        this.triggerHaptic('light');
    }

    createFileMessage(uploadItem) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message sent';
        messageElement.setAttribute('data-file-id', uploadItem.id);
        
        if (uploadItem.category === 'images') {
            messageElement.innerHTML = this.createImageMessage(uploadItem);
        } else if (uploadItem.category === 'videos') {
            messageElement.innerHTML = this.createVideoMessage(uploadItem);
        } else {
            messageElement.innerHTML = this.createGenericFileMessage(uploadItem);
        }

        return messageElement;
    }

    createImageMessage(uploadItem) {
        const imageUrl = URL.createObjectURL(uploadItem.file);
        return `
            <img src="${imageUrl}" alt="${uploadItem.file.name}" class="image-preview" 
                 onclick="this.requestFullscreen?.() || this.webkitRequestFullscreen?.()" 
                 tabindex="0" role="button" aria-label="View ${uploadItem.file.name} fullscreen">
            <div class="message-time">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <i class="fas fa-lock" title="Encrypted" aria-label="Encrypted"></i>
            </div>
        `;
    }

    createVideoMessage(uploadItem) {
        const videoUrl = URL.createObjectURL(uploadItem.file);
        return `
            <video src="${videoUrl}" class="video-preview" controls preload="metadata" 
                   aria-label="Video: ${uploadItem.file.name}">
                Your browser does not support the video tag.
            </video>
            <div class="message-time">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <i class="fas fa-lock" title="Encrypted" aria-label="Encrypted"></i>
            </div>
        `;
    }

    createGenericFileMessage(uploadItem) {
        const iconClass = uploadItem.category.replace(/s$/, '');
        const fileSize = this.formatFileSize(uploadItem.file.size);
        
        return `
            <div class="file-message">
                <div class="file-message-icon ${iconClass}">
                    <i class="fas fa-${this.getFileIcon(uploadItem.category)}" aria-hidden="true"></i>
                </div>
                <div class="file-message-info">
                    <div class="file-message-name">${uploadItem.file.name}</div>
                    <div class="file-message-size">
                        ${fileSize}
                        <i class="fas fa-lock" title="Encrypted" aria-label="Encrypted"></i>
                    </div>
                </div>
                <button class="file-message-download" onclick="this.downloadFile('${uploadItem.id}')" 
                        title="Download ${uploadItem.file.name}" aria-label="Download ${uploadItem.file.name}">
                    <i class="fas fa-download" aria-hidden="true"></i>
                </button>
            </div>
            <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
    }

    async sendFileData(uploadItem) {
        try {
            const encryptionStart = performance.now();
            
            // Convert file to base64 for transmission
            const reader = new FileReader();
            
            return new Promise((resolve, reject) => {
                reader.onload = async () => {
                    try {
                        let fileData = {
                            type: 'file-share',
                            id: uploadItem.id,
                            name: uploadItem.file.name,
                            size: uploadItem.file.size,
                            mimeType: uploadItem.file.type,
                            category: uploadItem.category,
                            data: reader.result,
                            timestamp: Date.now(),
                            encrypted: this.encryptionEnabled
                        };

                        // Encrypt data if security manager is available
                        if (this.encryptionEnabled && window.cipherWaveAdvanced?.securityManager) {
                            fileData.data = await window.cipherWaveAdvanced.securityManager.encryptData(fileData.data);
                            fileData.encrypted = true;
                        }

                        this.performanceMetrics.encryptionTime = performance.now() - encryptionStart;

                        // Send via existing WebRTC data channel
                        if (window.dataChannel && window.dataChannel.readyState === 'open') {
                            // For large files, send in chunks
                            if (uploadItem.file.size > 1024 * 1024) { // 1MB
                                await this.sendFileInChunks(fileData);
                            } else {
                                window.dataChannel.send(JSON.stringify(fileData));
                            }
                            resolve();
                        } else {
                            console.warn('⚠️ Data channel not available for file sharing');
                            resolve(); // Still resolve to show message locally
                        }
                    } catch (error) {
                        reject(error);
                    }
                };
                
                reader.onerror = reject;
                reader.readAsDataURL(uploadItem.file);
            });
        } catch (error) {
            console.error('❌ Failed to send file data:', error);
            this.showNotification('Failed to send file', 'error');
        }
    }

    async sendFileInChunks(fileData) {
        const data = fileData.data;
        const chunks = [];
        
        for (let i = 0; i < data.length; i += this.chunkSize) {
            chunks.push(data.slice(i, i + this.chunkSize));
        }

        // Send chunk metadata first
        const chunkMetadata = {
            type: 'file-chunk-start',
            id: fileData.id,
            name: fileData.name,
            size: fileData.size,
            mimeType: fileData.mimeType,
            category: fileData.category,
            totalChunks: chunks.length,
            timestamp: fileData.timestamp,
            encrypted: fileData.encrypted
        };

        window.dataChannel.send(JSON.stringify(chunkMetadata));

        // Send chunks with delay to avoid overwhelming the connection
        for (let i = 0; i < chunks.length; i++) {
            await new Promise(resolve => {
                setTimeout(() => {
                    const chunkData = {
                        type: 'file-chunk',
                        id: fileData.id,
                        index: i,
                        data: chunks[i],
                        isLast: i === chunks.length - 1
                    };
                    
                    window.dataChannel.send(JSON.stringify(chunkData));
                    resolve();
                }, i * 50); // 50ms delay between chunks
            });
        }
    }

    async handleIncomingFileData(data) {
        try {
            if (data.type === 'file-share') {
                await this.processIncomingFile(data);
            } else if (data.type === 'file-chunk-start') {
                this.startReceivingChunks(data);
            } else if (data.type === 'file-chunk') {
                await this.receiveChunk(data);
            }
        } catch (error) {
            console.error('❌ Failed to process incoming file:', error);
            this.showNotification('Failed to receive file', 'error');
        }
    }

    async processIncomingFile(data) {
        try {
            let fileDataContent = data.data;

            // Decrypt data if needed
            if (data.encrypted && window.cipherWaveAdvanced?.securityManager) {
                fileDataContent = await window.cipherWaveAdvanced.securityManager.decryptData(fileDataContent);
            }

            // Convert base64 back to blob
            const binaryString = atob(fileDataContent.split(',')[1]);
            const bytes = new Uint8Array(binaryString.length);
            
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const blob = new Blob([bytes], { type: data.mimeType });
            
            const file = {
                id: data.id,
                name: data.name,
                size: data.size,
                type: data.mimeType,
                category: data.category,
                blob: blob,
                timestamp: data.timestamp,
                encrypted: data.encrypted
            };

            // Create received file message
            const messageElement = this.createReceivedFileMessage(file);
            
            // Add to messages container
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                messagesContainer.appendChild(messageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            this.announceToScreenReader(`File received: ${file.name}`);
            this.triggerHaptic('light');

        } catch (error) {
            console.error('❌ Failed to process incoming file:', error);
            this.showNotification('Failed to process received file', 'error');
        }
    }

    startReceivingChunks(metadata) {
        this.incomingChunks = {
            id: metadata.id,
            name: metadata.name,
            size: metadata.size,
            mimeType: metadata.mimeType,
            category: metadata.category,
            totalChunks: metadata.totalChunks,
            receivedChunks: new Map(),
            timestamp: metadata.timestamp,
            encrypted: metadata.encrypted
        };

        // Show receiving progress
        this.showReceivingProgress(metadata);
    }

    async receiveChunk(chunkData) {
        if (!this.incomingChunks || this.incomingChunks.id !== chunkData.id) {
            return;
        }

        this.incomingChunks.receivedChunks.set(chunkData.index, chunkData.data);

        // Update progress
        const progress = (this.incomingChunks.receivedChunks.size / this.incomingChunks.totalChunks) * 100;
        this.updateReceivingProgress(this.incomingChunks.id, progress);

        if (chunkData.isLast && this.incomingChunks.receivedChunks.size === this.incomingChunks.totalChunks) {
            // Reconstruct file
            let reconstructedData = 'data:' + this.incomingChunks.mimeType + ';base64,';
            
            for (let i = 0; i < this.incomingChunks.totalChunks; i++) {
                reconstructedData += this.incomingChunks.receivedChunks.get(i);
            }

            const fileData = {
                type: 'file-share',
                ...this.incomingChunks,
                data: reconstructedData
            };

            await this.processIncomingFile(fileData);
            this.hideReceivingProgress(this.incomingChunks.id);
            this.incomingChunks = null;
        }
    }

    showReceivingProgress(metadata) {
        // Similar to upload progress but for receiving
        if (!this.receiveProgressContainer) {
            this.createReceiveProgressContainer();
        }

        const container = this.receiveProgressContainer.querySelector('.receive-items-container');
        
        const itemElement = document.createElement('div');
        itemElement.className = 'receive-item';
        itemElement.dataset.fileId = metadata.id;
        
        const iconClass = metadata.category.replace(/s$/, '');
        const fileSize = this.formatFileSize(metadata.size);

        itemElement.innerHTML = `
            <div class="receive-file-info">
                <div class="receive-file-icon ${iconClass}">
                    <i class="fas fa-${this.getFileIcon(metadata.category)}"></i>
                </div>
                <div class="receive-file-details">
                    <div class="receive-file-name">${metadata.name}</div>
                    <div class="receive-file-size">${fileSize}</div>
                </div>
            </div>
            <div class="receive-progress-bar">
                <div class="receive-progress-fill" style="width: 0%"></div>
            </div>
        `;

        container.appendChild(itemElement);
        this.receiveProgressContainer.classList.add('visible');
    }

    createReceiveProgressContainer() {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'file-receive-progress';
        progressContainer.innerHTML = `
            <div class="receive-progress-header">
                <h4>
                    <i class="fas fa-cloud-download-alt"></i>
                    Receiving Files
                </h4>
            </div>
            <div class="receive-items-container"></div>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .file-receive-progress {
                position: fixed;
                bottom: 80px;
                left: 20px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                z-index: 2000;
                min-width: 320px;
                max-width: 420px;
                display: none;
                border: 1px solid #e0e0e0;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }

            .file-receive-progress.visible {
                display: block;
                animation: progressSlideUp 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .receive-progress-header {
                padding: 16px 20px;
                border-bottom: 1px solid #f0f0f0;
                font-weight: 600;
                color: #333;
                background: linear-gradient(135deg, #e8f4f8 0%, #ffffff 100%);
            }

            .receive-progress-header h4 {
                margin: 0;
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--tg-primary);
            }

            .receive-item {
                padding: 16px 20px;
                border-bottom: 1px solid #f5f5f5;
            }

            .receive-item:last-child {
                border-bottom: none;
            }

            .receive-file-info {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 10px;
            }

            .receive-file-icon {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                color: white;
                flex-shrink: 0;
            }

            .receive-file-details {
                flex: 1;
                min-width: 0;
            }

            .receive-file-name {
                font-weight: 600;
                color: #333;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 14px;
            }

            .receive-file-size {
                font-size: 12px;
                color: #666;
                margin-top: 2px;
            }

            .receive-progress-bar {
                height: 6px;
                background: #f0f0f0;
                border-radius: 3px;
                overflow: hidden;
            }

            .receive-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4caf50 0%, #45a049 100%);
                transition: width 0.3s ease;
                border-radius: 3px;
            }

            @media (max-width: 768px) {
                .file-receive-progress {
                    left: 10px;
                    right: 10px;
                    min-width: auto;
                    max-width: none;
                    bottom: 140px;
                }
            }
        `;
        document.head.appendChild(styles);

        document.body.appendChild(progressContainer);
        this.receiveProgressContainer = progressContainer;
    }

    updateReceivingProgress(fileId, progress) {
        const itemElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (!itemElement) return;

        const progressFill = itemElement.querySelector('.receive-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
    }

    hideReceivingProgress(fileId) {
        const itemElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (itemElement) {
            setTimeout(() => {
                itemElement.remove();
                if (this.receiveProgressContainer?.querySelector('.receive-items-container').children.length === 0) {
                    this.receiveProgressContainer.classList.remove('visible');
                }
            }, 2000);
        }
    }

    createReceivedFileMessage(file) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message received';
        messageElement.setAttribute('data-file-id', file.id);
        
        if (file.category === 'images') {
            messageElement.innerHTML = this.createReceivedImageMessage(file);
        } else if (file.category === 'videos') {
            messageElement.innerHTML = this.createReceivedVideoMessage(file);
        } else {
            messageElement.innerHTML = this.createReceivedGenericFileMessage(file);
        }

        return messageElement;
    }

    createReceivedImageMessage(file) {
        const imageUrl = URL.createObjectURL(file.blob);
        return `
            <img src="${imageUrl}" alt="${file.name}" class="image-preview" 
                 onclick="this.requestFullscreen?.() || this.webkitRequestFullscreen?.()" 
                 tabindex="0" role="button" aria-label="View ${file.name} fullscreen">
            <div class="message-time">
                ${new Date(file.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                ${file.encrypted ? '<i class="fas fa-lock" title="Encrypted" aria-label="Encrypted"></i>' : ''}
            </div>
        `;
    }

    createReceivedVideoMessage(file) {
        const videoUrl = URL.createObjectURL(file.blob);
        return `
            <video src="${videoUrl}" class="video-preview" controls preload="metadata" 
                   aria-label="Video: ${file.name}">
                Your browser does not support the video tag.
            </video>
            <div class="message-time">
                ${new Date(file.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                ${file.encrypted ? '<i class="fas fa-lock" title="Encrypted" aria-label="Encrypted"></i>' : ''}
            </div>
        `;
    }

    createReceivedGenericFileMessage(file) {
        const iconClass = file.category.replace(/s$/, '');
        const fileSize = this.formatFileSize(file.size);
        const downloadUrl = URL.createObjectURL(file.blob);
        
        return `
            <div class="file-message">
                <div class="file-message-icon ${iconClass}">
                    <i class="fas fa-${this.getFileIcon(file.category)}" aria-hidden="true"></i>
                </div>
                <div class="file-message-info">
                    <div class="file-message-name">${file.name}</div>
                    <div class="file-message-size">
                        ${fileSize}
                        ${file.encrypted ? '<i class="fas fa-lock" title="Encrypted" aria-label="Encrypted"></i>' : ''}
                    </div>
                </div>
                <a href="${downloadUrl}" download="${file.name}" class="file-message-download" 
                   title="Download ${file.name}" aria-label="Download ${file.name}">
                    <i class="fas fa-download" aria-hidden="true"></i>
                </a>
            </div>
            <div class="message-time">${new Date(file.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
    }

    cancelUpload(fileId) {
        const uploadItem = this.uploadQueue.find(item => item.id === fileId);
        if (uploadItem) {
            uploadItem.status = 'cancelled';
            
            const itemElement = document.querySelector(`[data-file-id="${fileId}"]`);
            if (itemElement) {
                itemElement.remove();
                this.checkHideProgressContainer();
            }
            
            this.announceToScreenReader(`Upload cancelled: ${uploadItem.file.name}`);
        }
    }

    cancelAllUploads() {
        const cancelledCount = this.uploadQueue.filter(item => 
            item.status === 'uploading' || item.status === 'processing'
        ).length;

        this.uploadQueue.forEach(item => {
            if (item.status === 'uploading' || item.status === 'processing') {
                item.status = 'cancelled';
            }
        });

        this.progressContainer.classList.remove('visible');
        this.progressContainer.querySelector('.upload-items-container').innerHTML = '';
        
        if (cancelledCount > 0) {
            this.announceToScreenReader(`${cancelledCount} upload${cancelledCount !== 1 ? 's' : ''} cancelled`);
        }
    }

    // Utility methods
    triggerHaptic(intensity = 'light') {
        if (navigator.vibrate) {
            const patterns = {
                light: [10],
                medium: [50],
                heavy: [100]
            };
            navigator.vibrate(patterns[intensity] || patterns.light);
        }
    }

    announceToScreenReader(message) {
        const liveRegion = document.getElementById('file-upload-announcements');
        if (liveRegion) {
            liveRegion.textContent = message;
        } else {
            // Fallback method
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'visually-hidden';
            announcement.textContent = message;
            document.body.appendChild(announcement);
            
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);
        }
    }

    // Public API
    getUploadQueue() {
        return [...this.uploadQueue];
    }

    isUploading() {
        return this.uploadQueue.some(item => item.status === 'uploading' || item.status === 'processing');
    }

    getMaxFileSize() {
        return this.maxFileSize;
    }

    setMaxFileSize(size) {
        this.maxFileSize = size;
    }

    getAllowedTypes() {
        return { ...this.allowedTypes };
    }

    setCompressionSettings(settings) {
        this.compressionSettings = { ...this.compressionSettings, ...settings };
    }

    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    enableEncryption(enabled = true) {
        this.encryptionEnabled = enabled;
    }

    // Global download function for file messages
    downloadFile(fileId) {
        // This would be called from onclick handlers in file messages
        const fileMessage = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileMessage) {
            const downloadLink = fileMessage.querySelector('a[download]');
            if (downloadLink) {
                downloadLink.click();
            }
        }
    }
}

// Make download function globally available
window.downloadFile = function(fileId) {
    const fileMessage = document.querySelector(`[data-file-id="${fileId}"]`);
    if (fileMessage) {
        const downloadLink = fileMessage.querySelector('a[download]');
        if (downloadLink) {
            downloadLink.click();
        }
    }
};

// Export for use in other modules
window.FileManager = FileManager;