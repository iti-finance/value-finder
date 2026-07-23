FROM node:24-bookworm-slim AS builder

WORKDIR /app

ARG NPM_CONFIG_STRICT_SSL=true
ENV npm_config_strict_ssl=${NPM_CONFIG_STRICT_SSL}
ENV npm_config_update_notifier=false

COPY package.json package-lock.json ./
COPY vendor ./vendor

RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim

LABEL org.opencontainers.image.title="Value Finder" \
      org.opencontainers.image.description="Vehicle valuation and management application" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Gulzar" \
      org.opencontainers.image.vendor="ITI Finance"

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.output ./.output

EXPOSE 3001

USER node

CMD ["node", ".output/server/index.mjs"]
