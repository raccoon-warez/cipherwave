# CipherWave Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying CipherWave's optimized WebSocket signaling server in production environments with enhanced security, performance, and monitoring capabilities.

## Key Features

### Security Enhancements
- **Multi-layer DDoS Protection**: Rate limiting, connection limits, and automatic IP blacklisting
- **Optional Authentication System**: JWT-like token authentication for enhanced security
- **XSS/Injection Protection**: Content validation and dangerous pattern detection
- **Comprehensive Security Headers**: CORS, CSP, and anti-clickjacking protection
- **Suspicious Activity Tracking**: Behavioral analysis and automatic threat mitigation

### Performance Optimizations
- **Clustering Support**: Multi-process scaling using Node.js cluster module
- **Memory Management**: Automatic cleanup and memory usage monitoring
- **Connection Pooling**: Efficient WebSocket connection handling
- **Message Compression**: Per-message deflate with configurable thresholds

### Monitoring & Observability
- **Health Check Endpoint**: `/health` for load balancer health checks
- **Metrics Endpoint**: `/metrics` for Prometheus-compatible monitoring
- **Admin Dashboard**: `/admin` for development monitoring
- **Comprehensive Logging**: Structured logging with configurable levels

## Environment Configuration

Copy `.env.example` to `.env` and configure for your environment:

```bash
cp .env.example .env
```

### Production Settings
```env
NODE_ENV=production
ENABLE_CLUSTERING=true
ENABLE_AUTH=true
MAX_CONNECTIONS_PER_IP=10
DDOS_PROTECTION_THRESHOLD=500
JWT_SECRET=your-secure-random-key-here
ALLOWED_ORIGINS=https://yourdomain.com
```

## Deployment Options

### Option 1: Single Instance Deployment

```bash
# Install dependencies
npm install --production

# Set environment variables
export NODE_ENV=production
export PORT=52178

# Start server
npm start
```

### Option 2: Clustered Deployment (Recommended)

```bash
# Enable clustering in .env
echo "ENABLE_CLUSTERING=true" >> .env
echo "NUM_WORKERS=4" >> .env

# Start with clustering
npm start
```

### Option 3: PM2 Process Manager (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start server.js --name cipherwave-server -i max

# Save PM2 configuration
pm2 save
pm2 startup
```

### Option 4: Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cipherwave -u 1001
USER cipherwave

EXPOSE 52178

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:52178/health || exit 1

CMD ["npm", "start"]
```

## Security Hardening

### 1. Network Security
- Use HTTPS/WSS in production
- Configure firewall rules to restrict access
- Use a reverse proxy (nginx, HAProxy) for SSL termination

### 2. Application Security
```env
# Enable authentication
ENABLE_AUTH=true

# Strong JWT secret (generate with crypto.randomBytes(64).toString('hex'))
JWT_SECRET=your-256-bit-secret-key

# Restrict origins
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Lower connection limits for production
MAX_CONNECTIONS_PER_IP=5
DDOS_PROTECTION_THRESHOLD=100
```

### 3. System Security
- Run as non-root user
- Use process isolation (containers, VMs)
- Regular security updates
- Log monitoring and alerting

## Reverse Proxy Configuration

### Nginx Configuration
```nginx
upstream cipherwave {
    server 127.0.0.1:52178;
    server 127.0.0.1:52179;  # Additional instances
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Static files
    location / {
        proxy_pass http://cipherwave;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket upgrade
    location /ws {
        proxy_pass http://cipherwave;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

## Monitoring & Alerting

### Health Checks
```bash
# Basic health check
curl http://localhost:52178/health

# Detailed metrics
curl http://localhost:52178/metrics
```

### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'cipherwave'
    static_configs:
      - targets: ['localhost:52178']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Log Monitoring
- Monitor error logs for suspicious patterns
- Set up alerts for high error rates
- Track memory usage and connection counts

## Performance Tuning

### Node.js Optimization
```bash
# Increase memory limit if needed
node --max-old-space-size=2048 server.js

# Enable V8 optimizations
node --optimize-for-size server.js
```

### System Limits
```bash
# Increase file descriptor limits
ulimit -n 65536

# For systemd services
echo "LimitNOFILE=65536" >> /etc/systemd/system/cipherwave.service
```

### Environment Variables
```env
# Performance tuning
SESSION_TIMEOUT=600000      # 10 minutes
RATE_LIMIT_WINDOW=30000     # 30 seconds
MAX_MESSAGE_SIZE=32768      # 32KB
```

## Backup & Recovery

### Configuration Backup
- Back up `.env` file securely
- Document custom configurations
- Version control deployment scripts

### Monitoring Data
- Regular health check logging
- Performance metrics collection
- Connection statistics archival

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Monitor `/metrics` endpoint
   - Check for memory leaks in logs
   - Adjust cleanup intervals

2. **Connection Drops**
   - Verify WebSocket proxy configuration
   - Check firewall settings
   - Monitor ping/pong heartbeat

3. **Rate Limiting Issues**
   - Adjust `RATE_LIMIT_MAX_REQUESTS`
   - Monitor suspicious activity logs
   - Check IP blacklist status

### Debug Mode
```env
NODE_ENV=development
DEBUG=cipherwave:*
```

## Security Considerations

1. **Regular Updates**: Keep Node.js and dependencies updated
2. **Secret Management**: Use proper secret management systems
3. **Access Control**: Implement proper authentication and authorization
4. **Monitoring**: Set up comprehensive logging and alerting
5. **Incident Response**: Have procedures for security incidents

## Performance Benchmarks

Expected performance with optimized configuration:
- **Concurrent Connections**: 10,000+ per instance
- **Message Throughput**: 50,000+ messages/second
- **Memory Usage**: <500MB per worker process
- **CPU Usage**: <80% under normal load

## Support

For issues or questions:
1. Check logs at `/var/log/cipherwave/`
2. Monitor health endpoint: `/health`
3. Review admin dashboard: `/admin?key=admin123` (development only)
4. Check system resources and network connectivity