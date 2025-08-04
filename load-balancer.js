// CipherWave Load Balancer
// Distributes connections across multiple server instances

import { EventEmitter } from 'events';
import http from 'http';
import httpProxy from 'http-proxy';

class LoadBalancer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            port: options.port || 8080,
            host: options.host || '0.0.0.0',
            algorithm: options.algorithm || 'round-robin', // round-robin, least-connections, weighted
            healthCheckInterval: options.healthCheckInterval || 30000,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            timeout: options.timeout || 30000,
            sticky: options.sticky || false, // Session stickiness
            ...options
        };
        
        this.servers = new Map();
        this.currentIndex = 0;
        this.proxy = httpProxy.createProxyServer({
            ws: true, // Enable WebSocket proxying
            timeout: this.options.timeout,
            proxyTimeout: this.options.timeout
        });
        
        this.server = null;
        this.healthCheckInterval = null;
        this.stickyTable = new Map(); // For session stickiness
        
        this.setupProxyEvents();
    }
    
    setupProxyEvents() {
        this.proxy.on('error', (err, req, res) => {
            console.error(`[${new Date().toISOString()}] [ERROR] Proxy error:`, err.message);
            this.handleProxyError(err, req, res);
        });
        
        this.proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add custom headers
            proxyReq.setHeader('X-Forwarded-For', req.connection.remoteAddress);
            proxyReq.setHeader('X-Load-Balancer', 'CipherWave-LB');
        });
        
        this.proxy.on('proxyRes', (proxyRes, req, res) => {
            // Add response headers
            proxyRes.headers['X-Load-Balancer'] = 'CipherWave-LB';
        });
    }
    
    // Add a backend server
    addServer(id, config) {
        const server = {
            id: id,
            host: config.host || 'localhost',
            port: config.port,
            weight: config.weight || 1,
            healthy: true,
            connections: 0,
            totalConnections: 0,
            errors: 0,
            lastError: null,
            responseTime: 0,
            lastHealthCheck: 0,
            ...config
        };
        
        this.servers.set(id, server);
        console.log(`[${new Date().toISOString()}] [INFO] Added server: ${id} (${server.host}:${server.port})`);
        
        this.emit('serverAdded', server);
        return server;
    }
    
    // Remove a backend server
    removeServer(id) {
        const server = this.servers.get(id);
        if (server) {
            this.servers.delete(id);
            console.log(`[${new Date().toISOString()}] [INFO] Removed server: ${id}`);
            this.emit('serverRemoved', server);
        }
    }
    
    // Get healthy servers
    getHealthyServers() {
        return Array.from(this.servers.values()).filter(server => server.healthy);
    }
    
    // Select next server based on algorithm
    selectServer(req) {
        const healthyServers = this.getHealthyServers();
        
        if (healthyServers.length === 0) {
            throw new Error('No healthy servers available');
        }
        
        let selectedServer;
        
        // Check for sticky session
        if (this.options.sticky && req.headers.cookie) {
            const sessionId = this.extractSessionId(req.headers.cookie);
            if (sessionId && this.stickyTable.has(sessionId)) {
                const serverId = this.stickyTable.get(sessionId);
                const server = this.servers.get(serverId);
                if (server && server.healthy) {
                    return server;
                }
            }
        }
        
        switch (this.options.algorithm) {
            case 'round-robin':
                selectedServer = this.roundRobinSelection(healthyServers);
                break;
            case 'least-connections':
                selectedServer = this.leastConnectionsSelection(healthyServers);
                break;
            case 'weighted':
                selectedServer = this.weightedSelection(healthyServers);
                break;
            case 'response-time':
                selectedServer = this.responseTimeSelection(healthyServers);
                break;
            default:
                selectedServer = this.roundRobinSelection(healthyServers);
        }
        
        // Update sticky session
        if (this.options.sticky && req.headers.cookie) {
            const sessionId = this.extractSessionId(req.headers.cookie);
            if (sessionId) {
                this.stickyTable.set(sessionId, selectedServer.id);
            }
        }
        
        return selectedServer;
    }
    
    roundRobinSelection(servers) {
        const server = servers[this.currentIndex % servers.length];
        this.currentIndex = (this.currentIndex + 1) % servers.length;
        return server;
    }
    
    leastConnectionsSelection(servers) {
        return servers.reduce((min, server) => 
            server.connections < min.connections ? server : min
        );
    }
    
    weightedSelection(servers) {
        const totalWeight = servers.reduce((sum, server) => sum + server.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const server of servers) {
            random -= server.weight;
            if (random <= 0) {
                return server;
            }
        }
        
        return servers[0]; // Fallback
    }
    
    responseTimeSelection(servers) {
        return servers.reduce((fastest, server) => 
            server.responseTime < fastest.responseTime ? server : fastest
        );
    }
    
    extractSessionId(cookie) {
        const match = cookie.match(/sessionId=([^;]+)/);
        return match ? match[1] : null;
    }
    
    // Handle HTTP requests
    handleRequest(req, res) {
        const startTime = Date.now();
        
        try {
            const server = this.selectServer(req);
            const target = `http://${server.host}:${server.port}`;
            
            // Update connection count
            server.connections++;
            server.totalConnections++;
            
            // Proxy the request
            this.proxy.web(req, res, { 
                target: target,
                changeOrigin: true
            }, (error) => {
                this.handleRequestComplete(server, startTime, error);
            });
            
            // Handle response completion
            res.on('finish', () => {
                this.handleRequestComplete(server, startTime);
            });
            
        } catch (error) {
            this.handleProxyError(error, req, res);
        }
    }
    
    // Handle WebSocket upgrades
    handleUpgrade(req, socket, head) {
        try {
            const server = this.selectServer(req);
            const target = `http://${server.host}:${server.port}`;
            
            server.connections++;
            server.totalConnections++;
            
            this.proxy.ws(req, socket, head, { target: target });
            
            // Handle WebSocket close
            socket.on('close', () => {
                server.connections = Math.max(0, server.connections - 1);
            });
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] [ERROR] WebSocket upgrade error:`, error);
            socket.destroy();
        }
    }
    
    handleRequestComplete(server, startTime, error = null) {
        const responseTime = Date.now() - startTime;
        
        // Update server statistics
        server.connections = Math.max(0, server.connections - 1);
        server.responseTime = (server.responseTime + responseTime) / 2; // Moving average
        
        if (error) {
            server.errors++;
            server.lastError = {
                timestamp: Date.now(),
                message: error.message
            };
            
            // Mark server as unhealthy if too many errors
            if (server.errors > 10) {
                server.healthy = false;
                console.warn(`[${new Date().toISOString()}] [WARN] Server ${server.id} marked as unhealthy due to errors`);
            }
        }
        
        this.emit('requestComplete', { server, responseTime, error });
    }
    
    handleProxyError(error, req, res) {
        console.error(`[${new Date().toISOString()}] [ERROR] Load balancer error:`, error.message);
        
        if (res && !res.headersSent) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Service Unavailable',
                message: 'All backend servers are currently unavailable',
                timestamp: new Date().toISOString()
            }));
        }
        
        this.emit('error', error);
    }
    
    // Health check implementation
    async performHealthCheck(server) {
        const startTime = Date.now();
        
        try {
            const healthUrl = `http://${server.host}:${server.port}/health`;
            
            const response = await fetch(healthUrl, {
                method: 'GET',
                timeout: 5000,
                headers: {
                    'User-Agent': 'CipherWave-LoadBalancer-HealthCheck'
                }
            });
            
            const responseTime = Date.now() - startTime;
            const wasHealthy = server.healthy;
            
            if (response.ok) {
                server.healthy = true;
                server.errors = Math.max(0, server.errors - 1); // Gradually reduce error count
                server.responseTime = responseTime;
                server.lastHealthCheck = Date.now();
                
                if (!wasHealthy) {
                    console.log(`[${new Date().toISOString()}] [INFO] Server ${server.id} is back online`);
                    this.emit('serverHealthy', server);
                }
            } else {
                throw new Error(`Health check failed with status: ${response.status}`);
            }
            
        } catch (error) {
            const wasHealthy = server.healthy;
            server.healthy = false;
            server.errors++;
            server.lastError = {
                timestamp: Date.now(),
                message: error.message
            };
            server.lastHealthCheck = Date.now();
            
            if (wasHealthy) {
                console.error(`[${new Date().toISOString()}] [ERROR] Server ${server.id} health check failed:`, error.message);
                this.emit('serverUnhealthy', server);
            }
        }
    }
    
    startHealthChecks() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.healthCheckInterval = setInterval(async () => {
            const healthPromises = Array.from(this.servers.values()).map(server => 
                this.performHealthCheck(server)
            );
            
            await Promise.allSettled(healthPromises);
            
            const healthyCount = this.getHealthyServers().length;
            const totalCount = this.servers.size;
            
            console.log(`[${new Date().toISOString()}] [INFO] Health check complete: ${healthyCount}/${totalCount} servers healthy`);
            
        }, this.options.healthCheckInterval);
        
        console.log(`[${new Date().toISOString()}] [INFO] Health checks started (interval: ${this.options.healthCheckInterval}ms)`);
    }
    
    stopHealthChecks() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
    
    // Start the load balancer
    start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });
            
            // Handle WebSocket upgrades
            this.server.on('upgrade', (req, socket, head) => {
                this.handleUpgrade(req, socket, head);
            });
            
            this.server.on('error', (error) => {
                console.error(`[${new Date().toISOString()}] [ERROR] Load balancer server error:`, error);
                this.emit('error', error);
            });
            
            this.server.listen(this.options.port, this.options.host, () => {
                console.log(`[${new Date().toISOString()}] [INFO] Load balancer started on ${this.options.host}:${this.options.port}`);
                console.log(`[${new Date().toISOString()}] [INFO] Algorithm: ${this.options.algorithm}`);
                console.log(`[${new Date().toISOString()}] [INFO] Sticky sessions: ${this.options.sticky ? 'enabled' : 'disabled'}`);
                
                this.startHealthChecks();
                resolve();
            });
        });
    }
    
    // Stop the load balancer
    stop() {
        return new Promise((resolve) => {
            this.stopHealthChecks();
            
            if (this.server) {
                this.server.close(() => {
                    console.log(`[${new Date().toISOString()}] [INFO] Load balancer stopped`);
                    resolve();
                });
            } else {
                resolve();
            }
            
            if (this.proxy) {
                this.proxy.close();
            }
        });
    }
    
    // Get load balancer statistics
    getStats() {
        const servers = Array.from(this.servers.values());
        const healthyServers = servers.filter(s => s.healthy);
        
        return {
            totalServers: servers.length,
            healthyServers: healthyServers.length,
            totalConnections: servers.reduce((sum, s) => sum + s.totalConnections, 0),
            activeConnections: servers.reduce((sum, s) => sum + s.connections, 0),
            totalErrors: servers.reduce((sum, s) => sum + s.errors, 0),
            averageResponseTime: servers.length > 0 ? 
                servers.reduce((sum, s) => sum + s.responseTime, 0) / servers.length : 0,
            algorithm: this.options.algorithm,
            stickySessionsEnabled: this.options.sticky,
            activeSessions: this.stickyTable.size,
            servers: servers.map(s => ({
                id: s.id,
                host: s.host,
                port: s.port,
                healthy: s.healthy,
                connections: s.connections,
                totalConnections: s.totalConnections,
                errors: s.errors,
                responseTime: s.responseTime,
                weight: s.weight,
                lastHealthCheck: s.lastHealthCheck
            }))
        };
    }
    
    // Get server by ID
    getServer(id) {
        return this.servers.get(id);
    }
    
    // Update server configuration
    updateServer(id, config) {
        const server = this.servers.get(id);
        if (server) {
            Object.assign(server, config);
            console.log(`[${new Date().toISOString()}] [INFO] Updated server ${id} configuration`);
            this.emit('serverUpdated', server);
        }
    }
    
    // Drain server (stop sending new requests)
    drainServer(id) {
        const server = this.servers.get(id);
        if (server) {
            server.draining = true;
            console.log(`[${new Date().toISOString()}] [INFO] Draining server ${id}`);
            this.emit('serverDraining', server);
        }
    }
    
    // Clear sticky sessions
    clearStickySessions() {
        this.stickyTable.clear();
        console.log(`[${new Date().toISOString()}] [INFO] Cleared all sticky sessions`);
    }
}

export default LoadBalancer;