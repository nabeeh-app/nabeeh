FROM node:20-alpine AS base

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nabeeh && \
    adduser -S nabeeh -u 1001 -G nabeeh

# Create necessary directories
RUN mkdir -p logs auth_info_baileys && \
    chown -R nabeeh:nabeeh /app

USER nabeeh

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:5000/health || exit 1

CMD ["node", "server.js"]
