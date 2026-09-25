# syntax=docker/dockerfile:1

# =============================================================================
# z-freelance — all-in-one build
#   Stage deps   : deterministic production dependency install
#   Stage builder: full dev install + Next.js production build (standalone)
#   Stage runner : slim runtime — app server, migration runner, prod deps only
# =============================================================================

# ------------------------------------------------------------------ deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------- builder ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Build-time env is only used for Next's compile step (all pages render dynamically).
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN npm run build \
    && test -f .next/standalone/server.js || (echo "standalone output missing" && exit 1)

# ----------------------------------------------------------------- runner ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    PGLITE_DATA_DIR=/data/pglite

# Non-root runtime user + writable data dir for the embedded-Postgres mode.
RUN addgroup -g 1001 -S nodejs && adduser -S zfreelance -u 1001 -G nodejs \
    && mkdir -p /data/pglite && chown -R zfreelance:nodejs /data

# Full production node_modules (for the migration runner; the standalone
# server carries its own traced copy internally).
COPY --from=deps --chown=zfreelance:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=zfreelance:nodejs /app/.next/standalone ./
COPY --from=builder --chown=zfreelance:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=zfreelance:nodejs /app/public ./public
COPY --chown=zfreelance:nodejs drizzle ./drizzle
COPY --chown=zfreelance:nodejs scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=zfreelance:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
COPY --chown=zfreelance:nodejs package.json ./package.json

RUN chmod +x ./docker-entrypoint.sh

USER zfreelance
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
