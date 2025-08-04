// CipherWave Signaling Server with Static File Serving - Production Optimized
// Run: npm start
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import crypto from 'crypto';
import cluster from 'cluster';
import os from 'os';

// ES module compatibility
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment and Configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 52178;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_ROOM_SIZE = parseInt(process.env.MAX_ROOM_SIZE) || 2;
const MAX_MESSAGE_SIZE = parseInt(process.env.MAX_MESSAGE_SIZE) || 64 * 1024; // 64KB
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000; // 30 minutes
const WWW_DIR = path.join(__dirname, 'www');
const ENABLE_CLUSTERING = process.env.ENABLE_CLUSTERING === 'true';
const MAX_CONNECTIONS_PER_IP = parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 5;
const DDOS_PROTECTION_THRESHOLD = parseInt(process.env.DDOS_PROTECTION_THRESHOLD) || 1000; // requests per minute per IP
const AUTH_TOKEN_EXPIRY = parseInt(process.env.AUTH_TOKEN_EXPIRY) || 24 * 60 * 60 * 1000; // 24 hours
const ENABLE_AUTH = process.env.ENABLE_AUTH === 'true';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Clustering support for production scalability
if (ENABLE_CLUSTERING && cluster.isPrimary && NODE_ENV === 'production') {
    const numWorkers = process.env.NUM_WORKERS || Math.min(4, os.cpus().length);
    
    console.log(`[${new Date().toISOString()}] [INFO] Master ${process.pid} starting ${numWorkers} workers`);
    
    // Fork workers
    for (let i = 0; i < numWorkers; i++) {
        const worker = cluster.fork();
        worker.on('error', (error) => {
            console.error(`[${new Date().toISOString()}] [ERROR] Worker error: ${error.message}`);
        });
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`[${new Date().toISOString()}] [WARN] Worker ${worker.process.pid} died (${code}/${signal}). Restarting...`);
        cluster.fork();
    });
    
    // Graceful shutdown for cluster
    process.on('SIGTERM', () => {
        console.log('[INFO] Shutting down cluster...');
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
    });
    
    process.exit(0); // Exit here for master process
}

// Security headers
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
    'Referrer-Policy': 'strict-origin-when-cross-origin'
};

// CORS configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['http://localhost:3000', 'http://localhost:5173', 'https://localhost:52178'];

// Enhanced rate limiting and DDoS protection storage
const rateLimitStore = new Map();
const connectionStore = new Map(); // Track connections per IP
const ddosProtection = new Map(); // Enhanced DDoS tracking
const authTokens = new Map(); // JWT token storage for optional authentication
const ipBlacklist = new Set(); // Temporary IP blacklist for severe violations
const suspiciousActivity = new Map(); // Track suspicious patterns

// Session management
const sessions = new Map();
const sessionCleanupInterval = 5 * 60 * 1000; // 5 minutes

