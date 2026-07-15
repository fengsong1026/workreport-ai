# WorkReport AI

> 全岗位智能工作汇报平台 —— 从工作数据源头自动采集，AI 自动生成汇报语言。
> 汇报是副产品，工作本身才是输入。

WorkReport AI 采用「数据源插件化」架构：每类岗位对应一个数据源插件，共享同一 AI 生成引擎。当前已落地 **Git (GitHub)** 插件（通过 GitHub OAuth + API 获取提交记录），Task / Calendar / Doc 三个插件规划中。

**100% TypeScript** — Next.js App Router + Prisma + SQLite + openai SDK + node-cron

## 架构

```
workreport-ai/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # 根布局（含导航）
│   │   ├── page.tsx              # 公开落地页（无需登录）
│   │   ├── globals.css           # 全局样式 + Markdown 渲染样式
│   │   ├── dashboard/page.tsx    # 仪表盘（快速生成 + 状态概览）
│   │   ├── reports/page.tsx      # 报告管理（列表 + Markdown 预览）
│   │   ├── data-sources/page.tsx # 数据源管理 + OAuth 连接 + 仓库选择
│   │   ├── schedule/page.tsx     # 定时任务管理
│   │   ├── login/page.tsx        # 登录
│   │   ├── register/page.tsx     # 注册
│   │   ├── profile/page.tsx      # 个人中心（信息编辑 + 改密码）
│   │   ├── components/           # 共享组件（AuthGuard、UserNav）
│   │   └── api/                  # API Routes
│   │       ├── auth/             # 登录/注册/个人信息/改密码
│   │       ├── generate/route.ts # POST 生成报告
│   │       ├── collect/route.ts  # POST 同步数据
│   │       ├── reports/route.ts  # GET/DELETE 报告管理
│   │       ├── data-sources/route.ts # GET 数据源 / POST 仓库选择/断开
│   │       ├── schedule/         # 定时任务 CRUD
│   │       └── oauth/            # OAuth 授权（GitHub + 通用 provider）
│   ├── instrumentation.ts        # 启动钩子：恢复已启用的定时任务
│   ├── middleware.ts             # Edge 运行时：API 路由 JWT 校验
│   ├── lib/                      # 核心逻辑
│   │   ├── models.ts             # WorkRecord / PluginMeta / TimeRange
│   │   ├── plugin.ts             # DataSourcePlugin 接口
│   │   ├── registry.ts           # 插件注册表（显式工厂注册）
│   │   ├── storage.ts            # JSONL 存储工具（供规划中插件使用）
│   │   ├── ai-engine.ts          # AI 生成引擎（OpenAI 兼容）
│   │   ├── templates.ts          # 模板加载与 {{占位符}} 填充
│   │   ├── dates.ts              # ISO 周/日/月时间范围计算
│   │   ├── generate.ts           # 报告生成入口（API 和定时任务共用）
│   │   ├── scheduler.ts          # node-cron 调度器封装
│   │   ├── scheduler-runner.ts   # DB 任务 ↔ cron 调度器桥接
│   │   ├── github.ts             # GitHub API 客户端（OAuth + REST）
│   │   ├── oauth.ts              # 通用 OAuth 2.0 工具
│   │   ├── oauth-providers.ts    # OAuth Provider 注册表（GitLab/Jira/Linear 等）
│   │   ├── auth.ts               # 服务端 JWT + bcrypt
│   │   ├── auth-client.ts        # 客户端认证工具
│   │   ├── crypto.ts             # AES-256-GCM 加密（OAuth token 静态加密）
│   │   ├── rate-limit.ts         # 内存限流
│   │   ├── schemas.ts            # Zod 校验 Schema + parseBody()
│   │   └── prisma.ts             # Prisma 客户端单例
│   └── plugins/                  # 数据源插件
│       ├── git.ts                # ✅ Git (GitHub OAuth + API)
│       ├── task.ts               # ⏳ Task Reporter（骨架）
│       ├── calendar.ts           # ⏳ Calendar Reporter（骨架）
│       └── doc.ts                # ⏳ Doc Reporter（骨架）
├── prisma/
│   └── schema.prisma             # SQLite schema（User/Config/Report/DataSource/ScheduledTask）
├── templates/                    # 共享报告模板
│   ├── weekly-report.md
│   ├── daily-report.md
│   └── monthly-report.md
├── data/                         # 运行时数据（gitignored）
│   ├── db/                       # SQLite 数据库文件
│   └── reports/                  # 生成的报告 .md 文件
├── Dockerfile                    # Docker 多阶段构建（node:18-alpine）
├── docker-compose.yml            # Docker Compose 编排（端口 8088:3000）
├── docker-entrypoint.sh          # 容器入口（自动 prisma db push）
├── deploy.sh                     # 服务器一键部署脚本
├── package.json
├── next.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── tailwind.config.ts
├── .env.example
└── demo.html / COMPETITION.md    # 参赛文档
```

### 数据流

