// CipherWave Connection Manager Tests
// Tests for WebRTC connection lifecycle, error handling, and reconnection

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager } from '../connection-manager.js';

// Mock WebRTC APIs
global.RTCPeerConnection = vi.fn(() => ({
    connectionState: 'new',
    iceConnectionState: 'new',
    signalingState: 'stable',
    iceGatheringState: 'new',
    localDescription: null,
    remoteDescription: null,
    
    createDataChannel: vi.fn(() => mockDataChannel),
    createOffer: vi.fn(() => Promise.resolve(mockOffer)),
    createAnswer: vi.fn(() => Promise.resolve(mockAnswer)),
    setLocalDescription: vi.fn(() => Promise.resolve()),
    setRemoteDescription: vi.fn(() => Promise.resolve()),
    addIceCandidate: vi.fn(() => Promise.resolve()),
    getStats: vi.fn(() => Promise.resolve(new Map())),
    restartIce: vi.fn(),
    close: vi.fn(),
    
    // Event handlers
    onconnectionstatechange: null,
    oniceconnectionstatechange: null,
    onsignalingstatechange: null,
    onicegatheringstatechange: null,
    onicecandidate: null,
    onicecandidateerror: null,
    ondatachannel: null
}));

const mockDataChannel = {
    readyState: 'open',
    label: 'messaging',
    ordered: true,
    maxRetransmits: 3,
    bufferedAmount: 0,
    
    send: vi.fn(),
    close: vi.fn(),
    
    // Event handlers
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    onbufferedamountlow: null
};

const mockOffer = {
    type: 'offer',
    sdp: 'mock-offer-sdp'
};

const mockAnswer = {
    type: 'answer',
    sdp: 'mock-answer-sdp'
};

const mockIceCandidate = {
    candidate: 'candidate:mock-ice-candidate',
    sdpMid: '0',
    sdpMLineIndex: 0
};

// Mock signaling interface
const createMockSignaling = () => ({
    send: vi.fn(),
    onMessage: vi.fn()
});

