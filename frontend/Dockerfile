FROM node:20-alpine AS base

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy the full .next directory (simpler than standalone)
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/public ./public
COPY --from=base /app/next.config.ts ./next.config.ts

# Create non-root user
RUN addgroup -g 1001 -S nabeeh && \
    adduser -S nabeeh -u 1001 -G nabeeh

RUN chown -R nabeeh:nabeeh /app

USER nabeeh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:3000 || exit 1

CMD ["npx", "next", "start", "-p", "3000"]