```
GitHub OAuth ──► token 加密后存入 DB（DataSource.config）
                      │
用户选择仓库 ──► plugin.collect() 通过 GitHub API 同步仓库列表
                      │
生成报告 ──► plugin.read() 调用 GitHub Commits API ──► WorkRecord[]
                      │
           plugin.formatForPrompt() ──► 按仓库分组
                      │
           generateReportForUser() ──► ai-engine.generateReport()
                      │
           templates/*.md ──► 写入 data/reports/*.md + SQLite Report 表
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入以下配置：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | SQLite 路径，默认 `file:./dev.db` |
| `OPENAI_API_KEY` | OpenAI 兼容 API 密钥（DeepSeek / Ollama 等） |
| `OPENAI_API_BASE` | API 地址，默认 `https://api.deepseek.com` |
| `OPENAI_MODEL` | 模型名，默认 `deepseek-v4-flash` |
| `JWT_SECRET` | JWT 签名密钥（生产环境必须修改） |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `GITHUB_REDIRECT_URI` | OAuth 回调地址，只配 path：`/api/oauth/callback/github`，运行时自动从请求推导 origin 拼接，本地/服务器/任意域名都无需改此值 |

### 3. 创建 GitHub OAuth App

1. 前往 https://github.com/settings/developers → OAuth Apps → New OAuth App
2. Authorization callback URL 填入**完整回调地址**（GitHub 要求完整 URL）：
   - 本地开发：`http://localhost:8907/api/oauth/callback/github`
   - Docker 部署：`http://<你的域名或IP>:8088/api/oauth/callback/github`
3. 将生成的 Client ID 和 Client Secret 填入 `.env`
4. `.env` 里的 `GITHUB_REDIRECT_URI` 保持 path 模式 `/api/oauth/callback/github` 即可，无需与 OAuth App 里的地址完全一致

### 4. 初始化数据库

```bash
npx prisma db push
```

### 5. 启动开发服务器

```bash
npm run dev
```

应用默认运行在 `http://localhost:8907`。

### 6. 使用流程

1. 打开应用，注册账号并登录
2. 进入「数据源」页面，点击「连接 GitHub」→ 授权
3. 点击「同步仓库」→ 选择要纳入报告的仓库
4. 回到「仪表盘」生成周报（日报/周报/月报）
5. 可在「调度」页面设置定时自动生成

## 使用

### 通过 Web UI

- **首页**：公开落地页，展示产品介绍和功能特性
- **仪表盘**：快速生成日报/周报/月报，查看数据源状态和最近报告
- **报告管理**：查看历史报告，支持 Markdown 渲染，可删除
- **数据源**：OAuth 连接数据源、选择仓库、同步仓库列表
- **调度**：创建/编辑/启用/停用定时生成任务
- **个人中心**：编辑名称、修改密码、查看统计

### 通过 API

> 以下示例省略了 `Authorization: Bearer <token>` 请求头。先通过 `/api/auth/login` 获取 token，后续请求携带该 token。

```bash
# 登录获取 token
curl -X POST http://<host>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"your@email.com","password":"yourpassword"}'

# 生成周报
curl -X POST http://<host>/api/generate \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"type":"weekly","allAuthors":true}'

# 预览 prompt（不调用 AI）
curl -X POST http://<host>/api/generate \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"type":"weekly","allAuthors":true,"dryRun":true}'

# 同步 GitHub 仓库列表
curl -X POST http://<host>/api/collect \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"plugin":"git"}'

# 列出报告
curl http://<host>/api/reports \
  -H 'Authorization: Bearer <token>'

# 删除报告
curl -X DELETE http://<host>/api/reports \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"id":"<reportId>"}'

# 定时任务管理
curl http://<host>/api/schedule \
  -H 'Authorization: Bearer <token>'

curl -X POST http://<host>/api/schedule \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"name":"每周五报告","schedule":"Fri 17:00","reportType":"weekly"}'
```

## 部署

### Docker 部署

项目提供 `Dockerfile` 和 `docker-compose.yml`，支持一键部署。容器启动时自动初始化 SQLite 数据库，无需手动执行 `prisma db push`。

`docker-compose.yml` 已默认挂载 `./data/db` 和 `./data/reports` 实现数据持久化。

#### 快速启动

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / OPENAI_API_KEY / JWT_SECRET 等

# 2. 构建并启动
docker compose up -d --build

# 3. 查看日志
docker compose logs -f

# 4. 停止
docker compose down
```

#### 服务器部署

镜像默认推送至阿里云 ACR：`crpi-sg3816vcnxzdwweb.cn-hangzhou.personal.cr.aliyuncs.com/myworkreport/workreport-ai`

服务器上不需要源码，只需 `docker-compose.yml` 和 `.env` 两个文件。

```bash
# 1. 创建工作目录
mkdir -p ~/workreport-ai && cd ~/workreport-ai

# 2. 上传 docker-compose.yml（从本机 scp）
scp docker-compose.yml user@<server-ip>:~/workreport-ai/

