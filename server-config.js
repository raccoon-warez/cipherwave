// CipherWave Server Configuration Manager
// Centralized configuration management with environment validation

import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ServerConfig {
    constructor() {
        this.config = this.loadConfiguration();
        this.validateConfiguration();
    }

    loadConfiguration() {
        return {
            // Core Server Settings
            server: {
                nodeEnv: process.env.NODE_ENV || 'development',
                port: parseInt(process.env.PORT) || 52178,
                host: process.env.HOST || '0.0.0.0',
                wwwDir: path.join(__dirname, 'www'),
                logLevel: process.env.LOG_LEVEL || 'info',
                debugMode: process.env.DEBUG_MODE === 'true',
                verboseLogging: process.env.VERBOSE_LOGGING === 'true'
            },

            // Room and Connection Management
            rooms: {
                maxRoomSize: parseInt(process.env.MAX_ROOM_SIZE) || 2,
                maxConnectionsPerIp: parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 5,
                sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000, // 30 minutes
                roomCleanupInterval: parseInt(process.env.ROOM_CLEANUP_INTERVAL) || 5 * 60 * 1000, // 5 minutes
                maxRoomsTotal: parseInt(process.env.MAX_ROOMS_TOTAL) || 10000,
                roomIdleTimeout: parseInt(process.env.ROOM_IDLE_TIMEOUT) || 60 * 60 * 1000 // 1 hour
            },

            // Security Configuration
            security: {
                maxMessageSize: parseInt(process.env.MAX_MESSAGE_SIZE) || 64 * 1024, // 64KB
                enableAuth: process.env.ENABLE_AUTH === 'true',
                jwtSecret: process.env.JWT_SECRET || this.generateSecureSecret(),
                authTokenExpiry: parseInt(process.env.AUTH_TOKEN_EXPIRY) || 24 * 60 * 60 * 1000, // 24 hours
                encryptionKey: process.env.ENCRYPTION_KEY || this.generateEncryptionKey(),
                allowedOrigins: this.parseOrigins(process.env.ALLOWED_ORIGINS),
                trustedProxies: this.parseProxies(process.env.TRUSTED_PROXIES),
                csrfProtection: process.env.CSRF_PROTECTION !== 'false',
                contentSecurityPolicy: process.env.CSP_POLICY || "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
            },

            // Rate Limiting & DDoS Protection
            rateLimiting: {
                window: parseInt(process.env.RATE_LIMIT_WINDOW) || 60 * 1000, // 1 minute
                maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
                ddosThreshold: parseInt(process.env.DDOS_PROTECTION_THRESHOLD) || 1000,
                burstLimit: parseInt(process.env.BURST_LIMIT) || 20,
                slowDown: {
                    windowMs: parseInt(process.env.SLOWDOWN_WINDOW) || 15 * 60 * 1000, // 15 minutes
                    delayAfter: parseInt(process.env.SLOWDOWN_DELAY_AFTER) || 50,
                    delayMs: parseInt(process.env.SLOWDOWN_DELAY_MS) || 500
                },
                ipWhitelist: this.parseIpList(process.env.IP_WHITELIST),
                ipBlacklist: this.parseIpList(process.env.IP_BLACKLIST)
            },

            // Clustering Configuration
            clustering: {
                enabled: process.env.ENABLE_CLUSTERING === 'true',
                numWorkers: parseInt(process.env.NUM_WORKERS) || Math.min(4, require('os').cpus().length),
                restartThreshold: parseInt(process.env.WORKER_RESTART_THRESHOLD) || 10,
                restartDelay: parseInt(process.env.WORKER_RESTART_DELAY) || 1000,
                workerTimeout: parseInt(process.env.WORKER_TIMEOUT) || 30000
            },

            // WebSocket Configuration
            websocket: {
                pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL) || 30000,
                pongTimeout: parseInt(process.env.WEBSOCKET_PONG_TIMEOUT) || 5000,
                maxPayloadSize: parseInt(process.env.WEBSOCKET_MAX_PAYLOAD) || 64 * 1024,
                compression: {
                    enabled: process.env.WEBSOCKET_COMPRESSION !== 'false',
                    threshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024,
                    concurrencyLimit: parseInt(process.env.COMPRESSION_CONCURRENCY) || 10,
                    memLevel: parseInt(process.env.COMPRESSION_MEM_LEVEL) || 7
                },
                connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT) || 30000,
                maxConnections: parseInt(process.env.MAX_TOTAL_CONNECTIONS) || 10000
            },

            // Monitoring & Metrics
            monitoring: {
                enabled: process.env.ENABLE_METRICS === 'true',
                port: parseInt(process.env.METRICS_PORT) || 9090,
                interval: parseInt(process.env.METRICS_INTERVAL) || 15000,
                retentionPeriod: parseInt(process.env.METRICS_RETENTION) || 7 * 24 * 60 * 60 * 1000, // 7 days
                healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
                performanceThresholds: {
                    cpuUsage: parseFloat(process.env.CPU_THRESHOLD) || 80,
                    memoryUsage: parseFloat(process.env.MEMORY_THRESHOLD) || 85,
                    responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 1000,
                    errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD) || 5
                }
            },

            // Redis Configuration
            redis: {
                enabled: process.env.REDIS_URL !== undefined,
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                password: process.env.REDIS_PASSWORD,
                db: parseInt(process.env.REDIS_DB) || 0,
                keyPrefix: process.env.REDIS_KEY_PREFIX || 'cipherwave:',
                ttl: parseInt(process.env.REDIS_TTL) || 24 * 60 * 60, // 24 hours
                maxRetries: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
                retryDelay: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
                connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT) || 5000
            },

            // Database Configuration (PostgreSQL)
            database: {
                enabled: process.env.DATABASE_URL !== undefined,
                url: process.env.DATABASE_URL,
                pool: {
                    min: parseInt(process.env.DB_POOL_MIN) || 2,
                    max: parseInt(process.env.DB_POOL_MAX) || 20,
                    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
                    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000
                },
                migrations: {
                    enabled: process.env.RUN_MIGRATIONS !== 'false',
                    directory: './migrations'
                }
            },

            // SSL/TLS Configuration
            ssl: {
                enabled: process.env.SSL_ENABLED === 'true',
                certPath: process.env.SSL_CERT_PATH,
                keyPath: process.env.SSL_KEY_PATH,
                caPath: process.env.SSL_CA_PATH,
                passphrase: process.env.SSL_PASSPHRASE,
                requestCert: process.env.SSL_REQUEST_CERT === 'true',
                rejectUnauthorized: process.env.SSL_REJECT_UNAUTHORIZED !== 'false'
            },

            // TURN Server Configuration
            turn: {
                enabled: process.env.TURN_SERVER_URL !== undefined,
                urls: process.env.TURN_SERVER_URL,
                username: process.env.TURN_USERNAME,
                password: process.env.TURN_PASSWORD,
                ttl: parseInt(process.env.TURN_TTL) || 86400 // 24 hours
            },

            // Backup and Recovery
            backup: {
                enabled: process.env.BACKUP_ENABLED === 'true',
                interval: parseInt(process.env.BACKUP_INTERVAL) || 24 * 60 * 60 * 1000, // 24 hours
                retention: parseInt(process.env.BACKUP_RETENTION) || 7, // 7 days
                path: process.env.BACKUP_PATH || './backups',
                compress: process.env.BACKUP_COMPRESS !== 'false'
            },

            // Logging Configuration
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                format: process.env.LOG_FORMAT || 'json',
                file: {
                    enabled: process.env.LOG_FILE_ENABLED === 'true',
                    path: process.env.LOG_FILE_PATH || './logs',
                    maxSize: process.env.LOG_MAX_SIZE || '100MB',
                    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 10,
                    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
                },
                syslog: {
                    enabled: process.env.SYSLOG_ENABLED === 'true',
                    host: process.env.SYSLOG_HOST || 'localhost',
                    port: parseInt(process.env.SYSLOG_PORT) || 514,
                    facility: process.env.SYSLOG_FACILITY || 'local0'
                }
            }
        };
    }

    generateSecureSecret() {
        return crypto.randomBytes(64).toString('hex');
    }

    generateEncryptionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    parseOrigins(originsStr) {
        if (!originsStr) {
            return ['http://localhost:3000', 'http://localhost:5173', 'https://localhost:52178'];
        }
        return originsStr.split(',').map(origin => origin.trim());
    }

    parseProxies(proxiesStr) {
        if (!proxiesStr) return [];
        return proxiesStr.split(',').map(proxy => proxy.trim());
    }

    parseIpList(ipStr) {
        if (!ipStr) return [];
        return ipStr.split(',').map(ip => ip.trim());
    }

    validateConfiguration() {
        const errors = [];

        // Validate required settings
        if (this.config.server.port < 1 || this.config.server.port > 65535) {
            errors.push('Invalid port number');
        }

        if (this.config.rooms.maxRoomSize < 1 || this.config.rooms.maxRoomSize > 50) {
            errors.push('Invalid max room size (must be 1-50)');
        }

        if (this.config.security.enableAuth && !this.config.security.jwtSecret) {
            errors.push('JWT secret is required when authentication is enabled');
        }

        if (this.config.ssl.enabled) {
            if (!this.config.ssl.certPath || !this.config.ssl.keyPath) {
                errors.push('SSL certificate and key paths are required when SSL is enabled');
            }
        }

        if (this.config.clustering.enabled && this.config.clustering.numWorkers < 1) {
            errors.push('Number of workers must be at least 1');
        }

        if (this.config.monitoring.enabled && 
            (this.config.monitoring.port < 1 || this.config.monitoring.port > 65535)) {
            errors.push('Invalid metrics port number');
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }

    get(section, key) {
        if (key) {
            return this.config[section]?.[key];
        }
        return this.config[section];
    }

    isDevelopment() {
        return this.config.server.nodeEnv === 'development';
    }

    isProduction() {
        return this.config.server.nodeEnv === 'production';
    }

    getSecurityHeaders() {
        return {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': this.config.security.contentSecurityPolicy,
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        };
    }

    getLogConfiguration() {
        return {
            level: this.config.logging.level,
            format: this.config.logging.format,
            transports: []
        };
    }
}

export default ServerConfig;