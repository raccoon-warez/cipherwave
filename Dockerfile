# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/www ./www

# Create non-root user
RUN addgroup -g 1001 -S cipherwave && \
    adduser -S cipherwave -u 1001 -G cipherwave
RUN chown -R cipherwave:cipherwave /app

USER cipherwave

EXPOSE 8080
EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "dist/server/index.js"]
