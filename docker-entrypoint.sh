#!/bin/sh
set -e

# 确保数据目录存在
mkdir -p /app/data/db /app/data/reports

# 初始化/同步数据库 schema
npx prisma db push --skip-generate

# 启动 Next.js 生产服务器
exec npm start
