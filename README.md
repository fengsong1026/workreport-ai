# WorkReport AI

> 全岗位智能工作汇报平台 —— 从工作数据源头自动采集，AI 自动生成汇报语言。
> 汇报是副产品，工作本身才是输入。

WorkReport AI 采用「数据源插件化」架构：每类岗位对应一个数据采集子应用，共享同一 AI 生成引擎。当前已落地 **Git Weekly Automation** 子应用（程序员），Task / Calendar / Doc 三个子应用规划中。

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
│   │   ├── data-sources/page.tsx # 数据源管理 + Git 采集
│   │   ├── settings/page.tsx     # API 配置
│   │   └── api/                  # API Routes
│   │       ├── generate/route.ts # POST 生成报告
│   │       ├── collect/route.ts  # POST 采集数据
│   │       ├── reports/route.ts  # GET/DELETE 报告管理
│   │       ├── data-sources/route.ts # GET 数据源列表
│   │       └── config/route.ts   # GET/POST 配置
│   ├── lib/                      # 核心逻辑
│   │   ├── models.ts             # WorkRecord / PluginMeta / TimeRange
│   │   ├── plugin.ts             # DataSourcePlugin 接口
│   │   ├── registry.ts           # 插件注册表
│   │   ├── storage.ts            # JSONL 存储工具
│   │   ├── ai-engine.ts          # AI 生成引擎（OpenAI 兼容）
│   │   ├── templates.ts          # 模板加载与 {{占位符}} 填充
│   │   ├── dates.ts              # ISO 周/日/月时间范围计算
│   │   ├── scheduler.ts          # 定时任务（node-cron）
│   │   └── prisma.ts             # Prisma 客户端单例
│   └── plugins/                  # 数据源插件
│       ├── git.ts                # ✅ Git Weekly Automation
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
│   ├── commits/                  # Git 提交记录（从 git-weekly-automation）
│   └── reports/                  # 生成的报告 .md 文件
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── .env.example
└── demo.html / COMPETITION.md    # 参赛文档
```

### 数据流

```
各数据源 ──► 插件 collect() ──► data/ ──► 插件 read() ──► 插件 formatForPrompt()
                                                              │
                                              ai-engine.generateReport()
                                                              │
                                              templates/*.md ──► SQLite + reports/*.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY
```

### 3. 初始化数据库

```bash
npx prisma db push
```

### 4. 安装 Git 子应用

Git 插件通过路径引用同级目录下的 [git-weekly-automation](../git-weekly-automation) 项目：

```bash
cd ../git-weekly-automation
./scripts/setup          # 安装全局 Git Hook，此后每次 git commit 自动记录
```

### 5. 启动开发服务器

```bash
npm run dev
# 打开 http://localhost:3000
```

## 使用

### 通过 Web UI

- **首页 Dashboard**：快速生成日报/周报/月报，查看数据源状态和最近报告
- **报告管理**：查看历史报告，支持 Markdown 渲染
- **数据源**：管理数据源，手动采集 Git 提交
- **设置**：配置 API Key / Base URL / Model

### 通过 API

```bash
# 生成周报
curl -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"type":"weekly","allAuthors":true}'

# 预览 prompt（不调用 API）
curl -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"type":"weekly","allAuthors":true,"dryRun":true}'

# 采集 Git 提交
curl -X POST http://localhost:3000/api/collect \
  -H 'Content-Type: application/json' \
  -d '{"plugin":"git","scan":["~/work"],"allAuthors":true}'

# 列出报告
curl http://localhost:3000/api/reports
```

## API 一览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/generate` | POST | 生成工作报告（日报/周报/月报） |
| `/api/collect` | POST | 采集数据源记录 |
| `/api/reports` | GET | 列出/查看报告 |
| `/api/reports` | DELETE | 删除报告 |
| `/api/data-sources` | GET | 列出数据源插件 |
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
3. 插件只需关注「数据侧」（采集/读取/格式化），AI 生成、模板、调度全部复用平台核心

## 依赖

- **Node.js 18+**
- **Next.js 14** — Web 框架（App Router）
- **Prisma + SQLite** — 数据库
- **openai SDK** — AI 报告生成（OpenAI / DeepSeek / vLLM / Ollama / LiteLLM 等）
- **node-cron** — 定时任务
- **react-markdown** — 报告渲染
- **Git** — Git 插件数据采集（委托给 git-weekly-automation）