// Create HTTP server with enhanced security and health checks
const server = http.createServer((req, res) => {
    const clientIp = req.socket.remoteAddress || req.connection.remoteAddress;
    
    // Apply security headers
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
    
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        if (checkCORS(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Max-Age', '86400');
        }
        res.writeHead(204);
        res.end();
        return;
    }
    
    // Parse the request URL
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;
    
    // Health check endpoint
    if (pathname === '/health') {
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: Date.now() - serverStats.startTime,
            stats: {
                totalConnections: serverStats.totalConnections,
                activeConnections: serverStats.activeConnections,
                totalRooms: rooms.size,
                messagesProcessed: serverStats.messagesProcessed,
                errors: serverStats.errors
            },
            memory: process.memoryUsage(),
            version: process.version
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthData, null, 2));
        return;
    }
    
    // Metrics endpoint (basic)
    if (pathname === '/metrics') {
        const metrics = [
            `# HELP cipherwave_connections_total Total number of connections`,
            `# TYPE cipherwave_connections_total counter`,
            `cipherwave_connections_total ${serverStats.totalConnections}`,
            `# HELP cipherwave_connections_active Active connections`,
            `# TYPE cipherwave_connections_active gauge`,
            `cipherwave_connections_active ${serverStats.activeConnections}`,
            `# HELP cipherwave_rooms_total Total number of rooms`,
            `# TYPE cipherwave_rooms_total gauge`,
            `cipherwave_rooms_total ${rooms.size}`,
            `# HELP cipherwave_messages_processed_total Messages processed`,
            `# TYPE cipherwave_messages_processed_total counter`,
            `cipherwave_messages_processed_total ${serverStats.messagesProcessed}`,
            `# HELP cipherwave_errors_total Total errors`,
            `# TYPE cipherwave_errors_total counter`,
            `cipherwave_errors_total ${serverStats.errors}`
        ].join('\n');
        
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(metrics);
        return;
    }
    
    // Authentication endpoint (optional)
    if (pathname === '/auth' && req.method === 'POST') {
        if (!ENABLE_AUTH) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Authentication not enabled' }));
            return;
        }
        
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const authData = JSON.parse(body);
                
                // Simple challenge-response authentication
                if (authData.challenge === 'cipherwave' && authData.timestamp) {
                    const timeDiff = Date.now() - authData.timestamp;
                    if (timeDiff < 300000 && timeDiff > -60000) { // 5 min window
                        const token = generateAuthToken(clientIp);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            token,
                            expires: Date.now() + AUTH_TOKEN_EXPIRY
                        }));
                        return;
                    }
                }
                
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Authentication failed' }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
        return;
    }
    
    // Admin endpoint for monitoring (basic)
    if (pathname === '/admin' && req.method === 'GET') {
        // Simple admin authentication via query parameter in development only
        const query = new URLSearchParams(parsedUrl.search);
        const adminKey = query.get('key');
        
        if (NODE_ENV === 'development' && adminKey === 'admin123') {
            const adminData = {
                server: {
                    uptime: Date.now() - serverStats.startTime,
                    stats: serverStats,
                    rooms: Array.from(rooms.entries()).map(([id, clients]) => ({
                        id,
                        clientCount: clients.size
                    }))
                },
                security: {
                    blacklistedIPs: Array.from(ipBlacklist),
                    suspiciousActivity: Object.fromEntries(suspiciousActivity),
                    rateLimitedIPs: rateLimitStore.size,
                    activeConnections: connectionStore.size
                }
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(adminData, null, 2));
            return;
        }
        
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
    }
    
    // Enhanced DDoS protection and rate limiting for HTTP requests
    if (ipBlacklist.has(clientIp)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Access denied' }));
        return;
    }
    
    if (!checkDDoSProtection(clientIp) || !checkRateLimit(clientIp)) {
        res.writeHead(429, { 
            'Content-Type': 'application/json',
            'Retry-After': '300'
        });
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
        return;
    }
    
    // Serve index.html for root path
    if (pathname === '/') {
        pathname = '/index.html';
    }
    
    // Validate pathname to prevent directory traversal
    const normalizedPath = path.normalize(pathname);
    if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
        // Remove leading slash for path.join to work correctly
        pathname = normalizedPath.substring(1);
    }
    
    // Construct the file path
    const filePath = path.join(WWW_DIR, pathname);
    
    // Check if the file exists and is within the www directory
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }
        
        // Security check: ensure file is within WWW_DIR
        const resolvedPath = path.resolve(filePath);
        const resolvedWwwDir = path.resolve(WWW_DIR);
        if (!resolvedPath.startsWith(resolvedWwwDir)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Access forbidden' }));
            return;
        }
        
        // Check if it's a file (not directory)
        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Access forbidden' }));
                return;
            }
            
            // Determine content type based on file extension
            const ext = path.extname(filePath).toLowerCase();
            let contentType = 'application/octet-stream';
            
            const mimeTypes = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.js': 'text/javascript; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf',
                '.eot': 'application/vnd.ms-fontobject'
            };
            
            contentType = mimeTypes[ext] || contentType;
            
            // Read and serve the file
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    log(`Error reading file ${filePath}: ${err.message}`, 'ERROR');
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Internal server error' }));
                    return;
                }
                
                // Set caching headers for static assets
                if (ext !== '.html') {
                    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
                    res.setHeader('ETag', crypto.createHash('md5').update(data).digest('hex'));
                }
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            });
        });
    });
});

