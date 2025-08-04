# CipherWave Production Dockerfile
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S cipherwave && \
    adduser -S cipherwave -u 1001

# Create necessary directories
RUN mkdir -p /app/logs /app/www && \
    chown -R cipherwave:cipherwave /app

# Production image
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S cipherwave && \
    adduser -S cipherwave -u 1001

# Set working directory
WORKDIR /app

# Copy application from builder
COPY --from=builder --chown=cipherwave:cipherwave /app .

# Switch to non-root user
USER cipherwave

# Expose port
EXPOSE 52178 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:52178/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]