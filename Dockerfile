# =====================================================
# Stage 1 - Build
# =====================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies
RUN npm install --no-audit --no-fund

# Copy application source
COPY . .

# Build the application
RUN npm run build

# =====================================================
# Stage 2 - Production
# =====================================================
FROM node:22-alpine

LABEL org.opencontainers.image.title="Value Finder" \
      org.opencontainers.image.description="Vehicle valuation and management application" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Gulzar" \
      org.opencontainers.image.vendor="ITI Finance"

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

# Copy package files
COPY --chown=node:node package.json package-lock.json ./

# Install only production dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Copy Nitro build output
COPY --from=builder --chown=node:node /app/.output ./.output

# Expose application port
EXPOSE 3001

# Run as non-root user
USER node

# Start application
CMD ["node", ".output/server/index.mjs"]