// Create WebSocket server with enhanced configuration
const wss = new WebSocketServer({ 
    server: server,
    clientTracking: true,
    maxPayload: MAX_MESSAGE_SIZE,
    perMessageDeflate: {
        // Enable compression but with limits to prevent zip bombs
        threshold: 1024,
        concurrencyLimit: 10,
        memLevel: 7
    },
    // Enhanced client verification with security checks
    verifyClient: (info) => {
        const origin = info.origin;
        const clientIp = info.req.socket.remoteAddress;
        const authHeader = info.req.headers.authorization;
        
        // Check if IP is blacklisted
        if (ipBlacklist.has(clientIp)) {
            log(`Blocked WebSocket connection from blacklisted IP: ${clientIp}`, 'WARN');
            return false;
        }
        
        // Enhanced DDoS protection
        if (!checkDDoSProtection(clientIp)) {
            log(`DDoS protection triggered for IP: ${clientIp}`, 'WARN');
            trackSuspiciousActivity(clientIp, 'ddos_protection_triggered');
            return false;
        }
        
        // Check connection limit per IP
        if (!checkConnectionLimit(clientIp, false)) {
            log(`Connection limit exceeded for IP: ${clientIp}`, 'WARN');
            trackSuspiciousActivity(clientIp, 'connection_limit_exceeded');
            return false;
        }
        
        // Check rate limiting
        if (!checkRateLimit(clientIp)) {
            log(`Rate limited WebSocket connection from IP: ${clientIp}`, 'WARN');
            trackSuspiciousActivity(clientIp, 'rate_limit_exceeded');
            return false;
        }
        
        // Optional authentication check
        if (ENABLE_AUTH) {
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                log(`Missing authentication token from IP: ${clientIp}`, 'WARN');
                return false;
            }
            
            const token = authHeader.substring(7);
            const payload = verifyAuthToken(token);
            if (!payload) {
                log(`Invalid authentication token from IP: ${clientIp}`, 'WARN');
                trackSuspiciousActivity(clientIp, 'invalid_auth_token');
                return false;
            }
            
            // Verify token IP matches connection IP
            if (payload.ip !== clientIp) {
                log(`Token IP mismatch from IP: ${clientIp}`, 'WARN');
                trackSuspiciousActivity(clientIp, 'token_ip_mismatch');
                return false;
            }
        }
        
        // Check origin in production
        if (NODE_ENV === 'production' && !checkCORS(origin)) {
            log(`Rejected WebSocket connection from unauthorized origin: ${origin}`, 'WARN');
            trackSuspiciousActivity(clientIp, 'invalid_origin');
            return false;
        }
        
        return true;
    }
});

// Store rooms and their participants
const rooms = new Map();

// Health check endpoint data
const serverStats = {
    startTime: Date.now(),
    totalConnections: 0,
    activeConnections: 0,
    totalRooms: 0,
    messagesProcessed: 0,
    errors: 0
};

// Rate limiting function
function checkRateLimit(clientIp) {
    const now = Date.now();
    const clientData = rateLimitStore.get(clientIp) || { requests: [], blocked: false };
    
    // Remove old requests outside the window
    clientData.requests = clientData.requests.filter(timestamp => 
        now - timestamp < RATE_LIMIT_WINDOW
    );
    
    // Check if client is temporarily blocked
    if (clientData.blocked && now - clientData.blockedUntil < 5 * 60 * 1000) { // 5 min block
        return false;
    }
    
    // Add current request
    clientData.requests.push(now);
    
    // Check if rate limit exceeded
    if (clientData.requests.length > RATE_LIMIT_MAX_REQUESTS) {
        clientData.blocked = true;
        clientData.blockedUntil = now;
        log(`Rate limit exceeded for IP: ${clientIp}`, 'WARN');
        return false;
    }
    
    rateLimitStore.set(clientIp, clientData);
    return true;
}

// Enhanced connection limit per IP with DDoS protection
function checkConnectionLimit(clientIp, increment = true) {
    // Check if IP is blacklisted
    if (ipBlacklist.has(clientIp)) {
        return false;
    }
    
    const current = connectionStore.get(clientIp) || 0;
    
    if (increment) {
        if (current >= MAX_CONNECTIONS_PER_IP) {
            // Track suspicious activity
            trackSuspiciousActivity(clientIp, 'connection_limit_exceeded');
            return false;
        }
        connectionStore.set(clientIp, current + 1);
    } else {
        connectionStore.set(clientIp, Math.max(0, current - 1));
    }
    
    return true;
}

