# --- Stage 1: Build Application ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

# Install dumb-init for proper PID 1 signal forwarding
RUN apk add --no-cache dumb-init curl

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript & SQL migrations from builder
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/src/db/migrations ./dist/db/migrations
COPY --from=builder --chown=node:node /app/docs ./docs

# Create uploads directory with node ownership
RUN mkdir -p uploads && chown -R node:node /app

# Switch to non-root user for security
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
