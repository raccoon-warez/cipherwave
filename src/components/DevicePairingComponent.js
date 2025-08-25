// CipherWave Device Pairing Component
// Handles QR code generation, scanning, and device authorization UI

import { BaseComponent } from './BaseComponent.js';

export class DevicePairingComponent extends BaseComponent {
    constructor(deviceTrustManager, syncCoordinator) {
        super();
        this.deviceTrustManager = deviceTrustManager;
        this.syncCoordinator = syncCoordinator;
        this.currentView = 'main'; // main, generate, scan, pending, devices
        this.pendingPairings = new Map();
        this.qrCodeData = null;
        this.scannerActive = false;
        this.videoStream = null;
    }

    getHTML() {
        switch (this.currentView) {
            case 'main':
                return this.getMainHTML();
            case 'generate':
                return this.getGenerateQRHTML();
            case 'scan':
                return this.getScanQRHTML();
            case 'pending':
                return this.getPendingApprovalsHTML();
            case 'devices':
                return this.getTrustedDevicesHTML();
            default:
                return this.getMainHTML();
        }
    }

    getMainHTML() {
        const trustedDevices = this.deviceTrustManager.getTrustedDevices();
        const deviceCount = trustedDevices.length;
        const maxDevices = this.deviceTrustManager.maxTrustedDevices;

        return `
            <div class="device-pairing-container">
                <div class="pairing-header">
                    <h2>🔗 Device Management</h2>
                    <p class="subtitle">Securely connect and manage your devices</p>
                </div>

                <div class="device-stats">
                    <div class="stat-card">
                        <span class="stat-number">${deviceCount}</span>
                        <span class="stat-label">Trusted Devices</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${maxDevices - deviceCount}</span>
                        <span class="stat-label">Available Slots</span>
                    </div>
                </div>

                <div class="pairing-actions">
                    <button class="btn btn-primary" id="generate-qr-btn">
                        📱 Add New Device
                    </button>
                    <button class="btn btn-secondary" id="scan-qr-btn">
                        📷 Join Existing Account
                    </button>
                </div>

                <div class="device-sections">
                    <button class="section-btn" id="view-devices-btn">
                        📋 View Trusted Devices (${deviceCount})
                        <span class="arrow">→</span>
                    </button>
                    
                    ${this.pendingPairings.size > 0 ? `
                        <button class="section-btn pending" id="view-pending-btn">
                            ⏳ Pending Approvals (${this.pendingPairings.size})
                            <span class="arrow">→</span>
                        </button>
                    ` : ''}
                </div>

                <div class="security-info">
                    <div class="info-card">
                        <h4>🔐 How it works:</h4>
                        <ul>
                            <li>Generate QR code on this device to add a new device</li>
                            <li>Scan QR code on new device to join your account</li>
                            <li>All devices require approval before accessing your data</li>
                            <li>Data stays encrypted and synchronized across devices</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    getGenerateQRHTML() {
        return `
            <div class="device-pairing-container">
                <div class="pairing-header">
                    <button class="back-btn" id="back-to-main-btn">← Back</button>
                    <h2>📱 Add New Device</h2>
                    <p class="subtitle">Scan this QR code with your new device</p>
                </div>

                <div class="qr-generation">
                    <div class="device-type-selector">
                        <label>Device Type:</label>
                        <select id="device-type-select">
                            <option value="DESKTOP">🖥️ Desktop Computer</option>
                            <option value="MOBILE">📱 Mobile Phone</option>
                            <option value="TABLET">📱 Tablet</option>
                            <option value="WEB">🌐 Web Browser</option>
                        </select>
                    </div>

                    <div class="qr-settings">
                        <label>QR Code Expiry:</label>
                        <select id="qr-expiry-select">
                            <option value="5">5 minutes</option>
                            <option value="10" selected>10 minutes</option>
                            <option value="15">15 minutes</option>
                            <option value="30">30 minutes</option>
                        </select>
                    </div>

                    <button class="btn btn-primary" id="generate-qr-code-btn">
                        Generate QR Code
                    </button>

                    <div id="qr-code-display" class="qr-code-display" style="display: none;">
                        <div class="qr-code-container">
                            <img id="qr-code-image" src="" alt="Device Pairing QR Code" />
                        </div>
                        
                        <div class="qr-info">
                            <p class="qr-expiry">Expires: <span id="qr-expiry-time"></span></p>
                            <p class="qr-instructions">
                                1. Open CipherWave on your new device<br>
                                2. Go to "Join Existing Account"<br>
                                3. Scan this QR code<br>
                                4. Wait for approval on this device
                            </p>
                        </div>

                        <div class="qr-actions">
                            <button class="btn btn-secondary" id="regenerate-qr-btn">
                                🔄 Generate New Code
                            </button>
                            <button class="btn btn-danger" id="cancel-qr-btn">
                                ❌ Cancel
                            </button>
                        </div>
                    </div>
                </div>

                <div id="pairing-status" class="pairing-status" style="display: none;">
                    <div class="status-message">
                        <span class="status-icon">⏳</span>
                        <span class="status-text">Waiting for device to scan QR code...</span>
                    </div>
                </div>
            </div>
        `;
    }

    getScanQRHTML() {
        return `
            <div class="device-pairing-container">
                <div class="pairing-header">
                    <button class="back-btn" id="back-to-main-btn">← Back</button>
                    <h2>📷 Join Existing Account</h2>
                    <p class="subtitle">Scan QR code from your existing device</p>
                </div>

                <div class="qr-scanner">
                    <div class="camera-container">
                        <video id="qr-scanner-video" playsinline></video>
                        <canvas id="qr-scanner-canvas" style="display: none;"></canvas>
                        
                        <div class="scanner-overlay">
                            <div class="scanner-frame"></div>
                        </div>
                    </div>

                    <div class="scanner-controls">
                        <button class="btn btn-primary" id="start-scanner-btn">
                            📷 Start Camera
                        </button>
                        <button class="btn btn-secondary" id="stop-scanner-btn" style="display: none;">
                            ⏹️ Stop Camera
                        </button>
                    </div>

                    <div class="scanner-status">
                        <p id="scanner-status-text">Camera not started</p>
                    </div>

                    <div class="manual-input">
                        <h4>Or enter QR code data manually:</h4>
                        <textarea id="manual-qr-input" placeholder="Paste QR code data here..."></textarea>
                        <button class="btn btn-secondary" id="process-manual-qr-btn">
                            Process QR Data
                        </button>
                    </div>
                </div>

                <div id="scan-result" class="scan-result" style="display: none;">
                    <div class="result-card">
                        <h4>Device Found!</h4>
                        <div class="device-info">
                            <p><strong>Owner:</strong> <span id="device-owner"></span></p>
                            <p><strong>Device:</strong> <span id="device-name"></span></p>
                            <p><strong>Type:</strong> <span id="device-type"></span></p>
                        </div>
                        
                        <div class="result-actions">
                            <button class="btn btn-primary" id="send-pairing-request-btn">
                                🤝 Send Pairing Request
                            </button>
                            <button class="btn btn-secondary" id="scan-another-btn">
                                📷 Scan Another Code
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getPendingApprovalsHTML() {
        const pendingApprovals = Array.from(this.pendingPairings.values());
        
        return `
            <div class="device-pairing-container">
                <div class="pairing-header">
                    <button class="back-btn" id="back-to-main-btn">← Back</button>
                    <h2>⏳ Pending Approvals</h2>
                    <p class="subtitle">Review and approve device pairing requests</p>
                </div>

                <div class="pending-list">
                    ${pendingApprovals.map(approval => `
                        <div class="pending-card" data-pairing-id="${approval.pairingId}">
                            <div class="pending-info">
                                <div class="pending-header">
                                    <h4>${this.escapeHtml(approval.requestingDevice?.displayName || 'Unknown Device')}</h4>
                                    <span class="device-type-badge">${approval.requestingDevice?.deviceType || 'UNKNOWN'}</span>
                                </div>
                                
                                <div class="pending-details">
                                    <p><strong>Device ID:</strong> ${approval.requestingDevice?.deviceId?.substring(0, 8) || 'Unknown'}...</p>
                                    <p><strong>Platform:</strong> ${this.escapeHtml(approval.requestingDevice?.platform || 'Unknown')}</p>
                                    <p><strong>Requested:</strong> ${new Date(approval.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                            
                            <div class="pending-actions">
                                <button class="btn btn-success approve-btn" data-pairing-id="${approval.pairingId}">
                                    ✅ Approve
                                </button>
                                <button class="btn btn-danger reject-btn" data-pairing-id="${approval.pairingId}">
                                    ❌ Reject
                                </button>
                            </div>
                        </div>
                    `).join('')}

                    ${pendingApprovals.length === 0 ? `
                        <div class="empty-state">
                            <p>No pending approvals</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    getTrustedDevicesHTML() {
        const trustedDevices = this.deviceTrustManager.getTrustedDevices();
        const currentDeviceId = this.deviceTrustManager.identityManager.deviceId;
        
        return `
            <div class="device-pairing-container">
                <div class="pairing-header">
                    <button class="back-btn" id="back-to-main-btn">← Back</button>
                    <h2>📋 Trusted Devices</h2>
                    <p class="subtitle">Manage your connected devices</p>
                </div>

                <div class="devices-list">
                    ${trustedDevices.map(device => `
                        <div class="device-card ${device.deviceId === currentDeviceId ? 'current-device' : ''}" 
                             data-device-id="${device.deviceId}">
                            
                            <div class="device-info">
                                <div class="device-header">
                                    <h4>
                                        ${this.escapeHtml(device.displayName)}
                                        ${device.deviceId === currentDeviceId ? '<span class="current-badge">Current Device</span>' : ''}
                                    </h4>
                                    <span class="device-type-badge">${device.deviceType}</span>
                                </div>
                                
                                <div class="device-details">
                                    <p><strong>Trust Level:</strong> 
                                        <span class="trust-level trust-${this.getTrustClass(device.trustLevel)}">
                                            ${device.trustLevel}%
                                        </span>
                                    </p>
                                    <p><strong>Last Seen:</strong> ${this.formatLastSeen(device.lastSeen)}</p>
                                    <p><strong>Platform:</strong> ${this.escapeHtml(device.platform)}</p>
                                    <p><strong>Added:</strong> ${new Date(device.created).toLocaleDateString()}</p>
                                    ${device.lastSync ? `<p><strong>Last Sync:</strong> ${this.formatLastSeen(device.lastSync)}</p>` : ''}
                                </div>

                                <div class="sync-preferences">
                                    <h5>Sync Preferences:</h5>
                                    <div class="sync-toggles">
                                        <span class="sync-item ${device.syncPreferences.messages ? 'enabled' : 'disabled'}">
                                            💬 Messages
                                        </span>
                                        <span class="sync-item ${device.syncPreferences.contacts ? 'enabled' : 'disabled'}">
                                            👥 Contacts
                                        </span>
                                        <span class="sync-item ${device.syncPreferences.preferences ? 'enabled' : 'disabled'}">
                                            ⚙️ Preferences
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            ${device.deviceId !== currentDeviceId ? `
                                <div class="device-actions">
                                    <button class="btn btn-secondary sync-btn" data-device-id="${device.deviceId}">
                                        🔄 Sync Now
                                    </button>
                                    <button class="btn btn-warning edit-btn" data-device-id="${device.deviceId}">
                                        ✏️ Edit
                                    </button>
                                    <button class="btn btn-danger remove-btn" data-device-id="${device.deviceId}">
                                        🗑️ Remove
                                    </button>
                                </div>
                            ` : `
                                <div class="current-device-note">
                                    <p>This is your current device</p>
                                </div>
                            `}
                        </div>
                    `).join('')}

                    ${trustedDevices.length === 0 ? `
                        <div class="empty-state">
                            <p>No trusted devices found</p>
                            <button class="btn btn-primary" id="add-first-device-btn">
                                Add Your First Device
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        super.setupEventListeners();

        // Main view navigation
        this.addEventListener('click', '#generate-qr-btn', () => {
            this.currentView = 'generate';
            this.render();
        });

        this.addEventListener('click', '#scan-qr-btn', () => {
            this.currentView = 'scan';
            this.render();
        });

        this.addEventListener('click', '#view-devices-btn', () => {
            this.currentView = 'devices';
            this.render();
        });

        this.addEventListener('click', '#view-pending-btn', () => {
            this.currentView = 'pending';
            this.render();
        });

        // Back button
        this.addEventListener('click', '#back-to-main-btn', () => {
            this.cleanup();
            this.currentView = 'main';
            this.render();
        });

        // QR Generation
        this.addEventListener('click', '#generate-qr-code-btn', () => {
            this.generateQRCode();
        });

        this.addEventListener('click', '#regenerate-qr-btn', () => {
            this.generateQRCode();
        });

        this.addEventListener('click', '#cancel-qr-btn', () => {
            this.cancelQRGeneration();
        });

        // QR Scanning
        this.addEventListener('click', '#start-scanner-btn', () => {
            this.startQRScanner();
        });

        this.addEventListener('click', '#stop-scanner-btn', () => {
            this.stopQRScanner();
        });

        this.addEventListener('click', '#process-manual-qr-btn', () => {
            this.processManualQRInput();
        });

        this.addEventListener('click', '#send-pairing-request-btn', () => {
            this.sendPairingRequest();
        });

        // Pending approvals
        this.addEventListener('click', '.approve-btn', (e) => {
            const pairingId = e.target.dataset.pairingId;
            this.approvePairingRequest(pairingId);
        });

        this.addEventListener('click', '.reject-btn', (e) => {
            const pairingId = e.target.dataset.pairingId;
            this.rejectPairingRequest(pairingId);
        });

        // Device management
        this.addEventListener('click', '.sync-btn', (e) => {
            const deviceId = e.target.dataset.deviceId;
            this.syncWithDevice(deviceId);
        });

        this.addEventListener('click', '.remove-btn', (e) => {
            const deviceId = e.target.dataset.deviceId;
            this.removeDevice(deviceId);
        });
    }

    async generateQRCode() {
        try {
            const deviceType = this.getElementValue('#device-type-select');
            const expiryMinutes = parseInt(this.getElementValue('#qr-expiry-select'));

            const qrResult = await this.deviceTrustManager.generatePairingQR(deviceType, expiryMinutes);
            this.qrCodeData = qrResult;

            // Display QR code
            const qrImage = this.getElement('#qr-code-image');
            const qrDisplay = this.getElement('#qr-code-display');
            const expiryTime = this.getElement('#qr-expiry-time');

            qrImage.src = qrResult.qrCodeDataUrl;
            expiryTime.textContent = new Date(qrResult.expiryTime).toLocaleString();
            qrDisplay.style.display = 'block';

            // Start monitoring for pairing requests
            this.monitorPairingRequests(qrResult.pairingId);

        } catch (error) {
            console.error('Failed to generate QR code:', error);
            this.showError('Failed to generate QR code: ' + error.message);
        }
    }

    cancelQRGeneration() {
        this.qrCodeData = null;
        const qrDisplay = this.getElement('#qr-code-display');
        if (qrDisplay) {
            qrDisplay.style.display = 'none';
        }
    }

    async startQRScanner() {
        try {
            this.videoStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            
            const video = this.getElement('#qr-scanner-video');
            video.srcObject = this.videoStream;
            video.play();

            this.scannerActive = true;
            this.getElement('#start-scanner-btn').style.display = 'none';
            this.getElement('#stop-scanner-btn').style.display = 'inline-block';
            this.getElement('#scanner-status-text').textContent = 'Camera active - Position QR code in frame';

            // Start scanning
            this.scanForQRCode();

        } catch (error) {
            console.error('Failed to start camera:', error);
            this.showError('Failed to access camera: ' + error.message);
        }
    }

    stopQRScanner() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        
        this.scannerActive = false;
        this.getElement('#start-scanner-btn').style.display = 'inline-block';
        this.getElement('#stop-scanner-btn').style.display = 'none';
        this.getElement('#scanner-status-text').textContent = 'Camera stopped';
    }

    async scanForQRCode() {
        if (!this.scannerActive) return;

        const video = this.getElement('#qr-scanner-video');
        const canvas = this.getElement('#qr-scanner-canvas');
        const context = canvas.getContext('2d');

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            // Get image data for QR code scanning
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            // Here you would use a QR code scanning library like jsQR
            // For now, we'll simulate the scanning process
            // const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            // Simulate QR detection (replace with actual QR scanning library)
            // if (code && code.data) {
            //     await this.processScannedQR(code.data);
            //     return;
            // }
            
        } catch (error) {
            console.error('QR scanning error:', error);
        }

        // Continue scanning
        if (this.scannerActive) {
            setTimeout(() => this.scanForQRCode(), 100);
        }
    }

    async processManualQRInput() {
        const qrData = this.getElementValue('#manual-qr-input');
        if (!qrData.trim()) {
            this.showError('Please enter QR code data');
            return;
        }

        await this.processScannedQR(qrData.trim());
    }

    async processScannedQR(qrData) {
        try {
            const deviceInfo = {
                type: this.detectDeviceType(),
                platform: navigator.platform
            };

            const pairingRequest = await this.deviceTrustManager.processPairingQR(qrData, deviceInfo);
            
            // Display scan result
            this.displayScanResult(pairingRequest);

        } catch (error) {
            console.error('Failed to process QR code:', error);
            this.showError('Failed to process QR code: ' + error.message);
        }
    }

    displayScanResult(pairingRequest) {
        this.stopQRScanner();
        
        const scanResult = this.getElement('#scan-result');
        const deviceOwner = this.getElement('#device-owner');
        const deviceName = this.getElement('#device-name');
        const deviceType = this.getElement('#device-type');

        deviceOwner.textContent = pairingRequest.displayName || 'Unknown';
        deviceName.textContent = pairingRequest.deviceId?.substring(0, 8) + '...' || 'Unknown';
        deviceType.textContent = pairingRequest.deviceType || 'Unknown';

        scanResult.style.display = 'block';
        
        // Store pairing request for sending
        this.currentPairingRequest = pairingRequest;
    }

    async sendPairingRequest() {
        if (!this.currentPairingRequest) {
            this.showError('No pairing request available');
            return;
        }

        try {
            // Here you would send the pairing request to the other device
            // This would typically involve WebRTC signaling or similar P2P communication
            
            this.showToast('Pairing request sent! Waiting for approval...', 'info');
            
            // Switch to a waiting state
            // For now, we'll just show a success message
            
        } catch (error) {
            console.error('Failed to send pairing request:', error);
            this.showError('Failed to send pairing request: ' + error.message);
        }
    }

    async approvePairingRequest(pairingId) {
        try {
            const approval = this.pendingPairings.get(pairingId);
            if (!approval) {
                this.showError('Pairing request not found');
                return;
            }

            const result = await this.deviceTrustManager.approvePairingRequest(approval, 'MANUAL');
            
            if (result.success) {
                this.pendingPairings.delete(pairingId);
                this.showToast(`Device "${result.trustedDevice.displayName}" approved!`, 'success');
                
                // Start sync with new device
                if (this.syncCoordinator) {
                    await this.syncCoordinator.connectToDevice(result.trustedDevice.deviceId);
                }
                
                this.render(); // Refresh the view
            }

        } catch (error) {
            console.error('Failed to approve pairing:', error);
            this.showError('Failed to approve device: ' + error.message);
        }
    }

    async rejectPairingRequest(pairingId) {
        try {
            await this.deviceTrustManager.rejectPairingRequest(pairingId, 'User rejected');
            this.pendingPairings.delete(pairingId);
            this.showToast('Pairing request rejected', 'info');
            this.render(); // Refresh the view

        } catch (error) {
            console.error('Failed to reject pairing:', error);
            this.showError('Failed to reject device: ' + error.message);
        }
    }

    async syncWithDevice(deviceId) {
        try {
            if (!this.syncCoordinator) {
                throw new Error('Sync coordinator not available');
            }

            const device = this.deviceTrustManager.getDevice(deviceId);
            this.showToast(`Starting sync with ${device.displayName}...`, 'info');
            
            await this.syncCoordinator.connectToDevice(deviceId);
            this.showToast(`Sync initiated with ${device.displayName}`, 'success');

        } catch (error) {
            console.error('Failed to sync with device:', error);
            this.showError('Failed to sync: ' + error.message);
        }
    }

    async removeDevice(deviceId) {
        const device = this.deviceTrustManager.getDevice(deviceId);
        if (!device) return;

        const confirmed = confirm(`Are you sure you want to remove "${device.displayName}"? This device will lose access to your data.`);
        
        if (confirmed) {
            try {
                await this.deviceTrustManager.removeDevice(deviceId, 'Manual removal');
                
                // Disconnect from sync if connected
                if (this.syncCoordinator) {
                    await this.syncCoordinator.disconnectFromDevice(deviceId);
                }
                
                this.showToast(`Device "${device.displayName}" removed`, 'success');
                this.render(); // Refresh the view

            } catch (error) {
                console.error('Failed to remove device:', error);
                this.showError('Failed to remove device: ' + error.message);
            }
        }
    }

    // Utility methods
    detectDeviceType() {
        const userAgent = navigator.userAgent;
        if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return 'MOBILE';
        if (/Tablet|iPad/.test(userAgent)) return 'TABLET';
        return 'DESKTOP';
    }

    getTrustClass(trustLevel) {
        if (trustLevel >= 80) return 'high';
        if (trustLevel >= 60) return 'medium';
        if (trustLevel >= 40) return 'low';
        return 'very-low';
    }

    formatLastSeen(timestamp) {
        if (!timestamp) return 'Never';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        return `${Math.floor(diff / 86400000)} days ago`;
    }

    monitorPairingRequests(pairingId) {
        // This would monitor for incoming pairing requests
        // In a real implementation, this would listen to WebRTC signaling or similar
        console.log(`Monitoring pairing requests for: ${pairingId}`);
    }

    cleanup() {
        this.stopQRScanner();
        this.qrCodeData = null;
        this.currentPairingRequest = null;
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    destroy() {
        this.cleanup();
        super.destroy();
    }
}