// Enhanced DDoS protection
function checkDDoSProtection(clientIp) {
    const now = Date.now();
    const ddosData = ddosProtection.get(clientIp) || { requests: [], violations: 0 };
    
    // Remove old requests
    ddosData.requests = ddosData.requests.filter(timestamp => 
        now - timestamp < RATE_LIMIT_WINDOW
    );
    
    ddosData.requests.push(now);
    
    // Check for DDoS patterns
    if (ddosData.requests.length > DDOS_PROTECTION_THRESHOLD) {
        ddosData.violations++;
        
        // Blacklist IP after multiple violations
        if (ddosData.violations >= 3) {
            ipBlacklist.add(clientIp);
            log(`IP blacklisted due to DDoS activity: ${clientIp}`, 'WARN');
            
            // Auto-remove from blacklist after 1 hour
            setTimeout(() => {
                ipBlacklist.delete(clientIp);
                log(`IP removed from blacklist: ${clientIp}`, 'INFO');
            }, 60 * 60 * 1000);
        }
        
        ddosProtection.set(clientIp, ddosData);
        return false;
    }
    
    ddosProtection.set(clientIp, ddosData);
    return true;
}

// Track suspicious activity patterns
function trackSuspiciousActivity(clientIp, activityType) {
    const now = Date.now();
    const activity = suspiciousActivity.get(clientIp) || { events: [], score: 0 };
    
    activity.events.push({ type: activityType, timestamp: now });
    
    // Remove old events (last hour)
    activity.events = activity.events.filter(event => 
        now - event.timestamp < 60 * 60 * 1000
    );
    
    // Calculate suspicious score
    activity.score = activity.events.length;
    
    // Auto-blacklist high-score IPs
    if (activity.score >= 50) {
        ipBlacklist.add(clientIp);
        log(`IP auto-blacklisted due to suspicious activity score: ${clientIp} (score: ${activity.score})`, 'WARN');
    }
    
    suspiciousActivity.set(clientIp, activity);
}

// Simple JWT-like token system for optional authentication
function generateAuthToken(clientIp) {
    const payload = {
        ip: clientIp,
        issued: Date.now(),
        expires: Date.now() + AUTH_TOKEN_EXPIRY
    };
    
    const token = crypto.createHmac('sha256', JWT_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
    
    const fullToken = Buffer.from(JSON.stringify(payload)).toString('base64') + '.' + token;
    authTokens.set(fullToken, payload);
    
    return fullToken;
}

// Verify authentication token
function verifyAuthToken(token) {
    if (!token || !authTokens.has(token)) {
        return null;
    }
    
    const payload = authTokens.get(token);
    if (Date.now() > payload.expires) {
        authTokens.delete(token);
        return null;
    }
    
    return payload;
}

// Generate session ID
function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

// Create user session
function createSession(ws, clientIp) {
    const sessionId = generateSessionId();
    const session = {
        id: sessionId,
        clientIp,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messageCount: 0
    };
    
    sessions.set(sessionId, session);
    ws.sessionId = sessionId;
    return session;
}

// Update session activity
function updateSessionActivity(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
        session.lastActivity = Date.now();
        session.messageCount++;
    }
}

// Clean up expired sessions
function cleanupSessions() {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.lastActivity > SESSION_TIMEOUT) {
            sessions.delete(sessionId);
            log(`Session expired: ${sessionId}`);
        }
    }
}

// Set up session cleanup interval
setInterval(cleanupSessions, sessionCleanupInterval);

// CORS check function
function checkCORS(origin) {
    if (NODE_ENV === 'development') return true;
    return ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*');
}

// Enhanced logging function with levels and optional data
function log(message, level = 'INFO', data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    
    // In production, filter out debug messages
    if (NODE_ENV === 'production' && level === 'DEBUG') {
        return;
    }
    
    if (level === 'ERROR') {
        console.error(logEntry);
        serverStats.errors++;
        if (data) console.error('Error data:', data);
    } else if (level === 'WARN') {
        console.warn(logEntry);
        if (data) console.warn('Warning data:', data);
    } else {
        console.log(logEntry);
        if (data && NODE_ENV === 'development') {
            console.log('Additional data:', data);
        }
    }
}

