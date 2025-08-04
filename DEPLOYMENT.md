# CipherWave Deployment Guide

## 🚀 Production Deployment

This guide covers deploying CipherWave in production environments with security, scalability, and reliability best practices.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Security Configuration](#security-configuration)
- [Container Deployment](#container-deployment)
- [Load Balancing](#load-balancing)
- [Monitoring & Logging](#monitoring--logging)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Backup & Recovery](#backup--recovery)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 1Gbps

**Recommended for Production:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+ SSD
- Network: 10Gbps

### Software Dependencies

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **Docker**: v20.10.0+ (optional)
- **Docker Compose**: v2.0.0+ (optional)
- **nginx**: v1.20.0+ (for reverse proxy)
- **Let's Encrypt**: For SSL certificates

## Environment Setup

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install system dependencies
sudo apt-get install -y build-essential git nginx certbot python3-certbot-nginx

# Create deployment user
sudo useradd -m -s /bin/bash cipherwave
sudo usermod -aG sudo cipherwave
```

### 2. Application Deployment

```bash
# Switch to deployment user
sudo su - cipherwave

# Clone repository
git clone https://github.com/your-org/cipherwave.git
cd cipherwave

# Install dependencies
npm ci --production

# Create production environment file
cp .env.example .env.production
```

### 3. Environment Variables

Create `.env.production`:

```bash
# Server Configuration
NODE_ENV=production
PORT=8081
HOST=0.0.0.0

# Security
JWT_SECRET=your-super-secure-jwt-secret-here
ENABLE_AUTH=true
AUTH_TOKEN_EXPIRY=86400000

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
MAX_CONNECTIONS_PER_IP=10
DDOS_PROTECTION_THRESHOLD=1000

# SSL/TLS
SSL_ENABLED=true
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem

# Clustering
ENABLE_CLUSTERING=true
NUM_WORKERS=4

# Database (if using persistent storage)
DATABASE_URL=postgresql://user:pass@localhost:5432/cipherwave

# Monitoring
ENABLE_MONITORING=true
LOG_LEVEL=info
METRICS_ENDPOINT=/metrics

# CDN/Assets
STATIC_CDN_URL=https://cdn.your-domain.com
ASSET_VERSION=1.0.0
```

## Security Configuration

### 1. Firewall Setup

```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 8081/tcp # CipherWave (internal)
sudo ufw enable
```

### 2. SSL Certificate

```bash
# Obtain Let's Encrypt certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test certificate renewal
sudo certbot renew --dry-run

# Add renewal to crontab
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### 3. nginx Configuration

Create `/etc/nginx/sites-available/cipherwave`:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=websocket:10m rate=5r/s;

upstream cipherwave_backend {
    least_conn;
    server 127.0.0.1:8081 max_fails=3 fail_timeout=30s;
    # Add more servers for scaling
    # server 127.0.0.1:8082 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' wss:";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static file serving
    location /static/ {
        alias /home/cipherwave/cipherwave/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # WebSocket proxy
    location /ws {
        limit_req zone=websocket burst=10 nodelay;
        
        proxy_pass http://cipherwave_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 60;
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://cipherwave_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 60;
        proxy_send_timeout 60;
        proxy_connect_timeout 10;
    }

    # Health check
    location /health {
        proxy_pass http://cipherwave_backend;
        access_log off;
    }

    # Main application
    location / {
        proxy_pass http://cipherwave_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /var/www/html;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/cipherwave /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Container Deployment

### 1. Docker Configuration

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cipherwave -u 1001

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=cipherwave:nodejs . .

# Set permissions
RUN chown -R cipherwave:nodejs /app
USER cipherwave

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

EXPOSE 8081

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  cipherwave:
    build: .
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      - NODE_ENV=production
      - PORT=8081
      - ENABLE_CLUSTERING=false  # Handled by Docker scaling
    env_file:
      - .env.production
    volumes:
      - ./logs:/app/logs
    networks:
      - cipherwave-network
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/private:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - cipherwave
    networks:
      - cipherwave-network

  redis:
    image: redis:alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - cipherwave-network

networks:
  cipherwave-network:
    driver: bridge

volumes:
  redis_data:
```

### 2. Deploy with Docker

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale cipherwave=5

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Update deployment
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Load Balancing

### 1. Using Built-in Load Balancer

```javascript
// load-balancer-config.js
import LoadBalancer from './load-balancer.js';

const lb = new LoadBalancer({
    port: 8080,
    algorithm: 'least-connections',
    sticky: true,
    healthCheckInterval: 30000
});

// Add backend servers
lb.addServer('server1', { host: 'localhost', port: 8081, weight: 1 });
lb.addServer('server2', { host: 'localhost', port: 8082, weight: 1 });
lb.addServer('server3', { host: 'localhost', port: 8083, weight: 2 });

lb.start();
```

### 2. Using HAProxy

Create `/etc/haproxy/haproxy.cfg`:

```
global
    daemon
    maxconn 4096
    log stdout local0

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog

frontend cipherwave_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/cipherwave.pem
    redirect scheme https if !{ ssl_fc }
    default_backend cipherwave_backend

backend cipherwave_backend
    balance leastconn
    option httpchk GET /health
    server cipherwave1 127.0.0.1:8081 check
    server cipherwave2 127.0.0.1:8082 check
    server cipherwave3 127.0.0.1:8083 check

listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
    stats admin if TRUE
```

## Monitoring & Logging

### 1. Application Monitoring

Create `monitoring-setup.js`:

```javascript
import ServerMonitoring from './server-monitoring.js';

const monitoring = new ServerMonitoring({
    metricsInterval: 30000,
    healthCheckInterval: 60000,
    cpuThreshold: 80,
    memoryThreshold: 85,
    connectionThreshold: 1000
});

// Alert handlers
monitoring.on('alert', (alert) => {
    console.error('ALERT:', alert);
    // Send to alerting system (PagerDuty, Slack, etc.)
});

monitoring.on('escalatedAlert', (alert) => {
    console.error('ESCALATED ALERT:', alert);
    // Send urgent notification
});

export default monitoring;
```

### 2. Log Configuration

Create `winston-config.js`:

```javascript
import winston from 'winston';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'cipherwave' },
    transports: [
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 10485760,
            maxFiles: 10
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

export default logger;
```

### 3. Prometheus Metrics

Add to `server.js`:

```javascript
import promClient from 'prom-client';

// Create metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5]
});

const activeConnections = new promClient.Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections'
});

register.registerMetric(httpRequestDuration);
register.registerMetric(activeConnections);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});
```

## Backup & Recovery

### 1. Backup Strategy

Create `backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/cipherwave"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /home/cipherwave/cipherwave

# Backup SSL certificates
tar -czf $BACKUP_DIR/ssl_$DATE.tar.gz /etc/letsencrypt

# Backup nginx configuration
tar -czf $BACKUP_DIR/nginx_$DATE.tar.gz /etc/nginx

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /home/cipherwave/cipherwave/logs

# Clean old backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

Add to crontab:

```bash
# Daily backups at 2 AM
0 2 * * * /home/cipherwave/backup.sh >> /var/log/cipherwave-backup.log 2>&1
```

### 2. Recovery Procedures

Create `restore.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/cipherwave"
RESTORE_DATE=$1

if [ -z "$RESTORE_DATE" ]; then
    echo "Usage: $0 <YYYYMMDD_HHMMSS>"
    exit 1
fi

# Stop services
sudo systemctl stop nginx
sudo systemctl stop cipherwave

# Restore application
tar -xzf $BACKUP_DIR/app_$RESTORE_DATE.tar.gz -C /

# Restore SSL certificates
tar -xzf $BACKUP_DIR/ssl_$RESTORE_DATE.tar.gz -C /

# Restore nginx configuration
tar -xzf $BACKUP_DIR/nginx_$RESTORE_DATE.tar.gz -C /

# Set permissions
sudo chown -R cipherwave:cipherwave /home/cipherwave/cipherwave

# Start services
sudo systemctl start cipherwave
sudo systemctl start nginx

echo "Restore completed from backup: $RESTORE_DATE"
```

## Scaling

### 1. Horizontal Scaling

**Add new server instances:**

```bash
# On new server
SERVER_ID=2
PORT=8082

# Deploy application
git clone https://github.com/your-org/cipherwave.git
cd cipherwave
npm ci --production

# Update environment
export PORT=$PORT
export SERVER_ID=$SERVER_ID

# Start service
npm run start:production
```

**Update load balancer:**

```bash
# Add to nginx upstream
upstream cipherwave_backend {
    server 127.0.0.1:8081;
    server 127.0.0.1:8082;  # New server
    server 10.0.1.100:8081; # Remote server
}
```

### 2. Auto-scaling with Docker Swarm

```yaml
# docker-stack.yml
version: '3.8'

services:
  cipherwave:
    image: cipherwave:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    networks:
      - cipherwave

networks:
  cipherwave:
    external: true
```

Deploy stack:

```bash
docker stack deploy -c docker-stack.yml cipherwave
docker service scale cipherwave_cipherwave=5
```

## Troubleshooting

### Common Issues

**1. High CPU Usage**
```bash
# Check processes
top -p $(pgrep -d',' node)

# Profile application
node --prof server.js
node --prof-process isolate-*.log > processed.txt
```

**2. Memory Leaks**
```bash
# Monitor memory
watch -n 1 'ps aux | grep node'

# Heap dump analysis
kill -USR2 <node_pid>  # Generates heapdump
```

**3. Connection Issues**
```bash
# Check port availability
netstat -tlnp | grep :8081

# Test WebSocket connection
wscat -c ws://localhost:8081
```

**4. SSL Certificate Issues**
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew --force-renewal

# Test SSL configuration
openssl s_client -connect your-domain.com:443
```

### Monitoring Commands

```bash
# System resources
htop
iotop
netstat -i

# Application logs
tail -f logs/combined.log
journalctl -u cipherwave -f

# nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Docker logs
docker-compose logs -f
docker stats
```

### Performance Tuning

**System-level optimizations:**

```bash
# Increase file descriptors
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# TCP optimizations
sysctl -w net.core.somaxconn=65535
sysctl -w net.ipv4.tcp_max_syn_backlog=65535
sysctl -w net.core.netdev_max_backlog=65535
```

**Node.js optimizations:**

```bash
# Increase heap size
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable V8 optimizations
export NODE_OPTIONS="--optimize-for-size"
```

This deployment guide provides a comprehensive foundation for running CipherWave in production. Customize the configurations based on your specific requirements and infrastructure setup.