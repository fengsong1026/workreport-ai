FROM node:18-alpine AS base

# Prisma 运行需要 openssl
RUN apk add --no-cache openssl libc6-compat

# ── 依赖层 ──
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts

# ── 构建层 ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── 运行层 ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 拷贝完整项目
COPY --from=builder /app ./

# 入口脚本
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 持久化目录
RUN mkdir -p /app/data/db /app/data/reports

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["/app/docker-entrypoint.sh"]