// Enhanced room ID validation
function isValidRoomId(roomId) {
    if (typeof roomId !== 'string') return false;
    if (roomId.length < 3 || roomId.length > 64) return false; // More restrictive length
    // Allow alphanumeric, hyphens, and underscores only
    if (!/^[a-zA-Z0-9_-]+$/.test(roomId)) return false;
    // Prevent potential security issues
    if (roomId.includes('..') || roomId.startsWith('.') || roomId.endsWith('.')) return false;
    return true;
}

// Helper function to calculate object depth
function getObjectDepth(obj, depth = 0) {
    if (depth > 20) return depth; // Prevent infinite recursion
    if (obj === null || typeof obj !== 'object') return depth;
    
    let maxDepth = depth;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const currentDepth = getObjectDepth(obj[key], depth + 1);
            maxDepth = Math.max(maxDepth, currentDepth);
        }
    }
    return maxDepth;
}

// Enhanced message validation
function isValidMessage(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (!data.type || typeof data.type !== 'string') return false;
    if (data.type.length > 50) return false; // Limit type length
    
    // Check for suspicious properties
    const dangerousProps = ['__proto__', 'constructor', 'prototype'];
    for (const prop of dangerousProps) {
        if (prop in data) return false;
    }
    
    // Limit total properties
    if (Object.keys(data).length > 20) return false;
    
    return true;
}

