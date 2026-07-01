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
│   │   ├── page.tsx              # 首页 Dashboard
│   │   ├── globals.css           # 全局样式 + Markdown 渲染样式
│   │   ├── reports/page.tsx      # 报告管理（列表 + Markdown 预览）
│   │   ├── data-sources/page.tsx # 数据源管理 + GitHub 连接 + 仓库选择
│   │   ├── settings/page.tsx     # API 配置
│   │   └── api/                  # API Routes
│   │       ├── generate/route.ts # POST 生成报告
│   │       ├── collect/route.ts  # POST 同步仓库列表
│   │       ├── reports/route.ts  # GET/DELETE 报告管理
│   │       ├── data-sources/route.ts # GET 数据源 / POST 仓库选择/断开
│   │       ├── config/route.ts   # GET/POST 配置
│   │       └── oauth/            # GitHub OAuth
│   │           ├── github/route.ts           # GET 发起授权
│   │           └── callback/github/route.ts  # GET 授权回调
│   ├── lib/                      # 核心逻辑
│   │   ├── models.ts             # WorkRecord / PluginMeta / TimeRange
│   │   ├── plugin.ts             # DataSourcePlugin 接口
│   │   ├── registry.ts           # 插件注册表
│   │   ├── storage.ts            # JSONL 存储工具（供规划中插件使用）
│   │   ├── ai-engine.ts          # AI 生成引擎（OpenAI 兼容）
│   │   ├── templates.ts          # 模板加载与 {{占位符}} 填充
│   │   ├── dates.ts              # ISO 周/日/月时间范围计算
│   │   ├── scheduler.ts          # 定时任务（node-cron）
│   │   ├── github.ts             # GitHub API 客户端（OAuth + REST）
│   │   └── prisma.ts             # Prisma 客户端单例
│   └── plugins/                  # 数据源插件
│       ├── git.ts                # ✅ Git (GitHub OAuth + API)
│       ├── task.ts               # ⏳ Task Reporter（骨架）
│       ├── calendar.ts           # ⏳ Calendar Reporter（骨架）
│       └── doc.ts                # ⏳ Doc Reporter（骨架）
├── prisma/
│   └── schema.prisma             # SQLite schema
├── templates/                    # 共享报告模板
│   ├── weekly-report.md
│   ├── daily-report.md
│   └── monthly-report.md
├── data/                         # 运行时数据（gitignored）
│   └── reports/                  # 生成的报告 .md 文件
├── Dockerfile                    # Docker 多阶段构建
├── docker-compose.yml            # Docker Compose 编排
├── docker-entrypoint.sh          # 容器入口脚本（自动初始化数据库）
├── package.json
├── next.config.mjs
├── tsconfig.json
├── tailwind.config.ts
├── .env.example
└── demo.html / COMPETITION.md    # 参赛文档
```

### 数据流

```
GitHub OAuth ──► token 存入 DB
                      │
用户选择仓库 ──► plugin.collect() 通过 GitHub API 同步仓库列表
                      │
生成报告 ──► plugin.read() 调用 GitHub Commits API ──► WorkRecord[]
                      │
           plugin.formatForPrompt() ──► 按仓库分组
                      │
           ai-engine.generateReport() ──► templates/*.md ──► SQLite + reports/*.md
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

### 6. 连接 GitHub

1. 打开应用，进入「数据源」页面
2. 点击「连接 GitHub」→ 授权
3. 点击「同步仓库」→ 选择要纳入报告的仓库
4. 在「设置」页面配置 API Key
5. 回到首页生成周报

## 使用

### 通过 Web UI

- **首页 Dashboard**：快速生成日报/周报/月报，查看数据源状态和最近报告
- **报告管理**：查看历史报告，支持 Markdown 渲染
- **数据源**：连接 GitHub、选择仓库、同步仓库列表
- **设置**：配置 API Key / Base URL / Model

### 通过 API

```bash
# 生成周报
curl -X POST http://<host>/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"type":"weekly","allAuthors":true}'

# 预览 prompt（不调用 AI）
curl -X POST http://<host>/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"type":"weekly","allAuthors":true,"dryRun":true}'

# 同步 GitHub 仓库列表
curl -X POST http://<host>/api/collect \
  -H 'Content-Type: application/json' \
  -d '{"plugin":"git"}'

# 列出报告
curl http://<host>/api/reports
```

## 部署

### Docker 部署

项目提供 `Dockerfile` 和 `docker-compose.yml`，支持一键部署。容器启动时自动初始化 SQLite 数据库，无需手动执行 `prisma db push`。

> **注意**：SQLite 数据库存储在容器内，不持久化。容器重启后数据库会重置（用户、配置、报告记录丢失），仅报告 .md 文件通过卷持久化。如需保留数据库，在 `docker-compose.yml` 中添加 `- ./data/db:/app/data/db` 卷挂载即可。

#### 快速启动

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / OPENAI_API_KEY 等

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
curl http://localhost:8088/api/data-sources
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

### 本地开发部署

```bash
npm install
cp .env.example .env          # 填入配置
npx prisma db push            # 初始化数据库
npm run dev                   # 启动开发服务器
```

## API 一览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/generate` | POST | 生成工作报告（日报/周报/月报） |
| `/api/collect` | POST | 同步数据源（GitHub 仓库列表） |
| `/api/reports` | GET | 列出/查看报告 |
| `/api/reports` | DELETE | 删除报告 |
| `/api/data-sources` | GET | 列出数据源插件及连接状态 |
| `/api/data-sources` | POST | 仓库选择 / 断开连接 |
| `/api/oauth/github` | GET | 发起 GitHub OAuth 授权 |
| `/api/oauth/callback/github` | GET | GitHub OAuth 回调 |
| `/api/config` | GET/POST | 读取/更新配置 |

## 模板占位符

| 占位符 | 说明 |
|--------|------|
| `{{WEEK}}` | 周期标签，如 `W25 (2026)` |
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
- **react-markdown** — 报告渲染
