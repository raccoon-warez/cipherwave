// CipherWave Performance Monitor
// Real-time performance tracking and optimization suggestions

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            messageLatency: [],
            encryptionTime: [],
            connectionSetupTime: 0,
            memoryUsage: [],
            dataChannelThroughput: 0,
            iceConnectionTime: 0
        };
        
        this.thresholds = {
            maxMessageLatency: 100, // ms
            maxEncryptionTime: 10, // ms
            maxMemoryUsage: 50 * 1024 * 1024, // 50MB
            minThroughput: 1024 * 1024 // 1MB/s
        };
        
        this.observers = [];
        this.startTime = performance.now();
        this.setupPerformanceObserver();
    }
    
    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    this.processPerformanceEntry(entry);
                });
            });
            
            // Observe various performance metrics
            try {
                observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
                this.observers.push(observer);
            } catch (e) {
                console.warn('Performance observer not fully supported:', e);
            }
        }
    }
    
    processPerformanceEntry(entry) {
        switch (entry.entryType) {
            case 'measure':
                if (entry.name.startsWith('crypto-')) {
                    this.recordEncryptionTime(entry.duration);
                } else if (entry.name.startsWith('message-')) {
                    this.recordMessageLatency(entry.duration);
                }
                break;
            case 'navigation':
                this.recordNavigationTiming(entry);
                break;
        }
    }
    
    // Start timing a crypto operation
    startCryptoTiming(operation) {
        const markName = `crypto-${operation}-start`;
        performance.mark(markName);
        return markName;
    }
    
    // End timing a crypto operation
    endCryptoTiming(operation, startMark) {
        const endMark = `crypto-${operation}-end`;
        const measureName = `crypto-${operation}`;
        
        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);
        
        // Clean up marks
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
    }
    
    // Start timing message latency
    startMessageTiming(messageId) {
        const markName = `message-${messageId}-start`;
        performance.mark(markName);
        return markName;
    }
    
    // End timing message latency
    endMessageTiming(messageId, startMark) {
        const endMark = `message-${messageId}-end`;
        const measureName = `message-${messageId}`;
        
        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);
        
        // Clean up marks
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
    }
    
    recordEncryptionTime(duration) {
        this.metrics.encryptionTime.push({
            duration: duration,
            timestamp: Date.now()
        });
        
        // Keep only last 100 measurements
        if (this.metrics.encryptionTime.length > 100) {
            this.metrics.encryptionTime.shift();
        }
        
        // Check threshold
        if (duration > this.thresholds.maxEncryptionTime) {
            this.triggerAlert('encryption', `Encryption took ${duration.toFixed(2)}ms (threshold: ${this.thresholds.maxEncryptionTime}ms)`);
        }
    }
    
    recordMessageLatency(duration) {
        this.metrics.messageLatency.push({
            duration: duration,
            timestamp: Date.now()
        });
        
        // Keep only last 100 measurements
        if (this.metrics.messageLatency.length > 100) {
            this.metrics.messageLatency.shift();
        }
        
        // Check threshold
        if (duration > this.thresholds.maxMessageLatency) {
            this.triggerAlert('latency', `Message latency ${duration.toFixed(2)}ms (threshold: ${this.thresholds.maxMessageLatency}ms)`);
        }
    }
    
    recordConnectionSetupTime(duration) {
        this.metrics.connectionSetupTime = duration;
        console.log(`Connection setup completed in ${duration.toFixed(2)}ms`);
    }
    
    recordICEConnectionTime(duration) {
        this.metrics.iceConnectionTime = duration;
        console.log(`ICE connection established in ${duration.toFixed(2)}ms`);
    }
    
    recordMemoryUsage() {
        if ('memory' in performance) {
            const memInfo = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };
            
            this.metrics.memoryUsage.push(memInfo);
            
            // Keep only last 50 measurements
            if (this.metrics.memoryUsage.length > 50) {
                this.metrics.memoryUsage.shift();
            }
            
            // Check threshold
            if (memInfo.used > this.thresholds.maxMemoryUsage) {
                this.triggerAlert('memory', `Memory usage ${(memInfo.used / 1024 / 1024).toFixed(2)}MB exceeds threshold`);
            }
            
            return memInfo;
        }
        return null;
    }
    
    updateDataChannelThroughput(bytesPerSecond) {
        this.metrics.dataChannelThroughput = bytesPerSecond;
        
        if (bytesPerSecond < this.thresholds.minThroughput) {
            this.triggerAlert('throughput', `Low throughput: ${(bytesPerSecond / 1024 / 1024).toFixed(2)}MB/s`);
        }
    }
    
    triggerAlert(type, message) {
        console.warn(`Performance Alert [${type}]:`, message);
        
        // Emit custom event for UI handling
        const event = new CustomEvent('performanceAlert', {
            detail: { type, message, timestamp: Date.now() }
        });
        window.dispatchEvent(event);
    }
    
    // Get performance summary
    getSummary() {
        const avgEncryption = this.getAverage(this.metrics.encryptionTime);
        const avgLatency = this.getAverage(this.metrics.messageLatency);
        const currentMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] || {};
        
        return {
            averageEncryptionTime: avgEncryption.toFixed(2) + 'ms',
            averageMessageLatency: avgLatency.toFixed(2) + 'ms',
            connectionSetupTime: this.metrics.connectionSetupTime.toFixed(2) + 'ms',
            iceConnectionTime: this.metrics.iceConnectionTime.toFixed(2) + 'ms',
            currentMemoryUsage: currentMemory.used ? (currentMemory.used / 1024 / 1024).toFixed(2) + 'MB' : 'N/A',
            dataChannelThroughput: (this.metrics.dataChannelThroughput / 1024 / 1024).toFixed(2) + 'MB/s',
            uptime: ((performance.now() - this.startTime) / 1000).toFixed(1) + 's'
        };
    }
    
    getAverage(measurements) {
        if (measurements.length === 0) return 0;
        const sum = measurements.reduce((acc, m) => acc + m.duration, 0);
        return sum / measurements.length;
    }
    
    // Get detailed performance report
    getDetailedReport() {
        const summary = this.getSummary();
        const recentAlerts = this.getRecentAlerts();
        const recommendations = this.generateRecommendations();
        
        return {
            summary,
            recentAlerts,
            recommendations,
            rawMetrics: this.metrics,
            timestamp: new Date().toISOString()
        };
    }
    
    getRecentAlerts() {
        // This would typically store alerts, simplified for demo
        return [];
    }
    
    generateRecommendations() {
        const recommendations = [];
        const avgEncryption = this.getAverage(this.metrics.encryptionTime);
        const avgLatency = this.getAverage(this.metrics.messageLatency);
        
        if (avgEncryption > this.thresholds.maxEncryptionTime / 2) {
            recommendations.push({
                type: 'crypto',
                message: 'Consider optimizing cryptographic operations or using a faster cipher',
                priority: 'medium'
            });
        }
        
        if (avgLatency > this.thresholds.maxMessageLatency / 2) {
            recommendations.push({
                type: 'network',
                message: 'High message latency detected. Check network conditions',
                priority: 'high'
            });
        }
        
        if (this.metrics.dataChannelThroughput < this.thresholds.minThroughput / 2) {
            recommendations.push({
                type: 'throughput',
                message: 'Low data channel throughput. Consider message compression',
                priority: 'medium'
            });
        }
        
        const currentMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
        if (currentMemory && currentMemory.used > this.thresholds.maxMemoryUsage * 0.8) {
            recommendations.push({
                type: 'memory',
                message: 'High memory usage. Consider implementing message cleanup',
                priority: 'high'
            });
        }
        
        return recommendations;
    }
    
    // Start continuous monitoring
    startContinuousMonitoring(interval = 5000) {
        this.monitoringInterval = setInterval(() => {
            this.recordMemoryUsage();
            
            // Log summary every minute
            if (Math.floor(Date.now() / 60000) % 1 === 0) {
                console.log('Performance Summary:', this.getSummary());
            }
        }, interval);
    }
    
    // Stop monitoring
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        // Disconnect performance observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }
    
    // Reset metrics
    reset() {
        this.metrics = {
            messageLatency: [],
            encryptionTime: [],
            connectionSetupTime: 0,
            memoryUsage: [],
            dataChannelThroughput: 0,
            iceConnectionTime: 0
        };
        this.startTime = performance.now();
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
} else {
    window.PerformanceMonitor = PerformanceMonitor;
}