// Handle new connections
wss.on('connection', function connection(ws, req) {
    // Get client IP address
    const clientIp = req.socket.remoteAddress || req.connection.remoteAddress;
    
    // Increment connection count
    checkConnectionLimit(clientIp, true);
    serverStats.totalConnections++;
    serverStats.activeConnections++;
    
    // Create session for this connection
    const session = createSession(ws, clientIp);
    
    log(`New client connected from IP: ${clientIp}, Session: ${session.id}`);
    
    // Set connection properties
    ws.clientIp = clientIp;
    ws.roomId = null;
    ws.isInitiator = false;
    ws.connectionTime = Date.now();
    ws.messageCount = 0;
    ws.lastMessageTime = Date.now();
    
    // Set up ping/pong for connection health
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
        updateSessionActivity(ws.sessionId);
    });
    
    // Set connection timeout
    const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            log(`Connection timeout for client ${clientIp}`, 'WARN');
            ws.terminate();
        }
    }, SESSION_TIMEOUT);
    
    ws.connectionTimeout = connectionTimeout;

    // Handle incoming messages
    ws.on('message', function incoming(message) {
        const now = Date.now();
        
        // Rate limiting per connection (messages per minute)
        const messageRateLimit = 60; // messages per minute
        const messageWindow = 60 * 1000; // 1 minute
        
        if (!ws.messageTimestamps) {
            ws.messageTimestamps = [];
        }
        
        // Remove old timestamps
        ws.messageTimestamps = ws.messageTimestamps.filter(timestamp => 
            now - timestamp < messageWindow
        );
        
        // Check message rate limit
        if (ws.messageTimestamps.length >= messageRateLimit) {
            log(`Message rate limit exceeded for client ${ws.clientIp}`, 'WARN');
            trackSuspiciousActivity(ws.clientIp, 'message_rate_limit_exceeded');
            
            // Escalate to temporary ban for repeated violations
            const activity = suspiciousActivity.get(ws.clientIp);
            if (activity && activity.score >= 20) {
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Connection terminated due to rate limit violations',
                    terminate: true
                }));
                ws.terminate();
                return;
            }
            
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Message rate limit exceeded' 
            }));
            return;
        }
        
        ws.messageTimestamps.push(now);
        
        // Strict message size validation
        if (message.length > MAX_MESSAGE_SIZE) {
            log(`Message too large from client ${ws.clientIp}: ${message.length} bytes`, 'WARN');
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: `Message too large. Maximum size is ${MAX_MESSAGE_SIZE} bytes` 
            }));
            return;
        }
        
        // Check for minimum time between messages (anti-spam)
        const minMessageInterval = 50; // 50ms minimum between messages
        if (now - ws.lastMessageTime < minMessageInterval) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Messages sent too quickly' 
            }));
            return;
        }
        
        ws.lastMessageTime = now;
        ws.messageCount++;
        serverStats.messagesProcessed++;
        updateSessionActivity(ws.sessionId);
        
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            log(`Invalid JSON from client ${ws.clientIp}: ${e.message}`, 'WARN');
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Invalid JSON format' 
            }));
            return;
        }
        
        // Enhanced message validation with security tracking
        if (!isValidMessage(data)) {
            log(`Invalid message structure from client ${ws.clientIp}`, 'WARN');
            trackSuspiciousActivity(ws.clientIp, 'invalid_message_structure');
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Invalid message structure' 
            }));
            return;
        }
        
        // Additional security validation for message content
        if (typeof data === 'object' && data !== null) {
            const messageStr = JSON.stringify(data);
            
            // Check for potential script injection attempts
            const dangerousPatterns = [
                /<script[^>]*>/i,
                /javascript:/i,
                /data:text\/html/i,
                /vbscript:/i,
                /on\w+\s*=/i,
                /eval\s*\(/i,
                /expression\s*\(/i
            ];
            
            for (const pattern of dangerousPatterns) {
                if (pattern.test(messageStr)) {
                    log(`Potential XSS attempt from client ${ws.clientIp}`, 'WARN');
                    trackSuspiciousActivity(ws.clientIp, 'potential_xss_attempt');
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        error: 'Message content not allowed' 
                    }));
                    return;
                }
            }
            
            // Check for excessive nesting (potential JSON bomb)
            const depth = getObjectDepth(data);
            if (depth > 10) {
                log(`Excessive object nesting from client ${ws.clientIp}`, 'WARN');
                trackSuspiciousActivity(ws.clientIp, 'excessive_object_nesting');
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Message structure too complex' 
                }));
                return;
            }
        }
        
        // Additional validation for message content
        if (data.type && typeof data.type !== 'string') {
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Invalid message type' 
            }));
            return;
        }
        
        // Validate message type whitelist
        const allowedMessageTypes = ['join', 'offer', 'answer', 'ice-candidate', 'signal', 'ping'];
        if (!allowedMessageTypes.includes(data.type)) {
            log(`Unknown message type from client ${ws.clientIp}: ${data.type}`, 'WARN');
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Unknown message type' 
            }));
            return;
        }
        
        // Handle room joining
        if (data.type === 'join') {
            const roomId = data.room;
            
            // Prevent joining multiple rooms
            if (ws.roomId) {
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Already in a room' 
                }));
                return;
            }
            
            // Enhanced room ID validation
            if (!isValidRoomId(roomId)) {
                log(`Invalid room ID from client ${ws.clientIp}: ${roomId}`, 'WARN');
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Invalid room ID format' 
                }));
                return;
            }
            
            // Check if room already has maximum clients
            const room = rooms.get(roomId);
            if (room && room.size >= MAX_ROOM_SIZE) {
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Room is full' 
                }));
                log(`Client ${ws.clientIp} attempted to join full room: ${roomId}`);
                return;
            }
            
            // Create room if it doesn't exist
            if (!room) {
                rooms.set(roomId, new Set([ws]));
                ws.isInitiator = true;
                serverStats.totalRooms = Math.max(serverStats.totalRooms, rooms.size);
                log(`Client ${ws.clientIp} created room: ${roomId}`);
            } else {
                room.add(ws);
                ws.isInitiator = false;
                log(`Client ${ws.clientIp} joined room: ${roomId} (${room.size + 1} clients)`);
            }
            
            ws.roomId = roomId;
            ws.roomJoinTime = Date.now();
            
            // Send initialization message
            try {
                ws.send(JSON.stringify({ 
                    type: 'init', 
                    initiator: ws.isInitiator,
                    sessionId: ws.sessionId
                }));
            } catch (error) {
                log(`Error sending init message to client ${ws.clientIp}: ${error.message}`, 'ERROR');
            }
            
            log(`Client ${ws.clientIp} joined room: ${roomId} (initiator: ${ws.isInitiator})`);
        } 
        // Relay signaling messages to other peers in the room
        else if (ws.roomId) {
            const room = rooms.get(ws.roomId);
            if (room) {
                let relayedCount = 0;
                room.forEach(peer => {
                    if (peer !== ws && peer.readyState === WebSocket.OPEN) {
                        try {
                            peer.send(message);
                            relayedCount++;
                        } catch (error) {
                            log(`Error relaying message to peer: ${error.message}`, 'ERROR');
                            // Remove broken connection
                            room.delete(peer);
                        }
                    }
                });
                log(`Relayed ${data.type} message from ${ws.clientIp} to ${relayedCount} peers in room ${ws.roomId}`, 'DEBUG');
            } else {
                // Room doesn't exist, client needs to rejoin
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Room no longer exists' 
                }));
            }
        } else {
            // Client not in a room
            ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Must join a room first' 
            }));
        }
    });

    // Handle connection close
    ws.on('close', function(code, reason) {
        const duration = Date.now() - ws.connectionTime;
        log(`Client ${ws.clientIp} disconnected (code: ${code}, duration: ${duration}ms, messages: ${ws.messageCount})`);
        
        // Clean up connection tracking
        checkConnectionLimit(ws.clientIp, false);
        serverStats.activeConnections--;
        
        // Clear timeouts
        if (ws.connectionTimeout) {
            clearTimeout(ws.connectionTimeout);
        }
        
        // Remove session
        if (ws.sessionId) {
            sessions.delete(ws.sessionId);
        }
        
        // Remove client from room
        if (ws.roomId) {
            const room = rooms.get(ws.roomId);
            if (room) {
                room.delete(ws);
                log(`Room ${ws.roomId} now has ${room.size} client(s)`);
                
                // Notify other peers in room about disconnection
                room.forEach(peer => {
                    if (peer.readyState === WebSocket.OPEN) {
                        try {
                            peer.send(JSON.stringify({
                                type: 'peer-disconnected',
                                timestamp: Date.now()
                            }));
                        } catch (error) {
                            log(`Error notifying peer of disconnection: ${error.message}`, 'ERROR');
                        }
                    }
                });
                
                // Clean up empty rooms
                if (room.size === 0) {
                    rooms.delete(ws.roomId);
                    log(`Room ${ws.roomId} deleted (empty)`);
                }
            }
        }
    });
    
    // Handle errors
    ws.on('error', function(error) {
        log(`WebSocket error for client ${ws.clientIp}: ${error.message}`, 'ERROR', {
            sessionId: ws.sessionId,
            roomId: ws.roomId,
            messageCount: ws.messageCount
        });
        
        // Clean up on error
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({
                    type: 'error',
                    error: 'Connection error occurred'
                }));
            } catch (e) {
                // Ignore send errors during error handling
            }
        }
    });
});

