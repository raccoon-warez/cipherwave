/**
 * CipherWave Voice Manager
 * Comprehensive voice message recording and playback system with waveform visualization
 * Features: Recording, Waveform visualization, Playback controls, Audio compression
 */
class VoiceManager {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.recordedChunks = [];
        this.recordingStartTime = null;
        this.recordingDuration = 0;
        this.maxRecordingTime = 300000; // 5 minutes in milliseconds
        this.recordingTimer = null;
        this.waveformCanvas = null;
        this.waveformContext = null;
        this.animationFrame = null;
        this.supportedMimeTypes = ['audio/webm', 'audio/mp4', 'audio/wav'];
        this.selectedMimeType = null;
        this.audioQuality = 'medium'; // 'high', 'medium', 'low'
        this.noiseSuppressionEnabled = true;
        this.voiceMessages = new Map(); // Store voice messages with metadata
        
        // Voice message UI elements
        this.voiceButton = null;
        this.recordingIndicator = null;
        this.waveformContainer = null;
        this.voiceMessageModal = null;
        this.recordingPreview = null;
        
        // Playback states
        this.currentlyPlaying = null;
        this.currentPlayback = null;  // Maintain backward compatibility
        this.playbackSpeed = 1.0;
        this.isPlaying = false;
        
        // Permissions
        this.microphoneAccess = false;
        
