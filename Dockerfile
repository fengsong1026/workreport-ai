FROM node:18-alpine AS base

# Prisma requires openssl at runtime
RUN apk add --no-cache openssl libc6-compat

# ── Dependency install layer ──
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts

# ── Build layer ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production dependency layer ──
FROM base AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

# ── Runner layer ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy production dependencies (slim, no devDependencies)
COPY --from=prod-deps /app/node_modules ./node_modules

# Overlay Prisma generated client and CLI from builder
# (prisma is a devDependency, not in prod-deps; generated client is in .prisma)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy build artifacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy Prisma schema (needed by prisma db push at startup)
COPY --from=builder /app/prisma ./prisma

# Entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create persistent data directories
RUN mkdir -p /app/data/db /app/data/reports && \
    chown -R node:node /app/data/db /app/data/reports

EXPOSE 3000
ENV PORT=3000

# Run as non-root user
USER node

CMD ["./docker-entrypoint.sh"]
