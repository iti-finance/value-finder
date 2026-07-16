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

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Copy Nitro build output
COPY --from=builder /app/.output ./.output

# Expose application port
EXPOSE 3001

# Start application
CMD ["node", ".output/server/index.mjs"]