// Enhanced heartbeat with connection monitoring
const heartbeatInterval = setInterval(() => {
    const deadConnections = [];
    
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            deadConnections.push(ws);
            return ws.terminate();
        }
        
        // Check for idle connections
        const idleTime = Date.now() - ws.lastMessageTime;
        if (idleTime > SESSION_TIMEOUT) {
            log(`Terminating idle connection from ${ws.clientIp}`, 'DEBUG');
            return ws.terminate();
        }
        
        ws.isAlive = false;
        try {
            ws.ping();
        } catch (error) {
            log(`Error pinging client ${ws.clientIp}: ${error.message}`, 'ERROR');
            ws.terminate();
        }
    });
    
    if (deadConnections.length > 0) {
        log(`Cleaned up ${deadConnections.length} dead connections`);
    }
    
    // Log current stats
    log(`Active connections: ${serverStats.activeConnections}, Rooms: ${rooms.size}`, 'DEBUG');
}, 30000);

// Enhanced cleanup with performance monitoring
setInterval(() => {
    const cleanupStart = Date.now();
    const now = Date.now();
    let cleanedRateLimit = 0;
    let cleanedConnections = 0;
    let cleanedAuth = 0;
    let cleanedSuspicious = 0;
    
    // Cleanup rate limit store
    for (const [ip, data] of rateLimitStore.entries()) {
        // Remove old entries
        const oldLength = data.requests.length;
        data.requests = data.requests.filter(timestamp => 
            now - timestamp < RATE_LIMIT_WINDOW
        );
        
        // Remove empty entries
        if (data.requests.length === 0 && !data.blocked) {
            rateLimitStore.delete(ip);
            cleanedRateLimit++;
        }
    }
    
    // Clean up connection store
    for (const [ip, count] of connectionStore.entries()) {
        if (count <= 0) {
            connectionStore.delete(ip);
            cleanedConnections++;
        }
    }
    
    // Clean up DDoS protection store
    for (const [ip, data] of ddosProtection.entries()) {
        data.requests = data.requests.filter(timestamp => 
            now - timestamp < RATE_LIMIT_WINDOW
        );
        
        if (data.requests.length === 0 && data.violations === 0) {
            ddosProtection.delete(ip);
        }
    }
    
    // Clean up expired auth tokens
    for (const [token, payload] of authTokens.entries()) {
        if (now > payload.expires) {
            authTokens.delete(token);
            cleanedAuth++;
        }
    }
    
    // Clean up old suspicious activity
    for (const [ip, activity] of suspiciousActivity.entries()) {
        activity.events = activity.events.filter(event => 
            now - event.timestamp < 60 * 60 * 1000
        );
        
        if (activity.events.length === 0) {
            suspiciousActivity.delete(ip);
            cleanedSuspicious++;
        } else {
            activity.score = activity.events.length;
        }
    }
    
    const cleanupDuration = Date.now() - cleanupStart;
    if (cleanupDuration > 100) { // Log if cleanup takes more than 100ms
        log(`Cleanup took ${cleanupDuration}ms - cleaned: ${cleanedRateLimit} rate limits, ${cleanedConnections} connections, ${cleanedAuth} auth tokens, ${cleanedSuspicious} suspicious activities`, 'DEBUG');
    }
    
    // Memory usage monitoring
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
        log(`High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap used`, 'WARN');
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Handle server errors
wss.on('error', function(error) {
    log(`WebSocket server error: ${error.message}`, 'ERROR');
});

// Start the HTTP server
server.listen(PORT, HOST, () => {
    const processInfo = cluster.isWorker ? ` (Worker ${process.pid})` : '';
    log(`CipherWave server running on ${HOST}:${PORT}${processInfo}`);
    log(`HTTP server accessible at http://${HOST}:${PORT}`);
    log(`WebSocket server accessible at ws://${HOST}:${PORT}`);
    log(`Server started at: ${new Date().toLocaleString()}`);
    log(`Node.js version: ${process.version}`);
    log(`Environment: ${NODE_ENV}`);
    log(`Maximum room size: ${MAX_ROOM_SIZE} clients`);
    log(`Maximum message size: ${MAX_MESSAGE_SIZE} bytes`);
    log(`Rate limit: ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW / 1000}s`);
    log(`Max connections per IP: ${MAX_CONNECTIONS_PER_IP}`);
    log(`DDoS protection threshold: ${DDOS_PROTECTION_THRESHOLD} requests/min`);
    log(`Authentication: ${ENABLE_AUTH ? 'Enabled' : 'Disabled'}`);
    log(`Clustering: ${ENABLE_CLUSTERING ? 'Enabled' : 'Disabled'}`);
    
    // Log memory usage at startup
    const memUsage = process.memoryUsage();
    log(`Initial memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS`);
});

// Enhanced graceful shutdown
function gracefulShutdown(signal) {
    log(`${signal} received, initiating graceful shutdown`);
    
    // Clear intervals
    clearInterval(heartbeatInterval);
    
    // Notify all clients about shutdown
    const shutdownMessage = JSON.stringify({
        type: 'server-shutdown',
        message: 'Server is shutting down',
        timestamp: Date.now()
    });
    
    const clientPromises = [];
    wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(shutdownMessage);
                clientPromises.push(new Promise(resolve => {
                    ws.close();
                    setTimeout(resolve, 1000); // Give clients time to close
                }));
            } catch (error) {
                ws.terminate();
            }
        } else {
            ws.terminate();
        }
    });
    
    // Wait for clients to disconnect or timeout
    Promise.all(clientPromises).then(() => {
        server.close(() => {
            log('Server closed gracefully');
            process.exit(0);
        });
    }).catch(() => {
        log('Force closing server');
        server.close(() => {
            process.exit(1);
        });
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
        log('Force shutdown timeout reached');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    log(`Uncaught exception: ${err.message}`, 'ERROR');
    console.error(err.stack);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled rejection at: ${promise}, reason: ${reason}`, 'ERROR');
    process.exit(1);
});
