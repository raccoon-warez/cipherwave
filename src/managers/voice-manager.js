// CipherWave Voice Manager - Dynamically loaded for voice message features
// Only loaded when voice messaging is needed to reduce initial bundle size

export class VoiceManager {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.recordedChunks = [];
        this.recordingStartTime = null;
        this.recordingDuration = 0;
        this.maxRecordingTime = 300000; // 5 minutes
        this.recordingTimer = null;
        this.waveformCanvas = null;
        this.waveformContext = null;
        this.animationFrame = null;
        this.supportedMimeTypes = ['audio/webm', 'audio/mp4', 'audio/wav'];
        this.selectedMimeType = null;
        this.voiceMessages = new Map();
        
        // Voice message UI elements
        this.voiceButton = null;
        this.recordingIndicator = null;
        this.waveformContainer = null;
        
        // Playback states
        this.currentlyPlaying = null;
        this.isPlaying = false;
        
        // Permissions
        this.microphoneAccess = false;
        
        // Compression settings
        this.compressionOptions = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000 // 128 kbps
        };
        
        console.log('🎤 Voice manager loaded');
    }
    
    async init() {
        console.log('🎤 Initializing voice messaging system...');
        
        try {
            await this.requestMicrophoneAccess();
            this.detectSupportedMimeType();
            this.createVoiceUI();
            
            console.log('✅ Voice manager initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize voice manager:', error);
            throw error;
        }
    }
    
    async requestMicrophoneAccess() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            this.microphoneAccess = true;
            
            // Stop the stream for now, we'll request it again when recording
            stream.getTracks().forEach(track => track.stop());
            
            console.log('🎤 Microphone access granted');
            
        } catch (error) {
            console.error('Microphone access denied:', error);
            throw new Error('Microphone access is required for voice messages');
        }
    }
    
    detectSupportedMimeType() {
        for (const mimeType of this.supportedMimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                this.selectedMimeType = mimeType;
                console.log(`🎤 Using audio format: ${mimeType}`);
                break;
            }
        }
        
        if (!this.selectedMimeType) {
            throw new Error('No supported audio format found');
        }
    }
    
    createVoiceUI() {
        const chatPanel = document.getElementById('chat-panel');
        if (!chatPanel || document.getElementById('voiceBtn')) {
            return;
        }
        
        const messageInputGroup = chatPanel.querySelector('.message-input-group');
        if (!messageInputGroup) {
            return;
        }
        
        // Create voice button
        this.voiceButton = document.createElement('button');
        this.voiceButton.id = 'voiceBtn';
        this.voiceButton.className = 'btn btn-secondary voice-btn';
        this.voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        this.voiceButton.title = 'Record voice message';
        
        // Add event listeners
        this.voiceButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        
        this.voiceButton.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.stopRecording();
        });
        
        this.voiceButton.addEventListener('mouseleave', (e) => {
            if (this.isRecording) {
                this.stopRecording();
            }
        });
        
        // Touch events for mobile
        this.voiceButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        
        this.voiceButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });
        
        messageInputGroup.insertBefore(this.voiceButton, messageInputGroup.lastElementChild);
        
        // Add voice UI styles
        this.addVoiceStyles();
    }
    
    addVoiceStyles() {
        if (document.getElementById('voiceManagerStyles')) {
            return;
        }
        
        const styles = document.createElement('style');
        styles.id = 'voiceManagerStyles';
        styles.textContent = `
            .voice-btn {
                position: relative;
                transition: all 0.3s ease;
            }
            
            .voice-btn.recording {
                background: #ff4757 !important;
                animation: pulse 1s infinite;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
            
            .voice-recording-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                flex-direction: column;
            }
            
            .voice-recording-content {
                background: #1a1f29;
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                border: 2px solid #ff4757;
            }
            
            .voice-recording-icon {
                font-size: 4rem;
                color: #ff4757;
                margin-bottom: 20px;
                animation: pulse 1s infinite;
            }
            
            .voice-recording-time {
                font-size: 2rem;
                color: #ffffff;
                margin-bottom: 10px;
                font-family: monospace;
            }
            
            .voice-recording-instruction {
                color: #8899a6;
                font-size: 1.1rem;
            }
            
            .voice-waveform {
                width: 300px;
                height: 60px;
                margin: 20px auto;
                background: #2a3441;
                border-radius: 30px;
            }
            
            .voice-message {
                display: flex;
                align-items: center;
                background: #2a3441;
                border-radius: 20px;
                padding: 10px 15px;
                margin: 5px 0;
                max-width: 250px;
            }
            
            .voice-message-play {
                background: #0088cc;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                cursor: pointer;
                margin-right: 10px;
            }
            
            .voice-message-duration {
                color: #8899a6;
                font-size: 0.9rem;
                font-family: monospace;
            }
            
            .voice-message-waveform {
                flex: 1;
                height: 30px;
                margin: 0 10px;
                background: #1a1f29;
                border-radius: 15px;
                position: relative;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    async startRecording() {
        if (this.isRecording || !this.microphoneAccess) {
            return;
        }
        
        console.log('🎤 Starting voice recording...');
        
        try {
            // Get microphone stream
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            // Set up audio context for waveform
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            this.analyser.fftSize = 256;
            
            // Set up media recorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: this.selectedMimeType,
                audioBitsPerSecond: this.compressionOptions.audioBitsPerSecond
            });
            
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecordedAudio();
            };
            
            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            // Update UI
            this.showRecordingUI();
            this.voiceButton.classList.add('recording');
            
            // Start waveform animation
            this.startWaveformAnimation();
            
            // Start timer
            this.startRecordingTimer();
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showError('Failed to start voice recording');
        }
    }
    
    stopRecording() {
        if (!this.isRecording) {
            return;
        }
        
        console.log('🎤 Stopping voice recording...');
        
        this.isRecording = false;
        this.recordingDuration = Date.now() - this.recordingStartTime;
        
        // Stop media recorder
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        // Stop microphone stream
        if (this.microphone && this.microphone.stream) {
            this.microphone.stream.getTracks().forEach(track => track.stop());
        }
        
        // Clean up audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Update UI
        this.hideRecordingUI();
        this.voiceButton.classList.remove('recording');
        
        // Stop waveform animation
        this.stopWaveformAnimation();
        
        // Stop timer
        this.stopRecordingTimer();
    }
    
    showRecordingUI() {
        if (document.getElementById('voiceRecordingOverlay')) {
            return;
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'voiceRecordingOverlay';
        overlay.className = 'voice-recording-overlay';
        
        overlay.innerHTML = `
            <div class="voice-recording-content">
                <div class="voice-recording-icon">
                    <i class="fas fa-microphone"></i>
                </div>
                <div class="voice-recording-time" id="recordingTime">0:00</div>
                <canvas class="voice-waveform" id="recordingWaveform" width="300" height="60"></canvas>
                <div class="voice-recording-instruction">Hold to record, release to send</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Set up waveform canvas
        this.waveformCanvas = document.getElementById('recordingWaveform');
        this.waveformContext = this.waveformCanvas.getContext('2d');
    }
    
    hideRecordingUI() {
        const overlay = document.getElementById('voiceRecordingOverlay');
        if (overlay) {
            overlay.remove();
        }
        
        this.waveformCanvas = null;
        this.waveformContext = null;
    }
    
    startWaveformAnimation() {
        if (!this.analyser || !this.waveformContext) {
            return;
        }
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (!this.isRecording) {
                return;
            }
            
            this.animationFrame = requestAnimationFrame(draw);
            
            this.analyser.getByteFrequencyData(dataArray);
            
            this.waveformContext.fillStyle = '#2a3441';
            this.waveformContext.fillRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);
            
            const barWidth = (this.waveformCanvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255.0) * this.waveformCanvas.height * 0.8;
                
                this.waveformContext.fillStyle = `rgb(0, 136, 204)`;
                this.waveformContext.fillRect(
                    x, 
                    this.waveformCanvas.height - barHeight, 
                    barWidth, 
                    barHeight
                );
                
                x += barWidth + 1;
            }
        };
        
        draw();
    }
    
    stopWaveformAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timeElement = document.getElementById('recordingTime');
            if (timeElement) {
                timeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
            
            // Auto-stop at max recording time
            if (elapsed >= this.maxRecordingTime) {
                this.stopRecording();
            }
        }, 100);
    }
    
    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }
    
    async processRecordedAudio() {
        if (this.recordedChunks.length === 0) {
            console.warn('No audio data recorded');
            return;
        }
        
        // Check minimum duration
        if (this.recordingDuration < 500) {
            console.warn('Recording too short, discarding');
            return;
        }
        
        console.log(`🎤 Processing ${this.recordingDuration}ms of audio...`);
        
        try {
            // Create blob from recorded chunks
            const audioBlob = new Blob(this.recordedChunks, { 
                type: this.selectedMimeType 
            });
            
            // Convert to base64 for transmission
            const audioData = await this.blobToBase64(audioBlob);
            
            // Create voice message
            const voiceMessage = {
                type: 'voice_message',
                id: this.generateVoiceMessageId(),
                data: audioData,
                duration: this.recordingDuration,
                mimeType: this.selectedMimeType,
                timestamp: Date.now()
            };
            
            // Send voice message
            await this.sendVoiceMessage(voiceMessage);
            
            // Display in chat
            this.displayVoiceMessage(voiceMessage, 'self');
            
        } catch (error) {
            console.error('Failed to process recorded audio:', error);
            this.showError('Failed to process voice message');
        }
    }
    
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    async sendVoiceMessage(voiceMessage) {
        if (window.cipherWave && window.cipherWave.connectionManager) {
            await window.cipherWave.connectionManager.sendData(voiceMessage);
            console.log('🎤 Voice message sent');
        }
    }
    
    displayVoiceMessage(voiceMessage, sender) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) {
            return;
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender === 'self' ? 'message-sent' : 'message-received'}`;
        
        const duration = this.formatDuration(voiceMessage.duration);
        const timestamp = new Date(voiceMessage.timestamp).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class="voice-message">
                <button class="voice-message-play" onclick="window.voiceManager.playVoiceMessage('${voiceMessage.id}')">
                    <i class="fas fa-play"></i>
                </button>
                <div class="voice-message-waveform"></div>
                <div class="voice-message-duration">${duration}</div>
            </div>
            <div class="message-time">${timestamp}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Store voice message for playback
        this.voiceMessages.set(voiceMessage.id, voiceMessage);
    }
    
    async playVoiceMessage(messageId) {
        const voiceMessage = this.voiceMessages.get(messageId);
        if (!voiceMessage) {
            console.error('Voice message not found:', messageId);
            return;
        }
        
        try {
            // Stop current playback if any
            if (this.currentlyPlaying) {
                this.currentlyPlaying.pause();
                this.currentlyPlaying = null;
            }
            
            // Convert base64 to blob
            const audioData = atob(voiceMessage.data);
            const audioArray = new Uint8Array(audioData.length);
            
            for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
            }
            
            const audioBlob = new Blob([audioArray], { type: voiceMessage.mimeType });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Create and play audio
            const audio = new Audio(audioUrl);
            this.currentlyPlaying = audio;
            this.isPlaying = true;
            
            // Update play button
            const playButton = document.querySelector(`button[onclick="window.voiceManager.playVoiceMessage('${messageId}')"]`);
            if (playButton) {
                playButton.innerHTML = '<i class="fas fa-pause"></i>';
            }
            
            audio.onended = () => {
                this.isPlaying = false;
                this.currentlyPlaying = null;
                URL.revokeObjectURL(audioUrl);
                
                if (playButton) {
                    playButton.innerHTML = '<i class="fas fa-play"></i>';
                }
            };
            
            await audio.play();
            
        } catch (error) {
            console.error('Failed to play voice message:', error);
            this.showError('Failed to play voice message');
        }
    }
    
    generateVoiceMessageId() {
        return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    showError(message) {
        if (window.cipherWave && window.cipherWave.uiManager) {
            window.cipherWave.uiManager.showError(message);
        } else {
            console.error(message);
        }
    }
    
    destroy() {
        // Stop any ongoing recording
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Stop any playback
        if (this.currentlyPlaying) {
            this.currentlyPlaying.pause();
            this.currentlyPlaying = null;
        }
        
        // Clean up UI
        if (this.voiceButton) {
            this.voiceButton.remove();
        }
        
        this.hideRecordingUI();
        
        // Remove styles
        const styles = document.getElementById('voiceManagerStyles');
        if (styles) {
            styles.remove();
        }
        
        // Clear voice messages
        this.voiceMessages.clear();
        
        console.log('🗑️ Voice manager destroyed');
    }
}

// Make voice manager globally accessible for onclick handlers
window.voiceManager = null;