describe('ConnectionManager', () => {
    let connectionManager;
    let mockSignaling;
    let mockConfiguration;
    
    beforeEach(() => {
        mockSignaling = createMockSignaling();
        mockConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };
        
        connectionManager = new ConnectionManager(mockConfiguration, mockSignaling);
        
        // Clear all mocks
        vi.clearAllMocks();
        
        // Mock timers
        vi.useFakeTimers();
    });
    
    afterEach(() => {
        if (connectionManager) {
            connectionManager.cleanup();
        }
        vi.useRealTimers();
    });
    
    describe('Initialization', () => {
        it('should initialize with configuration and signaling', () => {
            expect(connectionManager.configuration).toBe(mockConfiguration);
            expect(connectionManager.signaling).toBe(mockSignaling);
            expect(connectionManager.isConnected).toBe(false);
            expect(connectionManager.reconnectAttempts).toBe(0);
        });
        
        it('should set up default event handlers', () => {
            expect(connectionManager.eventHandlers.has('connected')).toBe(true);
            expect(connectionManager.eventHandlers.has('disconnected')).toBe(true);
            expect(connectionManager.eventHandlers.has('error')).toBe(true);
            expect(connectionManager.eventHandlers.has('dataReceived')).toBe(true);
        });
    });
    
    describe('Connection Creation', () => {
        it('should create connection as initiator', async () => {
            const result = await connectionManager.createConnection(true);
            
            expect(result).toBe(true);
            expect(connectionManager.isInitiator).toBe(true);
            expect(global.RTCPeerConnection).toHaveBeenCalledWith(mockConfiguration);
        });
        
        it('should create connection as non-initiator', async () => {
            const result = await connectionManager.createConnection(false);
            
            expect(result).toBe(true);
            expect(connectionManager.isInitiator).toBe(false);
            expect(global.RTCPeerConnection).toHaveBeenCalledWith(mockConfiguration);
        });
        
        it('should handle connection creation failure', async () => {
            global.RTCPeerConnection.mockImplementationOnce(() => {
                throw new Error('WebRTC not supported');
            });
            
            const result = await connectionManager.createConnection(true);
            
            expect(result).toBe(false);
        });
        
        it('should set up connection timeout', async () => {
            await connectionManager.createConnection(true);
            
            expect(connectionManager.connectionTimeout).toBeDefined();
        });
    });
    
    describe('Data Channel Management', () => {
        beforeEach(async () => {
            await connectionManager.createConnection(true);
        });
        
        it('should create data channel for initiator', () => {
            expect(connectionManager.peerConnection.createDataChannel).toHaveBeenCalledWith('messaging', {
                ordered: true,
                maxRetransmits: 3,
                maxPacketLifeTime: null
            });
        });
        
        it('should set up data channel event handlers', () => {
            expect(connectionManager.dataChannel).toBeDefined();
        });
        
        it('should handle incoming data channel for non-initiator', async () => {
            const nonInitiatorManager = new ConnectionManager(mockConfiguration, mockSignaling);
            await nonInitiatorManager.createConnection(false);
            
            expect(nonInitiatorManager.peerConnection.ondatachannel).toBeDefined();
            
            // Simulate incoming data channel
            const event = { channel: mockDataChannel };
            nonInitiatorManager.peerConnection.ondatachannel(event);
            
            expect(nonInitiatorManager.dataChannel).toBe(mockDataChannel);
            
            nonInitiatorManager.cleanup();
        });
    });
    
    describe('WebRTC Signaling', () => {
        beforeEach(async () => {
            await connectionManager.createConnection(true);
        });
        
        it('should create and send offer', async () => {
            const result = await connectionManager.createOffer();
            
            expect(result).toBe(true);
            expect(connectionManager.peerConnection.createOffer).toHaveBeenCalled();
            expect(connectionManager.peerConnection.setLocalDescription).toHaveBeenCalledWith(mockOffer);
            expect(mockSignaling.send).toHaveBeenCalledWith({
                type: 'offer',
                offer: mockOffer
            });
        });
        
        it('should handle incoming offer', async () => {
            const result = await connectionManager.handleOffer(mockOffer);
            
            expect(result).toBe(true);
            expect(connectionManager.peerConnection.setRemoteDescription).toHaveBeenCalledWith(mockOffer);
            expect(connectionManager.peerConnection.createAnswer).toHaveBeenCalled();
            expect(mockSignaling.send).toHaveBeenCalledWith({
                type: 'answer',
                answer: mockAnswer
            });
        });
        
        it('should handle incoming answer', async () => {
            const result = await connectionManager.handleAnswer(mockAnswer);
            
            expect(result).toBe(true);
            expect(connectionManager.peerConnection.setRemoteDescription).toHaveBeenCalledWith(mockAnswer);
        });
        
        it('should handle ICE candidates', async () => {
            const result = await connectionManager.handleICECandidate(mockIceCandidate);
            
            expect(result).toBe(true);
            expect(connectionManager.peerConnection.addIceCandidate).toHaveBeenCalledWith(mockIceCandidate);
        });
        
        it('should handle ICE candidate errors gracefully', async () => {
            connectionManager.peerConnection.addIceCandidate.mockRejectedValueOnce(new Error('Invalid candidate'));
            
            const result = await connectionManager.handleICECandidate(mockIceCandidate);
            
            expect(result).toBe(false);
            // Should not throw error
        });
    });
    
    describe('Data Transmission', () => {
        beforeEach(async () => {
            await connectionManager.createConnection(true);
            connectionManager.isConnected = true;
        });
        
        it('should send data successfully', () => {
            const testData = JSON.stringify({ type: 'test', message: 'Hello' });
            
            const result = connectionManager.sendData(testData);
            
            expect(result).toBe(true);
            expect(mockDataChannel.send).toHaveBeenCalledWith(testData);
        });
        
        it('should reject data when not connected', () => {
            connectionManager.isConnected = false;
            
            const result = connectionManager.sendData('test data');
            
            expect(result).toBe(false);
            expect(mockDataChannel.send).not.toHaveBeenCalled();
        });
        
        it('should handle buffer overflow', () => {
            mockDataChannel.bufferedAmount = 17 * 1024 * 1024; // 17MB, above 16MB limit
            
            const result = connectionManager.sendData('test data');
            
            expect(result).toBe(false);
            expect(mockDataChannel.send).not.toHaveBeenCalled();
        });
        
        it('should handle send errors', () => {
            mockDataChannel.send.mockImplementationOnce(() => {
                throw new Error('Send failed');
            });
            
            const result = connectionManager.sendData('test data');
            
            expect(result).toBe(false);
        });
    });
    
    describe('Connection State Handling', () => {
        beforeEach(async () => {
            await connectionManager.createConnection(true);
        });
        
        it('should handle connection established', () => {
            connectionManager.peerConnection.connectionState = 'connected';
            connectionManager.handleConnectionEstablished();
            
            expect(connectionManager.reconnectAttempts).toBe(0);
            expect(connectionManager.reconnectDelay).toBe(1000);
        });
        
        it('should handle connection disconnected', () => {
            const scheduleReconnectionSpy = vi.spyOn(connectionManager, 'scheduleReconnection');
            
            connectionManager.handleConnectionDisconnected();
            
            expect(scheduleReconnectionSpy).toHaveBeenCalled();
        });
        
        it('should handle connection failed', () => {
            const scheduleReconnectionSpy = vi.spyOn(connectionManager, 'scheduleReconnection');
            const emitSpy = vi.spyOn(connectionManager, 'emit');
            
            connectionManager.handleConnectionFailed();
            
            expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));
            expect(scheduleReconnectionSpy).toHaveBeenCalled();
        });
        
        it('should handle connection timeout', () => {
            const restartICESpy = vi.spyOn(connectionManager, 'restartICE');
            
            connectionManager.handleConnectionTimeout();
            
            expect(restartICESpy).toHaveBeenCalled();
        });
    });
    
    describe('Reconnection Logic', () => {
        beforeEach(async () => {
            await connectionManager.createConnection(true);
        });
        
        it('should schedule reconnection with exponential backoff', () => {
            connectionManager.maxReconnectAttempts = 3;
            
            connectionManager.scheduleReconnection();
            
            expect(connectionManager.reconnectAttempts).toBe(1);
            
            // Fast forward time to trigger reconnection
            vi.advanceTimersByTime(2000);
        });
        
        it('should stop reconnecting after max attempts', () => {
            connectionManager.reconnectAttempts = 5;
            connectionManager.maxReconnectAttempts = 5;
            
            const emitSpy = vi.spyOn(connectionManager, 'emit');
            
            connectionManager.scheduleReconnection();
            
            expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));
            expect(connectionManager.reconnectAttempts).toBe(5); // Should not increment
        });
        
        it('should attempt reconnection', async () => {
            const cleanupSpy = vi.spyOn(connectionManager, 'cleanup');
            const createConnectionSpy = vi.spyOn(connectionManager, 'createConnection');
            
            await connectionManager.attemptReconnection();
            
            expect(cleanupSpy).toHaveBeenCalledWith(false);
            expect(createConnectionSpy).toHaveBeenCalled();
        });
        
        it('should handle reconnection failure', async () => {
            const scheduleReconnectionSpy = vi.spyOn(connectionManager, 'scheduleReconnection');
            vi.spyOn(connectionManager, 'createConnection').mockResolvedValueOnce(false);
            
            await connectionManager.attemptReconnection();
            
            expect(scheduleReconnectionSpy).toHaveBeenCalled();
        });
    });
    
    describe('ICE Handling', () => {
        beforeEach(async () => {
            await connectionManager.createConnection(true);
        });
        
        it('should restart ICE connection', () => {
            connectionManager.restartICE();
            
            expect(connectionManager.peerConnection.restartIce).toHaveBeenCalled();
        });
        
        it('should handle ICE restart failure', () => {
            connectionManager.peerConnection.restartIce.mockImplementationOnce(() => {
                throw new Error('ICE restart failed');
            });
            
            const scheduleReconnectionSpy = vi.spyOn(connectionManager, 'scheduleReconnection');
            
            connectionManager.restartICE();
            
            expect(scheduleReconnectionSpy).toHaveBeenCalled();
        });
        
        it('should handle ICE gathering timeout', () => {
            connectionManager.peerConnection.iceGatheringState = 'gathering';
            connectionManager.handleICEGatheringStateChange();
            
            expect(connectionManager.iceTimeout).toBeDefined();
            
            // Fast forward to trigger timeout
            vi.advanceTimersByTime(30000);
            
            expect(connectionManager.peerConnection.onicecandidate).toHaveBeenCalledWith({ candidate: null });
        });
    });
    
    describe('Health Monitoring', () => {
        beforeEach(async () => {
            await connectionManager.createConnection(true);
        });
        
        it('should start health check', () => {
            connectionManager.startHealthCheck();
            
            expect(connectionManager.healthCheckInterval).toBeDefined();
        });
        
        it('should perform health check', async () => {
            const mockStats = new Map([
                ['inbound-rtp', { packetsLost: 50, jitter: 0.1 }],
                ['candidate-pair', { state: 'succeeded', currentRoundTripTime: 0.1, availableOutgoingBitrate: 1000000 }]
            ]);
            
            connectionManager.peerConnection.getStats.mockResolvedValueOnce(mockStats);
            
            await connectionManager.performHealthCheck();
            
            expect(connectionManager.connectionStats.packetsLost).toBe(50);
            expect(connectionManager.connectionStats.jitter).toBe(0.1);
            expect(connectionManager.connectionStats.roundTripTime).toBe(0.1);
            expect(connectionManager.connectionStats.bandwidth).toBe(1000000);
        });
        
        it('should emit poor connection quality warning', async () => {
            connectionManager.connectionStats = {
                packetsLost: 150,
                roundTripTime: 1500,
                jitter: 0,
                bandwidth: 0
            };
            
            const emitSpy = vi.spyOn(connectionManager, 'emit');
            
            await connectionManager.performHealthCheck();
            
            expect(emitSpy).toHaveBeenCalledWith('connectionQuality', 'poor');
        });
        
        it('should stop health check', () => {
            connectionManager.startHealthCheck();
            connectionManager.stopHealthCheck();
            
            expect(connectionManager.healthCheckInterval).toBeNull();
        });
    });
    
    describe('Event System', () => {
        it('should add event listeners', () => {
            const handler = vi.fn();
            
            connectionManager.addEventListener('test-event', handler);
            
            expect(connectionManager.eventHandlers.get('test-event')).toBe(handler);
        });
        
        it('should emit events', () => {
            const handler = vi.fn();
            connectionManager.addEventListener('test-event', handler);
            
            connectionManager.emit('test-event', 'test-data');
            
            expect(handler).toHaveBeenCalledWith('test-data');
        });
        
        it('should handle event handler errors', () => {
            const errorHandler = vi.fn(() => {
                throw new Error('Handler error');
            });
            
            connectionManager.addEventListener('test-event', errorHandler);
            
            // Should not throw
            expect(() => connectionManager.emit('test-event')).not.toThrow();
        });
    });
    
    describe('Statistics and Monitoring', () => {
        beforeEach(async () => {
            await connectionManager.createConnection(true);
        });
        
        it('should provide connection statistics', () => {
            connectionManager.connectionState = 'connected';
            connectionManager.iceConnectionState = 'connected';
            connectionManager.isConnected = true;
            connectionManager.reconnectAttempts = 2;
            
            const stats = connectionManager.getStats();
            
            expect(stats.connectionState).toBe('connected');
            expect(stats.iceConnectionState).toBe('connected');
            expect(stats.isConnected).toBe(true);
            expect(stats.reconnectAttempts).toBe(2);
            expect(stats.stats).toBeDefined();
        });
    });
    
    describe('Cleanup and Destruction', () => {
        beforeEach(async () => {
            await connectionManager.createConnection(true);
        });
        
        it('should cleanup resources', () => {
            connectionManager.startHealthCheck();
            connectionManager.isConnected = true;
            
            const emitSpy = vi.spyOn(connectionManager, 'emit');
            
            connectionManager.cleanup();
            
            expect(connectionManager.isConnected).toBe(false);
            expect(connectionManager.connectionState).toBe('closed');
            expect(connectionManager.healthCheckInterval).toBeNull();
            expect(mockDataChannel.close).toHaveBeenCalled();
            expect(connectionManager.peerConnection.close).toHaveBeenCalled();
            expect(emitSpy).toHaveBeenCalledWith('disconnected');
        });
        
        it('should cleanup without emitting event', () => {
            const emitSpy = vi.spyOn(connectionManager, 'emit');
            
            connectionManager.cleanup(false);
            
            expect(emitSpy).not.toHaveBeenCalledWith('disconnected');
        });
        
        it('should close connection', () => {
            const cleanupSpy = vi.spyOn(connectionManager, 'cleanup');
            
            connectionManager.close();
            
            expect(cleanupSpy).toHaveBeenCalled();
        });
    });
});