# 3. 创建 .env 配置文件
cat > .env << 'EOF'
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=sk-xxx
OPENAI_API_BASE=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash
JWT_SECRET=<改成随机字符串>
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_REDIRECT_URI=/api/oauth/callback/github
EOF

# 4. 登录阿里云 ACR（只需一次）
docker login --username=<阿里云账号> crpi-sg3816vcnxzdwweb.cn-hangzhou.personal.cr.aliyuncs.com

# 5. 设置镜像地址并启动
export IMAGE=crpi-sg3816vcnxzdwweb.cn-hangzhou.personal.cr.aliyuncs.com/myworkreport/workreport-ai:latest
docker compose up -d

# 6. 查看日志
docker compose logs -f

# 7. 验证服务
curl http://localhost:8088/api/health
```

**后续更新：**

```bash
cd ~/workreport-ai
docker compose pull && docker compose up -d
```

> `IMAGE` 环境变量指定镜像地址，支持任意仓库（阿里云 ACR、Docker Hub、私有仓库等）。不设置时默认使用 `workreport-ai:latest`（本地构建）。可将 `export IMAGE=...` 写入 `~/.bashrc` 永久生效。

#### 注意事项

- **HTTPS**：GitHub OAuth 回调要求 HTTPS，建议在容器前加 Nginx 反向代理 + Let's Encrypt
- **端口**：默认映射 `8088:3000`，如需修改编辑 `docker-compose.yml`
- **环境变量**：通过 `.env` 文件注入，不要将 `.env` 提交到代码仓库
- **数据持久化**：`./data/db` 和 `./data/reports` 已通过卷挂载持久化，容器重建不会丢失数据

### 本地开发部署

```bash
npm install
cp .env.example .env          # 填入配置
npx prisma db push            # 初始化数据库
npm run dev                   # 启动开发服务器（端口 8907）
```

## API 一览

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/auth/register` | POST | Public | 注册（限流 3/15min） |
| `/api/auth/login` | POST | Public | 登录（限流 5/15min） |
| `/api/auth/logout` | POST | Public | 登出（客户端清除 token） |
| `/api/auth/me` | GET | Bearer | 获取当前用户信息 |
| `/api/auth/password` | POST | Bearer | 修改密码 |
| `/api/auth/profile` | PATCH | Bearer | 修改用户名 |
| `/api/generate` | POST | Bearer | 生成工作报告（限流 10/hr，支持 dryRun） |
| `/api/collect` | POST | Bearer | 同步数据源（GitHub 仓库列表等） |
| `/api/reports` | GET/DELETE | Bearer | 列出/删除报告 |
| `/api/data-sources` | GET/POST | Bearer | 列出数据源 / 仓库选择 / 断开连接 |
| `/api/schedule` | GET/POST | Bearer | 列出/创建定时任务 |
| `/api/schedule/[id]` | PATCH/DELETE | Bearer | 更新/删除定时任务 |
| `/api/oauth/github` | GET | Public | 发起 GitHub OAuth 授权 |
| `/api/oauth/callback/github` | GET | Public | GitHub OAuth 回调 |
| `/api/oauth/[provider]` | GET | Public | 发起通用 OAuth 授权（GitLab/Jira/Linear 等） |
| `/api/oauth/callback/[provider]` | GET | Public | 通用 OAuth 回调 |
| `/api/health` | GET | Public | 健康检查（DB 正常返回 200） |

> 所有 POST/PATCH 路由均通过 Zod schema 校验请求体（定义在 `src/lib/schemas.ts`），校验失败返回 400。

## 模板占位符

| 占位符 | 说明 |
|--------|------|
| `{{WEEK}}` | 周期标签，如 `W28 (2026)` |
| `{{DATE_RANGE}}` | 日期范围 |
| `{{RECORDS}}` | 各插件格式化后的工作记录 |
| `{{RECORD_COUNT}}` | 记录总数 |
| `{{PROJECT_COUNT}}` | 项目数 |
| `{{GENERATED_AT}}` | 生成时间 |

## 新增插件

1. 在 `src/plugins/<name>.ts` 创建实现 `DataSourcePlugin` 接口的类
2. 在 `src/lib/registry.ts` 的 `PLUGIN_FACTORIES` 中注册
3. 如需 OAuth，在 `src/app/api/oauth/<name>/` 和 `src/app/api/oauth/callback/<name>/` 创建路由
4. 插件只需关注「数据侧」（采集/读取/格式化），AI 生成、模板、调度全部复用平台核心

## 依赖

- **Node.js 18+**
- **Next.js 14** — Web 框架（App Router）
- **Prisma + SQLite** — 数据库
- **openai SDK** — AI 报告生成（OpenAI / DeepSeek / vLLM / Ollama / LiteLLM 等）
- **node-cron** — 定时任务
- **jose** — JWT 签发与校验（Edge Runtime 兼容）
- **bcryptjs** — 密码哈希
- **zod** — 请求体校验
- **react-markdown** — 报告渲染
