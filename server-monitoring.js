// CipherWave Server Monitoring and Analytics
// Comprehensive monitoring, metrics collection, and health checks

import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs';
import path from 'path';

class ServerMonitoring extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            metricsInterval: options.metricsInterval || 30000, // 30 seconds
            healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
            alertThresholds: {
                cpuUsage: options.cpuThreshold || 80, // 80%
                memoryUsage: options.memoryThreshold || 85, // 85%
                connectionCount: options.connectionThreshold || 1000,
                errorRate: options.errorThreshold || 5, // 5% error rate
                responseTime: options.responseTimeThreshold || 1000 // 1 second
            },
            retention: {
                metrics: options.metricsRetention || 24 * 60 * 60 * 1000, // 24 hours
                alerts: options.alertsRetention || 7 * 24 * 60 * 60 * 1000 // 7 days
            }
        };
        
        this.metrics = {
            system: {
                startTime: Date.now(),
                uptime: 0,
                cpuUsage: 0,
                memoryUsage: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 },
                loadAverage: [0, 0, 0],
                freeMemory: 0,
                totalMemory: 0
            },
            application: {
                activeConnections: 0,
                totalConnections: 0,
                messagesProcessed: 0,
                messagesPerSecond: 0,
                roomsActive: 0,
                totalRooms: 0,
                errorsCount: 0,
                errorRate: 0,
                averageResponseTime: 0
            },
            network: {
                bytesReceived: 0,
                bytesSent: 0,
                packetsReceived: 0,
                packetsSent: 0
            }
        };
        
        this.history = {
            metrics: [],
            alerts: [],
            events: []
        };
        
        this.intervals = new Map();
        this.lastCpuUsage = process.cpuUsage();
        this.lastNetworkStats = this.getNetworkStats();
        this.responseTimeBuffer = [];
        
        this.initializeMonitoring();
    }
    
    initializeMonitoring() {
        // Start metrics collection
        this.intervals.set('metrics', setInterval(() => {
            this.collectMetrics();
        }, this.options.metricsInterval));
        
        // Start health checks
        this.intervals.set('healthCheck', setInterval(() => {
            this.performHealthCheck();
        }, this.options.healthCheckInterval));
        
        // Cleanup old data periodically
        this.intervals.set('cleanup', setInterval(() => {
            this.cleanupOldData();
        }, 60 * 60 * 1000)); // Every hour
        
        // Initial metrics collection
        this.collectMetrics();
        
        console.log(`[${new Date().toISOString()}] [INFO] Server monitoring initialized`);
    }
    
    collectMetrics() {
        try {
            this.collectSystemMetrics();
            this.calculateDerivedMetrics();
            this.storeMetricsHistory();
            this.checkAlertThresholds();
            
            this.emit('metricsCollected', this.metrics);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] [ERROR] Failed to collect metrics:`, error);
        }
    }
    
    collectSystemMetrics() {
        // CPU Usage
        const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
        const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / (this.options.metricsInterval * 1000) * 100;
        this.metrics.system.cpuUsage = Math.min(cpuPercent, 100);
        this.lastCpuUsage = process.cpuUsage();
        
        // Memory Usage
        this.metrics.system.memoryUsage = process.memoryUsage();
        this.metrics.system.freeMemory = os.freemem();
        this.metrics.system.totalMemory = os.totalmem();
        
        // Load Average
        this.metrics.system.loadAverage = os.loadavg();
        
        // Uptime
        this.metrics.system.uptime = Date.now() - this.metrics.system.startTime;
        
        // Network stats (if available)
        const currentNetworkStats = this.getNetworkStats();
        if (currentNetworkStats && this.lastNetworkStats) {
            this.metrics.network.bytesReceived += currentNetworkStats.bytesReceived - this.lastNetworkStats.bytesReceived;
            this.metrics.network.bytesSent += currentNetworkStats.bytesSent - this.lastNetworkStats.bytesSent;
        }
        this.lastNetworkStats = currentNetworkStats;
    }
    
    calculateDerivedMetrics() {
        // Memory usage percentage
        const memUsagePercent = (this.metrics.system.memoryUsage.rss / this.metrics.system.totalMemory) * 100;
        this.metrics.system.memoryUsagePercent = memUsagePercent;
        
        // Messages per second (calculated from buffer)
        const now = Date.now();
        const recentMessages = this.history.events.filter(event => 
            event.type === 'message' && (now - event.timestamp) < 60000
        );
        this.metrics.application.messagesPerSecond = recentMessages.length / 60;
        
        // Error rate (last hour)
        const recentEvents = this.history.events.filter(event => 
            (now - event.timestamp) < 3600000
        );
        const totalEvents = recentEvents.length;
        const errorEvents = recentEvents.filter(event => event.type === 'error').length;
        this.metrics.application.errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
        
        // Average response time
        if (this.responseTimeBuffer.length > 0) {
            const sum = this.responseTimeBuffer.reduce((a, b) => a + b, 0);
            this.metrics.application.averageResponseTime = sum / this.responseTimeBuffer.length;
            this.responseTimeBuffer = this.responseTimeBuffer.slice(-100); // Keep last 100
        }
    }
    
    storeMetricsHistory() {
        const snapshot = {
            timestamp: Date.now(),
            metrics: JSON.parse(JSON.stringify(this.metrics))
        };
        
        this.history.metrics.push(snapshot);
        
        // Limit history size
        if (this.history.metrics.length > 1000) {
            this.history.metrics = this.history.metrics.slice(-500);
        }
    }
    
    checkAlertThresholds() {
        const thresholds = this.options.alertThresholds;
        const alerts = [];
        
        // CPU Usage Alert
        if (this.metrics.system.cpuUsage > thresholds.cpuUsage) {
            alerts.push({
                type: 'cpu',
                severity: 'warning',
                message: `High CPU usage: ${this.metrics.system.cpuUsage.toFixed(1)}%`,
                value: this.metrics.system.cpuUsage,
                threshold: thresholds.cpuUsage
            });
        }
        
        // Memory Usage Alert
        if (this.metrics.system.memoryUsagePercent > thresholds.memoryUsage) {
            alerts.push({
                type: 'memory',
                severity: 'warning',
                message: `High memory usage: ${this.metrics.system.memoryUsagePercent.toFixed(1)}%`,
                value: this.metrics.system.memoryUsagePercent,
                threshold: thresholds.memoryUsage
            });
        }
        
        // Connection Count Alert
        if (this.metrics.application.activeConnections > thresholds.connectionCount) {
            alerts.push({
                type: 'connections',
                severity: 'info',
                message: `High connection count: ${this.metrics.application.activeConnections}`,
                value: this.metrics.application.activeConnections,
                threshold: thresholds.connectionCount
            });
        }
        
        // Error Rate Alert
        if (this.metrics.application.errorRate > thresholds.errorRate) {
            alerts.push({
                type: 'errors',
                severity: 'critical',
                message: `High error rate: ${this.metrics.application.errorRate.toFixed(1)}%`,
                value: this.metrics.application.errorRate,
                threshold: thresholds.errorRate
            });
        }
        
        // Response Time Alert
        if (this.metrics.application.averageResponseTime > thresholds.responseTime) {
            alerts.push({
                type: 'response_time',
                severity: 'warning',
                message: `High response time: ${this.metrics.application.averageResponseTime.toFixed(0)}ms`,
                value: this.metrics.application.averageResponseTime,
                threshold: thresholds.responseTime
            });
        }
        
        // Process alerts
        alerts.forEach(alert => {
            this.processAlert(alert);
        });
    }
    
    processAlert(alert) {
        // Add timestamp and ID
        alert.timestamp = Date.now();
        alert.id = this.generateAlertId();
        
        // Store alert
        this.history.alerts.push(alert);
        
        // Log alert
        const logLevel = alert.severity === 'critical' ? 'ERROR' : 'WARN';
        console.log(`[${new Date().toISOString()}] [${logLevel}] Alert: ${alert.message}`);
        
        // Emit alert event
        this.emit('alert', alert);
        
        // Check for alert escalation
        this.checkAlertEscalation(alert);
    }
    
    checkAlertEscalation(alert) {
        // Count recent similar alerts
        const recentSimilar = this.history.alerts.filter(a => 
            a.type === alert.type && 
            (Date.now() - a.timestamp) < 300000 // Last 5 minutes
        );
        
        if (recentSimilar.length >= 3) {
            const escalatedAlert = {
                ...alert,
                severity: 'critical',
                escalated: true,
                message: `ESCALATED: ${alert.message} (${recentSimilar.length} occurrences)`
            };
            
            console.error(`[${new Date().toISOString()}] [ERROR] Escalated alert: ${escalatedAlert.message}`);
            this.emit('escalatedAlert', escalatedAlert);
        }
    }
    
    performHealthCheck() {
        const healthStatus = {
            timestamp: Date.now(),
            status: 'healthy',
            checks: {}
        };
        
        try {
            // System health checks
            healthStatus.checks.cpu = {
                status: this.metrics.system.cpuUsage < 90 ? 'healthy' : 'degraded',
                value: this.metrics.system.cpuUsage
            };
            
            healthStatus.checks.memory = {
                status: this.metrics.system.memoryUsagePercent < 90 ? 'healthy' : 'degraded',
                value: this.metrics.system.memoryUsagePercent
            };
            
            healthStatus.checks.uptime = {
                status: this.metrics.system.uptime > 0 ? 'healthy' : 'unhealthy',
                value: this.metrics.system.uptime
            };
            
            // Application health checks
            healthStatus.checks.errorRate = {
                status: this.metrics.application.errorRate < 10 ? 'healthy' : 'degraded',
                value: this.metrics.application.errorRate
            };
            
            healthStatus.checks.responseTime = {
                status: this.metrics.application.averageResponseTime < 2000 ? 'healthy' : 'degraded',
                value: this.metrics.application.averageResponseTime
            };
            
            // Overall status
            const unhealthyChecks = Object.values(healthStatus.checks).filter(check => check.status === 'unhealthy');
            const degradedChecks = Object.values(healthStatus.checks).filter(check => check.status === 'degraded');
            
            if (unhealthyChecks.length > 0) {
                healthStatus.status = 'unhealthy';
            } else if (degradedChecks.length > 0) {
                healthStatus.status = 'degraded';
            }
            
            this.emit('healthCheck', healthStatus);
            
        } catch (error) {
            healthStatus.status = 'unhealthy';
            healthStatus.error = error.message;
            
            console.error(`[${new Date().toISOString()}] [ERROR] Health check failed:`, error);
            this.emit('healthCheck', healthStatus);
        }
    }
    
    getNetworkStats() {
        try {
            // Simplified network stats (platform-specific implementation needed)
            return {
                bytesReceived: 0,
                bytesSent: 0,
                packetsReceived: 0,
                packetsSent: 0
            };
        } catch (error) {
            return null;
        }
    }
    
    // Event tracking methods
    recordConnection() {
        this.metrics.application.activeConnections++;
        this.metrics.application.totalConnections++;
        this.recordEvent('connection', { type: 'new' });
    }
    
    recordDisconnection() {
        this.metrics.application.activeConnections = Math.max(0, this.metrics.application.activeConnections - 1);
        this.recordEvent('connection', { type: 'closed' });
    }
    
    recordMessage() {
        this.metrics.application.messagesProcessed++;
        this.recordEvent('message', {});
    }
    
    recordError(error) {
        this.metrics.application.errorsCount++;
        this.recordEvent('error', { message: error.message });
    }
    
    recordResponseTime(time) {
        this.responseTimeBuffer.push(time);
    }
    
    recordRoomActivity(action, roomId) {
        switch (action) {
            case 'created':
                this.metrics.application.totalRooms++;
                this.metrics.application.roomsActive++;
                break;
            case 'closed':
                this.metrics.application.roomsActive = Math.max(0, this.metrics.application.roomsActive - 1);
                break;
        }
        this.recordEvent('room', { action, roomId });
    }
    
    recordEvent(type, data) {
        const event = {
            timestamp: Date.now(),
            type: type,
            data: data
        };
        
        this.history.events.push(event);
        
        // Limit events history
        if (this.history.events.length > 10000) {
            this.history.events = this.history.events.slice(-5000);
        }
    }
    
    cleanupOldData() {
        const now = Date.now();
        
        // Clean up old metrics
        this.history.metrics = this.history.metrics.filter(
            m => (now - m.timestamp) <= this.options.retention.metrics
        );
        
        // Clean up old alerts
        this.history.alerts = this.history.alerts.filter(
            a => (now - a.timestamp) <= this.options.retention.alerts
        );
        
        // Clean up old events
        this.history.events = this.history.events.filter(
            e => (now - e.timestamp) <= this.options.retention.metrics
        );
    }
    
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // API methods for external access
    getCurrentMetrics() {
        return JSON.parse(JSON.stringify(this.metrics));
    }
    
    getMetricsHistory(timeRange = 3600000) { // Default 1 hour
        const cutoff = Date.now() - timeRange;
        return this.history.metrics.filter(m => m.timestamp >= cutoff);
    }
    
    getActiveAlerts() {
        const cutoff = Date.now() - 300000; // Last 5 minutes
        return this.history.alerts.filter(a => a.timestamp >= cutoff);
    }
    
    getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            networkInterfaces: Object.keys(os.networkInterfaces()),
            startTime: this.metrics.system.startTime,
            uptime: this.metrics.system.uptime
        };
    }
    
    // Export metrics for external monitoring systems
    exportPrometheusMetrics() {
        const metrics = this.getCurrentMetrics();
        let output = '';
        
        // System metrics
        output += `# HELP cipherwave_cpu_usage_percent CPU usage percentage\n`;
        output += `# TYPE cipherwave_cpu_usage_percent gauge\n`;
        output += `cipherwave_cpu_usage_percent ${metrics.system.cpuUsage}\n\n`;
        
        output += `# HELP cipherwave_memory_usage_bytes Memory usage in bytes\n`;
        output += `# TYPE cipherwave_memory_usage_bytes gauge\n`;
        output += `cipherwave_memory_usage_bytes ${metrics.system.memoryUsage.rss}\n\n`;
        
        // Application metrics
        output += `# HELP cipherwave_active_connections Number of active connections\n`;
        output += `# TYPE cipherwave_active_connections gauge\n`;
        output += `cipherwave_active_connections ${metrics.application.activeConnections}\n\n`;
        
        output += `# HELP cipherwave_messages_total Total messages processed\n`;
        output += `# TYPE cipherwave_messages_total counter\n`;
        output += `cipherwave_messages_total ${metrics.application.messagesProcessed}\n\n`;
        
        output += `# HELP cipherwave_errors_total Total errors\n`;
        output += `# TYPE cipherwave_errors_total counter\n`;
        output += `cipherwave_errors_total ${metrics.application.errorsCount}\n\n`;
        
        return output;
    }
    
    // Generate health check endpoint response
    getHealthStatus() {
        const metrics = this.getCurrentMetrics();
        
        return {
            status: this.calculateOverallHealth(),
            timestamp: new Date().toISOString(),
            uptime: metrics.system.uptime,
            version: process.env.npm_package_version || '1.0.0',
            metrics: {
                cpu: metrics.system.cpuUsage,
                memory: metrics.system.memoryUsagePercent,
                connections: metrics.application.activeConnections,
                errorRate: metrics.application.errorRate,
                responseTime: metrics.application.averageResponseTime
            }
        };
    }
    
    calculateOverallHealth() {
        const metrics = this.getCurrentMetrics();
        
        if (metrics.system.cpuUsage > 95 || 
            metrics.system.memoryUsagePercent > 95 || 
            metrics.application.errorRate > 20) {
            return 'unhealthy';
        }
        
        if (metrics.system.cpuUsage > 80 || 
            metrics.system.memoryUsagePercent > 85 || 
            metrics.application.errorRate > 5 ||
            metrics.application.averageResponseTime > 2000) {
            return 'degraded';
        }
        
        return 'healthy';
    }
    
    // Shutdown monitoring
    shutdown() {
        // Clear all intervals
        this.intervals.forEach((interval, name) => {
            clearInterval(interval);
        });
        this.intervals.clear();
        
        // Final metrics collection
        this.collectMetrics();
        
        console.log(`[${new Date().toISOString()}] [INFO] Server monitoring shutdown`);
    }
}

export default ServerMonitoring;