        // Compression settings
        this.compressionOptions = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000 // 128 kbps
        };
        
        // Initialize the voice manager
        this.init();
    }

    /**
     * Initialize the voice manager
     */
    async init() {
        try {
            await this.setupUI();
            await this.detectSupportedFormats();
            this.setupEventListeners();
            this.checkBrowserSupport();
            console.log('🎤 VoiceManager initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize VoiceManager:', error);
            this.showError('Voice messaging is not supported in this browser');
        }
    }

    async setup() {
        console.log('🎤 Setting up voice message system...');
        
        await this.checkMicrophoneSupport();
        this.createVoiceButton();
        this.setupAudioContext();
        this.createRecordingIndicator();
        this.setupKeyboardShortcuts();
        
        console.log('✅ Voice message system ready');
    }

    /**
     * Check browser support for required APIs
     */
    checkBrowserSupport() {
        const requirements = {
            mediaRecorder: typeof MediaRecorder !== 'undefined',
            webAudio: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
            getUserMedia: navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
            canvas: typeof HTMLCanvasElement !== 'undefined'
        };

        const unsupported = Object.entries(requirements)
            .filter(([key, supported]) => !supported)
            .map(([key]) => key);

        if (unsupported.length > 0) {
            throw new Error(`Unsupported browser features: ${unsupported.join(', ')}`);
        }
    }

    /**
     * Setup voice message UI elements
     */
    async setupUI() {
        // Create voice recording button
        this.createVoiceButton();
        
        // Create waveform visualization container
        this.createWaveformContainer();
        
        // Create recording indicator
        this.createRecordingIndicator();
        
        // Create voice message modal for preview
        this.createVoiceMessageModal();
        
        // Add voice message styles
        this.injectStyles();
    }

    async checkMicrophoneSupport() {
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('⚠️ Microphone access not supported');
            return false;
        }

        // Check MediaRecorder support
        if (!window.MediaRecorder) {
            console.warn('⚠️ MediaRecorder not supported');
            return false;
        }

        // Check supported MIME types
        const supportedTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus'
        ];

        for (const type of supportedTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                this.compressionOptions.mimeType = type;
                console.log(`✅ Using audio format: ${type}`);
                break;
            }
        }

        return true;
    }

    /**
     * Detect supported audio formats
     */
    async detectSupportedFormats() {
        for (const mimeType of this.supportedMimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                this.selectedMimeType = mimeType;
                console.log(`📱 Selected audio format: ${mimeType}`);
                break;
            }
        }

        if (!this.selectedMimeType) {
            this.selectedMimeType = 'audio/webm'; // Fallback
            console.warn('⚠️ No optimal audio format detected, using fallback');
        }
    }

    /**
     * Create waveform visualization container
     */
    createWaveformContainer() {
        this.waveformContainer = document.createElement('div');
        this.waveformContainer.className = 'waveform-container hidden';
        this.waveformContainer.innerHTML = `
            <canvas class="waveform-canvas" width="300" height="80"></canvas>
            <div class="recording-controls">
                <button class="recording-control-btn stop-btn" title="Stop recording">
                    <i class="fas fa-stop"></i>
                </button>
                <div class="recording-duration">00:00</div>
                <button class="recording-control-btn cancel-btn" title="Cancel recording">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Insert after input area
        const inputArea = document.querySelector('.input-area');
        if (inputArea && inputArea.parentNode) {
            inputArea.parentNode.insertBefore(this.waveformContainer, inputArea);
        }

        this.waveformCanvas = this.waveformContainer.querySelector('.waveform-canvas');
        this.waveformContext = this.waveformCanvas.getContext('2d');
    }

    /**
     * Create voice message modal for preview
     */
    createVoiceMessageModal() {
        this.voiceMessageModal = document.createElement('div');
        this.voiceMessageModal.className = 'voice-message-modal hidden';
        this.voiceMessageModal.innerHTML = `
            <div class="voice-modal-content">
                <div class="voice-modal-header">
                    <h3>Voice Message Preview</h3>
                    <button class="voice-modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="voice-modal-body">
                    <div class="voice-preview-waveform">
                        <canvas class="preview-waveform-canvas" width="400" height="100"></canvas>
                    </div>
                    <div class="voice-preview-controls">
                        <button class="voice-preview-btn play-btn">
                            <i class="fas fa-play"></i>
                        </button>
                        <div class="voice-preview-progress">
                            <div class="progress-bar">
                                <div class="progress-fill"></div>
                            </div>
                            <div class="voice-preview-time">
                                <span class="current-time">00:00</span>
                                <span class="total-time">00:00</span>
                            </div>
                        </div>
                        <div class="voice-preview-speed">
                            <button class="speed-btn" data-speed="1">1x</button>
                            <button class="speed-btn" data-speed="1.5">1.5x</button>
                            <button class="speed-btn active" data-speed="2">2x</button>
                        </div>
                    </div>
                    <div class="voice-modal-actions">
                        <button class="voice-modal-btn secondary-btn retry-btn">
                            <i class="fas fa-redo"></i> Re-record
                        </button>
                        <button class="voice-modal-btn primary-btn send-voice-btn">
                            <i class="fas fa-paper-plane"></i> Send
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.voiceMessageModal);
    }

    createVoiceButton() {
        const inputArea = document.querySelector('.input-area');
        if (!inputArea) return;

        // Create voice button
        this.voiceButton = document.createElement('button');
        this.voiceButton.className = 'voice-btn';
        this.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        this.voiceButton.title = 'Record voice message';
        this.voiceButton.setAttribute('aria-label', 'Record voice message');

        // Insert voice button before send button
        const sendBtn = inputArea.querySelector('.send-btn');
        if (sendBtn) {
            inputArea.insertBefore(this.voiceButton, sendBtn);
        }
    }

    /**
     * Inject voice message CSS styles
     */
    injectStyles() {
        const styles = `
            /* Voice Recording Button */
            .voice-btn {
                background: none;
                border: none;
                color: var(--tg-text-secondary, #757575);
                font-size: 1.3rem;
                cursor: pointer;
                min-width: 40px;
                min-height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 8px;
                transition: all 0.2s ease;
                position: relative;
                touch-action: manipulation;
            }

            .voice-btn:hover {
                background: rgba(0, 0, 0, 0.05);
                color: var(--tg-primary, #5682a3);
            }

            .voice-btn:active {
                transform: scale(0.95);
                background: rgba(0, 0, 0, 0.1);
            }

            .voice-btn.recording {
                background: #ff4757;
                color: white;
                animation: recordingPulse 1.5s infinite;
            }

            @keyframes recordingPulse {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.7); }
                50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
            }

            /* Waveform Container */
            .waveform-container {
                background: white;
                border-top: 1px solid var(--tg-border, #e0e0e0);
                padding: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                transition: all 0.3s ease;
            }

            .waveform-container.hidden {
                display: none;
            }

            .waveform-canvas {
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.05);
                flex: 1;
                max-width: 300px;
            }

            .recording-controls {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .recording-control-btn {
                background: none;
                border: none;
                color: var(--tg-text-secondary);
                font-size: 1.2rem;
                cursor: pointer;
                min-width: 36px;
                min-height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }

            .recording-control-btn:hover {
                background: rgba(0, 0, 0, 0.05);
            }

            .recording-control-btn.stop-btn {
                background: var(--tg-primary, #5682a3);
                color: white;
            }

            .recording-control-btn.cancel-btn {
                color: #ff4757;
            }

            .recording-duration {
                font-family: monospace;
                font-weight: 600;
                color: var(--tg-text-primary);
                min-width: 40px;
                text-align: center;
            }

            /* Recording Indicator */
            .recording-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(255, 71, 87, 0.1);
                color: #ff4757;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.9rem;
                font-weight: 500;
            }

            .recording-indicator.hidden {
                display: none;
            }

            .recording-pulse {
                width: 8px;
                height: 8px;
                background: #ff4757;
                border-radius: 50%;
                animation: pulse 1s infinite;
            }

            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.2); }
                100% { opacity: 1; transform: scale(1); }
            }

            /* Voice Message Modal */
            .voice-message-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 3000;
                backdrop-filter: blur(4px);
            }

            .voice-message-modal.hidden {
                display: none;
            }

            .voice-modal-content {
                background: white;
                border-radius: 16px;
                width: 90%;
                max-width: 500px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                animation: modalSlideIn 0.3s ease-out;
            }

            @keyframes modalSlideIn {
                from { transform: translateY(20px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }

            .voice-modal-header {
                padding: 20px;
                border-bottom: 1px solid var(--tg-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .voice-modal-header h3 {
                margin: 0;
                font-size: 1.2rem;
                font-weight: 600;
            }

            .voice-modal-close {
                background: none;
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .voice-modal-body {
                padding: 20px;
            }

            .voice-preview-waveform {
                margin-bottom: 20px;
                text-align: center;
            }

            .preview-waveform-canvas {
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.05);
                width: 100%;
                max-width: 400px;
            }

            .voice-preview-controls {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 24px;
            }

            .voice-preview-btn {
                background: var(--tg-primary);
                color: white;
                border: none;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 1.2rem;
                transition: all 0.2s ease;
            }

            .voice-preview-btn:hover {
                transform: scale(1.05);
            }

            .voice-preview-progress {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .progress-bar {
                height: 4px;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 2px;
                overflow: hidden;
                cursor: pointer;
            }

            .progress-fill {
                height: 100%;
                background: var(--tg-primary);
                border-radius: 2px;
                width: 0%;
                transition: width 0.1s ease;
            }

            .voice-preview-time {
                display: flex;
                justify-content: space-between;
                font-size: 0.8rem;
                color: var(--tg-text-secondary);
                font-family: monospace;
            }

            .voice-preview-speed {
                display: flex;
                gap: 4px;
            }

            .speed-btn {
                background: rgba(0, 0, 0, 0.05);
                border: none;
                padding: 6px 10px;
                border-radius: 16px;
                font-size: 0.8rem;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .speed-btn.active {
                background: var(--tg-primary);
                color: white;
            }

            .voice-modal-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .voice-modal-btn {
                padding: 12px 20px;
                border-radius: 8px;
                border: none;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s ease;
            }

            .voice-modal-btn.secondary-btn {
                background: rgba(0, 0, 0, 0.05);
                color: var(--tg-text-primary);
            }

            .voice-modal-btn.primary-btn {
                background: var(--tg-primary);
                color: white;
            }

            .voice-modal-btn:hover {
                transform: translateY(-1px);
            }

            /* Voice Message Bubble */
            .voice-message-bubble {
                background: var(--tg-message-sent);
                border-radius: 18px;
                padding: 12px 16px;
                margin-bottom: 12px;
                max-width: 300px;
                align-self: flex-end;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .voice-message-bubble.received {
                background: var(--tg-message-received);
                align-self: flex-start;
            }

            .voice-message-play-btn {
                background: var(--tg-primary);
                color: white;
                border: none;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 0.9rem;
                flex-shrink: 0;
                transition: all 0.2s ease;
            }

            .voice-message-play-btn:hover {
                transform: scale(1.05);
            }

            .voice-message-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
                flex: 1;
                min-width: 0;
            }

            .voice-message-waveform {
                height: 20px;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 10px;
                position: relative;
                overflow: hidden;
                cursor: pointer;
            }

            .voice-message-progress {
                height: 100%;
                background: var(--tg-primary);
                border-radius: 10px;
                width: 0%;
                transition: width 0.1s ease;
            }

            .voice-message-duration {
                font-size: 0.8rem;
                color: var(--tg-text-secondary);
                font-family: monospace;
            }

            /* Mobile Responsiveness */
            @media (max-width: 768px) {
                .voice-modal-content {
                    width: 95%;
                    margin: 20px;
                }

                .voice-preview-controls {
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .voice-preview-speed {
                    order: 3;
                    width: 100%;
                    justify-content: center;
                }

                .waveform-container {
                    flex-direction: column;
                    gap: 12px;
                }

                .waveform-canvas {
                    max-width: 100%;
                }

                .voice-message-bubble {
                    max-width: 85%;
                }
            }

            /* Accessibility */
            @media (prefers-reduced-motion: reduce) {
                .voice-btn.recording,
                .recording-pulse,
                .voice-modal-content {
                    animation: none;
                }
            }

            /* High contrast mode */
            @media (prefers-contrast: high) {
                .waveform-canvas,
                .preview-waveform-canvas {
                    border: 2px solid;
                }

                .voice-btn {
                    border: 2px solid;
                }
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    /**
     * Setup comprehensive event listeners
     */
    setupEventListeners() {
        // Voice button events
        if (this.voiceButton) {
            // Support both click and long press
            this.voiceButton.addEventListener('mousedown', this.handleVoiceButtonDown.bind(this));
            this.voiceButton.addEventListener('mouseup', this.handleVoiceButtonUp.bind(this));
            this.voiceButton.addEventListener('mouseleave', this.handleVoiceButtonUp.bind(this));
            
            // Touch events for mobile
            this.voiceButton.addEventListener('touchstart', this.handleVoiceButtonDown.bind(this), { passive: false });
            this.voiceButton.addEventListener('touchend', this.handleVoiceButtonUp.bind(this));
            this.voiceButton.addEventListener('touchcancel', this.handleVoiceButtonUp.bind(this));
            
            // Click for tap-to-record mode
            this.voiceButton.addEventListener('click', this.handleVoiceButtonClick.bind(this));
        }

        // Recording control events
        const stopBtn = this.waveformContainer?.querySelector('.stop-btn');
        const cancelBtn = this.waveformContainer?.querySelector('.cancel-btn');
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopRecording());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelRecording());
        }

        // Modal events
        const modalClose = this.voiceMessageModal?.querySelector('.voice-modal-close');
        const retryBtn = this.voiceMessageModal?.querySelector('.retry-btn');
        const sendVoiceBtn = this.voiceMessageModal?.querySelector('.send-voice-btn');
        
        if (modalClose) {
            modalClose.addEventListener('click', () => this.closeVoiceModal());
        }
        
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryRecording());
        }
        
        if (sendVoiceBtn) {
            sendVoiceBtn.addEventListener('click', () => this.sendVoiceMessage());
        }

        // Preview controls
        const playBtn = this.voiceMessageModal?.querySelector('.play-btn');
        const speedBtns = this.voiceMessageModal?.querySelectorAll('.speed-btn');
        const progressBar = this.voiceMessageModal?.querySelector('.progress-bar');
        
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePreviewPlayback());
        }
        
        speedBtns?.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = parseFloat(e.target.dataset.speed);
                this.setPlaybackSpeed(speed);
            });
        });
        
        if (progressBar) {
            progressBar.addEventListener('click', (e) => this.seekPreview(e));
        }

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Space bar to toggle recording when focused on voice button
            if (e.code === 'Space' && document.activeElement === this.voiceButton) {
                e.preventDefault();
                this.toggleRecording();
            }
            
            // Escape to close modal
            if (e.key === 'Escape' && !this.voiceMessageModal?.classList.contains('hidden')) {
                this.closeVoiceModal();
            }
        });

        // Visibility change to handle background recording
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRecording) {
                this.showWarning('Recording paused due to app being in background');
            }
        });
    }

    setupVoiceButtonEvents() {
        // Backward compatibility method - calls setupEventListeners
        this.setupEventListeners();
    }

    setupKeyboardShortcuts() {
        // Space bar to record (when message input is focused)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.closest('.message-input') && !this.isRecording) {
                e.preventDefault();
                this.startRecording(true);
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && this.isRecording) {
                this.stopRecording(true);
            }
        });
    }

    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphoneAccess = true;
            this.hidePermissionPrompt();
            
            // Test the stream briefly then stop it
            stream.getTracks().forEach(track => track.stop());
            
            this.announceToScreenReader('Microphone access granted');
            return true;
        } catch (error) {
            console.error('❌ Microphone permission denied:', error);
            this.showPermissionPrompt(error);
            return false;
        }
    }

    showPermissionPrompt(error) {
        const prompt = document.createElement('div');
        prompt.className = 'voice-permission-prompt';
        prompt.innerHTML = `
            <div class="permission-icon">
                <i class="fas fa-microphone-slash"></i>
            </div>
            <div class="permission-title">Microphone Access Needed</div>
            <div class="permission-text">
                To send voice messages, CipherWave needs access to your microphone. 
                Your voice data is encrypted and never stored on our servers.
            </div>
            <div class="permission-actions">
                <button class="btn-secondary cancel-permission">Cancel</button>
                <button class="btn-primary grant-permission">Allow Microphone</button>
            </div>
        `;

        document.body.appendChild(prompt);

        // Setup event listeners
        prompt.querySelector('.cancel-permission').addEventListener('click', () => {
            this.hidePermissionPrompt();
        });

        prompt.querySelector('.grant-permission').addEventListener('click', () => {
            this.requestMicrophonePermission();
        });
    }

    hidePermissionPrompt() {
        const prompt = document.querySelector('.voice-permission-prompt');
        if (prompt) {
            prompt.remove();
        }
    }

    async startRecording(continuousMode = false) {
        if (this.isRecording) return;

        // Check microphone permission
        if (!this.microphoneAccess) {
            const granted = await this.requestMicrophonePermission();
            if (!granted) return;
        }

        try {
            // Get audio stream
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            // Setup MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.audioStream, this.compressionOptions);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };

            // Start recording
            this.mediaRecorder.start(100); // Collect data every 100ms for waveform
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Update UI
            this.voiceButton.classList.add('recording');
            this.voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
            this.showRecordingIndicator();

            // Setup audio analysis for waveform
            this.setupAudioAnalysis();

            // Auto-stop after max time
            setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, this.maxRecordingTime);

            this.announceToScreenReader('Recording started');
            this.triggerHaptic('light');

        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.showPermissionPrompt(error);
        }
    }

    stopRecording(autoSend = false) {
        if (!this.isRecording) return;

        this.recordingDuration = Date.now() - this.recordingStartTime;

        // Check minimum recording time
        if (this.recordingDuration < this.minRecordingTime) {
            this.cancelRecording();
            this.announceToScreenReader('Recording too short');
            return;
        }

        // Stop recording
        this.mediaRecorder.stop();
        this.isRecording = false;

        // Stop audio stream
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }

        // Update UI
        this.voiceButton.classList.remove('recording');
        this.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';

        if (autoSend) {
            this.hideRecordingIndicator();
        } else {
            this.showRecordingPreview();
        }

        this.announceToScreenReader('Recording stopped');
        this.triggerHaptic('medium');
    }

    cancelRecording() {
        if (!this.isRecording) return;

        // Stop recording without processing
        this.mediaRecorder = null;
        this.isRecording = false;
        this.audioChunks = [];

        // Stop audio stream
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }

        // Update UI
        this.voiceButton.classList.remove('recording');
        this.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        this.hideRecordingIndicator();

        this.announceToScreenReader('Recording cancelled');
    }

    setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('⚠️ Web Audio API not supported');
        }
    }

    setupAudioAnalysis() {
        if (!this.audioContext || !this.audioStream) return;

        try {
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyser = this.audioContext.createAnalyser();
            
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            
            source.connect(this.analyser);
            
            // Start waveform visualization
            this.startWaveformVisualization();
        } catch (error) {
            console.warn('⚠️ Audio analysis setup failed:', error);
        }
    }

    createRecordingIndicator() {
        this.recordingIndicator = document.createElement('div');
        this.recordingIndicator.className = 'recording-indicator';
        this.recordingIndicator.innerHTML = `
            <div class="recording-timer">00:00</div>
            <canvas class="recording-waveform" width="260" height="60"></canvas>
            <div class="recording-controls">
                <button class="recording-control-btn cancel" title="Cancel recording">
                    <i class="fas fa-times"></i>
                </button>
                <button class="recording-control-btn stop" title="Stop recording">
                    <i class="fas fa-stop"></i>
                </button>
                <button class="recording-control-btn send hidden" title="Send voice message">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;

        document.body.appendChild(this.recordingIndicator);

        // Setup event listeners
        this.setupRecordingIndicatorEvents();
    }

    setupRecordingIndicatorEvents() {
        const cancelBtn = this.recordingIndicator.querySelector('.cancel');
        const stopBtn = this.recordingIndicator.querySelector('.stop');
        const sendBtn = this.recordingIndicator.querySelector('.send');

        cancelBtn.addEventListener('click', () => {
            this.cancelRecording();
        });

        stopBtn.addEventListener('click', () => {
            this.stopRecording();
        });

        sendBtn.addEventListener('click', () => {
            this.sendVoiceMessage();
        });
    }

    showRecordingIndicator() {
        this.recordingIndicator.classList.add('visible');
        this.waveformCanvas = this.recordingIndicator.querySelector('.recording-waveform');
        
        // Start timer
        this.startRecordingTimer();
    }

    hideRecordingIndicator() {
        this.recordingIndicator.classList.remove('visible');
        this.stopRecordingTimer();
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timerElement = this.recordingIndicator.querySelector('.recording-timer');
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 100);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    startWaveformVisualization() {
        if (!this.analyser || !this.waveformCanvas) return;

        const canvas = this.waveformCanvas;
        const ctx = canvas.getContext('2d');
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!this.isRecording) return;

            requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(dataArray);

            // Clear canvas
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw waveform
            const barWidth = canvas.width / bufferLength * 2;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
                
                const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                gradient.addColorStop(0, '#4CAF50');
                gradient.addColorStop(1, '#8BC34A');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    }

    showRecordingPreview() {
        // Show preview with send/cancel options
        const stopBtn = this.recordingIndicator.querySelector('.stop');
        const sendBtn = this.recordingIndicator.querySelector('.send');
        
        stopBtn.classList.add('hidden');
        sendBtn.classList.remove('hidden');
        
        // Update timer to show final duration
        const duration = Math.floor(this.recordingDuration / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        const timerElement = this.recordingIndicator.querySelector('.recording-timer');
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async processRecording() {
        if (this.audioChunks.length === 0) return;

        try {
            // Create blob from audio chunks
            const audioBlob = new Blob(this.audioChunks, { type: this.compressionOptions.mimeType });
            
            // Compress if needed
            const compressedBlob = await this.compressAudio(audioBlob);
            
            // Generate waveform data for playback visualization
            const waveformData = await this.generateWaveformData(compressedBlob);
            
            // Store the processed audio
            this.currentRecording = {
                blob: compressedBlob,
                duration: this.recordingDuration,
                waveform: waveformData,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('❌ Failed to process recording:', error);
            this.cancelRecording();
        }
    }

    async compressAudio(audioBlob) {
        // For now, return the original blob
        // In a production app, you might want to implement additional compression
        return audioBlob;
    }

    async generateWaveformData(audioBlob) {
        if (!this.audioContext) return null;

        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            const channelData = audioBuffer.getChannelData(0);
            const samples = 100; // Number of waveform bars
            const blockSize = Math.floor(channelData.length / samples);
            const waveformData = [];

            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += Math.abs(channelData[i * blockSize + j]);
                }
                waveformData.push(sum / blockSize);
            }

            return waveformData;
        } catch (error) {
            console.warn('⚠️ Waveform generation failed:', error);
            return null;
        }
    }

    async sendVoiceMessage() {
        if (!this.currentRecording) {
            this.hideRecordingIndicator();
            return;
        }

        try {
            // Create voice message element
            const voiceMessageElement = this.createVoiceMessageElement(this.currentRecording);
            
            // Add to messages container
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                messagesContainer.appendChild(voiceMessageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            // Send via WebRTC data channel (if available)
            await this.sendVoiceData(this.currentRecording);

            // Clean up
            this.currentRecording = null;
            this.hideRecordingIndicator();
            
            this.announceToScreenReader('Voice message sent');
            this.triggerHaptic('light');

        } catch (error) {
            console.error('❌ Failed to send voice message:', error);
            this.announceToScreenReader('Failed to send voice message');
        }
    }

    createVoiceMessageElement(recording) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message sent voice-message';
        
        const duration = Math.floor(recording.duration / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        messageElement.innerHTML = `
            <button class="voice-play-btn" data-audio-src="${URL.createObjectURL(recording.blob)}">
                <i class="fas fa-play"></i>
            </button>
            <div class="voice-waveform" data-waveform='${JSON.stringify(recording.waveform || [])}'>
                <div class="voice-progress"></div>
            </div>
            <div class="voice-duration">${durationText}</div>
            <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;

        // Setup playback functionality
        this.setupVoiceMessagePlayback(messageElement);

        return messageElement;
    }

    setupVoiceMessagePlayback(messageElement) {
        const playBtn = messageElement.querySelector('.voice-play-btn');
        const waveform = messageElement.querySelector('.voice-waveform');
        const progress = messageElement.querySelector('.voice-progress');
        
        let audio = null;
        let isPlaying = false;

        playBtn.addEventListener('click', async () => {
            if (isPlaying) {
                // Pause
                if (audio) {
                    audio.pause();
                }
            } else {
                // Play
                if (!audio) {
                    audio = new Audio(playBtn.dataset.audioSrc);
                    
                    audio.addEventListener('loadedmetadata', () => {
                        this.drawWaveform(waveform, JSON.parse(waveform.dataset.waveform));
                    });

                    audio.addEventListener('timeupdate', () => {
                        const progressPercent = (audio.currentTime / audio.duration) * 100;
                        progress.style.width = `${progressPercent}%`;
                    });

                    audio.addEventListener('ended', () => {
                        isPlaying = false;
                        playBtn.innerHTML = '<i class="fas fa-play"></i>';
                        playBtn.classList.remove('playing');
                        progress.style.width = '0%';
                    });
                }

                await audio.play();
            }

            isPlaying = !isPlaying;
            playBtn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
            playBtn.classList.toggle('playing', isPlaying);
        });

        // Seek functionality
        waveform.addEventListener('click', (e) => {
            if (audio) {
                const rect = waveform.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const progressPercent = clickX / rect.width;
                audio.currentTime = audio.duration * progressPercent;
            }
        });
    }

    drawWaveform(canvas, waveformData) {
        if (!waveformData || waveformData.length === 0) return;

        const ctx = canvas.getContext('2d');
        const { width, height } = canvas.getBoundingClientRect();
        
        canvas.width = width;
        canvas.height = height;

        const barWidth = width / waveformData.length;
        const maxHeight = height * 0.8;

        ctx.clearRect(0, 0, width, height);

        waveformData.forEach((value, index) => {
            const barHeight = value * maxHeight;
            const x = index * barWidth;
            const y = (height - barHeight) / 2;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(x, y, barWidth - 1, barHeight);
        });
    }

    async sendVoiceData(recording) {
        // Convert blob to base64 for transmission
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onload = () => {
                const voiceData = {
                    type: 'voice-message',
                    data: reader.result,
                    duration: recording.duration,
                    waveform: recording.waveform,
                    timestamp: recording.timestamp,
                    mimeType: this.compressionOptions.mimeType
                };

                // Send via existing message system
                if (window.dataChannel && window.dataChannel.readyState === 'open') {
                    window.dataChannel.send(JSON.stringify(voiceData));
                    resolve();
                } else {
                    console.warn('⚠️ Data channel not available for voice message');
                    resolve(); // Still resolve to show message locally
                }
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(recording.blob);
        });
    }

    handleIncomingVoiceMessage(data) {
        try {
            // Convert base64 back to blob
            const binaryString = atob(data.data.split(',')[1]);
            const bytes = new Uint8Array(binaryString.length);
            
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const blob = new Blob([bytes], { type: data.mimeType });
            
            const recording = {
                blob: blob,
                duration: data.duration,
                waveform: data.waveform,
                timestamp: data.timestamp
            };

            // Create received voice message element
            const messageElement = this.createReceivedVoiceMessageElement(recording);
            
            // Add to messages container
            const messagesContainer = document.querySelector('.messages-container');
            if (messagesContainer) {
                messagesContainer.appendChild(messageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            this.announceToScreenReader('Voice message received');
            
        } catch (error) {
            console.error('❌ Failed to process incoming voice message:', error);
        }
    }

    createReceivedVoiceMessageElement(recording) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message received voice-message';
        
        const duration = Math.floor(recording.duration / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        messageElement.innerHTML = `
            <button class="voice-play-btn" data-audio-src="${URL.createObjectURL(recording.blob)}">
                <i class="fas fa-play"></i>
            </button>
            <div class="voice-waveform" data-waveform='${JSON.stringify(recording.waveform || [])}'>
                <div class="voice-progress"></div>
            </div>
            <div class="voice-duration">${durationText}</div>
            <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;

        // Setup playback functionality
        this.setupVoiceMessagePlayback(messageElement);

        return messageElement;
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
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'visually-hidden';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // Public API
    isRecordingActive() {
        return this.isRecording;
    }

    hasMicrophoneAccess() {
        return this.microphoneAccess;
    }

    getRecordingDuration() {
        return this.recordingDuration;
    }

    /**
     * Handle voice button mouse/touch down
     */
    handleVoiceButtonDown(e) {
        e.preventDefault();
        if (!this.isRecording) {
            this.pressTimer = setTimeout(() => {
                this.startRecording();
            }, 500); // Long press threshold
        }
    }

    /**
     * Handle voice button mouse/touch up
     */
    handleVoiceButtonUp(e) {
        e.preventDefault();
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
            this.pressTimer = null;
        }
        
        if (this.isRecording) {
            this.stopRecording();
        }
    }

    /**
     * Handle voice button click (tap-to-record mode)
     */
    handleVoiceButtonClick(e) {
        e.preventDefault();
        // Only handle click if it wasn't a long press
        if (!this.isRecording && !this.pressTimer) {
            this.toggleRecording();
        }
    }

    /**
     * Toggle recording state
     */
    async toggleRecording() {
        if (this.isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    /**
     * Enhanced voice message integration with WebRTC
     */
    handleIncomingVoiceMessage(data) {
        try {
            // Decrypt voice message
            let voiceMessage;
            if (typeof decryptMessage === 'function' && window.currentCipher) {
                const decryptedData = decryptMessage(data.content, window.currentCipher);
                voiceMessage = JSON.parse(decryptedData);
            } else {
                voiceMessage = JSON.parse(data.content);
            }
            
            // Store voice message
            this.voiceMessages.set(voiceMessage.id, voiceMessage);
            
            // Display in chat
            this.displayVoiceMessage(voiceMessage, 'received');
            
            // Show notification
            this.showInfo('Voice message received');
            
            // Add haptic feedback
            this.vibrate(100);
            
        } catch (error) {
            console.error('❌ Failed to handle incoming voice message:', error);
        }
    }

    /**
     * Utility functions for enhanced functionality
     */
    vibrate(duration) {
        if (navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `voice-notification voice-notification-${type}`;
        notification.textContent = message;
        
        // Style notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ff4757' : type === 'warning' ? '#ffa502' : type === 'success' ? '#2ed573' : '#5682a3'};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 4000;
            font-size: 0.9rem;
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Voice message display methods
     */
    displayVoiceMessage(voiceMessage, type) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.setAttribute('data-message-id', voiceMessage.id);
        messageElement.setAttribute('data-message-type', 'voice');
        
        const duration = Math.floor(voiceMessage.duration / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        messageElement.innerHTML = `
            <div class="voice-message-bubble ${type}">
                <button class="voice-message-play-btn" data-message-id="${voiceMessage.id}">
                    <i class="fas fa-play"></i>
                </button>
                <div class="voice-message-info">
                    <div class="voice-message-waveform">
                        <div class="voice-message-progress"></div>
                    </div>
                    <div class="voice-message-duration">${durationText}</div>
                </div>
            </div>
            <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        
        // Add event listener for playback
        const playBtn = messageElement.querySelector('.voice-message-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.playVoiceMessage(voiceMessage.id));
        }
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Animate message appearance
        requestAnimationFrame(() => {
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateY(20px)';
            messageElement.style.transition = 'all 0.3s ease';
            
            requestAnimationFrame(() => {
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0)';
            });
        });
    }

    /**
     * Public API methods for configuration and status
     */
    setAudioQuality(quality) {
        if (['high', 'medium', 'low'].includes(quality)) {
            this.audioQuality = quality;
            console.log(`🔊 Audio quality set to: ${quality}`);
        }
    }

    toggleNoiseSuppression(enabled) {
        this.noiseSuppressionEnabled = enabled;
        console.log(`🔇 Noise suppression: ${enabled ? 'enabled' : 'disabled'}`);
    }

    setMaxRecordingTime(milliseconds) {
        this.maxRecordingTime = Math.max(1000, Math.min(600000, milliseconds));
        console.log(`⏱️ Max recording time set to: ${this.maxRecordingTime / 1000}s`);
    }

    getRecordingStats() {
        return {
            isRecording: this.isRecording,
            duration: this.recordingDuration,
            quality: this.audioQuality,
            mimeType: this.selectedMimeType,
            noiseSuppressionEnabled: this.noiseSuppressionEnabled,
            maxRecordingTime: this.maxRecordingTime,
            voiceMessagesCount: this.voiceMessages.size
        };
    }

    /**
     * Enhanced recording methods that integrate with the existing system
     */
    async startRecording(continuousMode = false) {
        // Use existing method but enhance it
        if (this.isRecording) return;

        // Check microphone permission
        if (!this.microphoneAccess) {
            const granted = await this.requestMicrophonePermission();
            if (!granted) return;
        }

        try {
            // Get audio stream with enhanced settings
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: this.noiseSuppressionEnabled,
                    autoGainControl: true,
                    sampleRate: this.getAudioSampleRate(),
                    channelCount: 1
                }
            });

            // Setup MediaRecorder with selected format
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: this.selectedMimeType || this.compressionOptions.mimeType,
                audioBitsPerSecond: this.getAudioBitrate()
            });
            
            this.audioChunks = [];
            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
                this.onRecordingComplete();
            };

            // Start recording
            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Update UI
            this.updateRecordingUI(true);
            
            // Setup audio analysis for waveform
            this.setupAudioAnalysis();
            this.startWaveformVisualization();
            this.startRecordingTimer();

            // Auto-stop after max time
            setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, this.maxRecordingTime);

            this.announceToScreenReader('Recording started');
            this.triggerHaptic('light');

        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.showPermissionPrompt(error);
        }
    }

    /**
     * Utility methods for audio processing
     */
    getAudioSampleRate() {
        const rates = {
            'high': 48000,
            'medium': 24000,
            'low': 16000
        };
        return rates[this.audioQuality] || rates.medium;
    }

    getAudioBitrate() {
        const bitrates = {
            'high': 128000,
            'medium': 64000,
            'low': 32000
        };
        return bitrates[this.audioQuality] || bitrates.medium;
    }

    updateRecordingUI(recording) {
        if (recording) {
            this.voiceButton?.classList.add('recording');
            this.waveformContainer?.classList.remove('hidden');
            this.recordingIndicator?.classList.remove('hidden');
        } else {
            this.voiceButton?.classList.remove('recording');
            this.waveformContainer?.classList.add('hidden');
            this.recordingIndicator?.classList.add('hidden');
        }
    }

    /**
     * Enhanced UI methods
     */
    createRecordingIndicator() {
        // Create recording indicator in chat header
        this.recordingIndicator = document.createElement('div');
        this.recordingIndicator.className = 'recording-indicator hidden';
        this.recordingIndicator.innerHTML = `
            <div class="recording-pulse"></div>
            <span class="recording-text">Recording...</span>
        `;

        // Add to chat header
        const chatHeader = document.querySelector('.chat-header');
        if (chatHeader) {
            chatHeader.appendChild(this.recordingIndicator);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Stop microphone
        if (this.microphone) {
            this.microphone.getTracks().forEach(track => track.stop());
            this.microphone = null;
        }
        
        // Stop audio stream
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close().catch(console.error);
            this.audioContext = null;
        }
        
        // Clear analyser
        this.analyser = null;
        
        // Clear animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Clear timer
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        // Clear press timer
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
            this.pressTimer = null;
        }
        
        // Reset state
        this.recordingStartTime = null;
        this.recordingDuration = 0;
        this.recordedChunks = [];
        this.audioChunks = [];
    }

    /**
     * Destroy voice manager and clean up all resources
     */
    destroy() {
        console.log('🗑️ Destroying VoiceManager...');
        
        // Stop any ongoing recording
        if (this.isRecording) {
            this.cancelRecording();
        }
        
        // Stop any playing audio
        if (this.currentlyPlaying) {
            this.currentlyPlaying.pause();
            this.currentlyPlaying = null;
        }
        
        // Clean up resources
        this.cleanup();
        
        // Remove UI elements
        this.voiceButton?.remove();
        this.waveformContainer?.remove();
        this.recordingIndicator?.remove();
        this.voiceMessageModal?.remove();
        
        // Clear voice messages
        this.voiceMessages?.clear();
        
        console.log('✅ VoiceManager destroyed');
    }
}

// Maintain backward compatibility
class VoiceMessageManager extends VoiceManager {
    constructor() {
        super();
        console.log('🔄 VoiceMessageManager compatibility layer loaded');
    }
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    window.VoiceManager = VoiceManager;
    window.VoiceMessageManager = VoiceMessageManager; // Backward compatibility
    
    // Initialize voice manager when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.voiceManager = new VoiceManager();
        });
    } else {
        window.voiceManager = new VoiceManager();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceManager;
}