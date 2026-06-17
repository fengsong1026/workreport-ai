# WorkReport AI Web 全栈改造规划

## Summary

将现有 Python CLI 项目改造为 **100% TypeScript** 的 Next.js Web 全栈应用。**所有 Python 文件已删除**，核心逻辑用 TypeScript 重写，使用 SQLite 作为数据库，不包含认证系统，纯功能演示。

## Current State Analysis

**已删除的 Python 文件**：
- `workreport_ai/` 目录下所有 Python 模块（__init__.py / __main__.py / cli.py / models.py / plugin.py / registry.py / storage.py / ai_engine.py / templates.py / scheduler.py / dates.py）
- `workreport_ai/plugins/` 目录下所有插件实现

**保留的文件**：
- `templates/*.md` — 周报/日报/月报模板（直接复用）
- `config.example.json` — 配置示例
- `demo.html` / `COMPETITION.md` — 参赛文档
- `requirements.txt` — 待删除（不再需要 Python 依赖）
- `scripts/workreport-ai` — 待删除（Python CLI 包装脚本）

**项目当前状态**：仅保留配置文件和模板，其余全部清空，等待 Next.js 初始化。

## Proposed Changes

### 1. 初始化 Next.js 项目结构

```
workreport-ai/
├── src/                          # Next.js 源码（100% TypeScript）
│   ├── app/                      # App Router
│   │   ├── layout.tsx            # 根布局
│   │   ├── page.tsx              # 首页 Dashboard
│   │   ├── reports/              # 报告管理页面
│   │   │   └── page.tsx
│   │   ├── data-sources/         # 数据源管理页面
│   │   │   └── page.tsx
│   │   ├── settings/             # 配置页面
│   │   │   └── page.tsx
│   │   └── api/                  # API Routes
│   │       ├── generate/route.ts      # POST 生成报告
│   │       ├── collect/route.ts       # POST 采集数据
│   │       ├── reports/route.ts       # GET 报告列表
│   │       ├── data-sources/route.ts  # GET 数据源列表
│   │       └── config/route.ts        # GET/POST 配置
│   ├── lib/                    # 核心逻辑（TypeScript 重写）
│   │   ├── models.ts           # WorkRecord, PluginMeta, TimeRange
│   │   ├── plugin.ts           # DataSourcePlugin 接口
│   │   ├── registry.ts         # 插件注册表
│   │   ├── storage.ts          # JSONL 存储工具
│   │   ├── ai-engine.ts        # AI 生成引擎
│   │   ├── templates.ts        # 模板管理
│   │   ├── dates.ts            # 时间范围计算
│   │   └── scheduler.ts        # 定时任务（node-cron）
│   └── plugins/                # 数据源插件
│       ├── git.ts              # Git 插件实现
│       ├── task.ts             # Task 插件骨架
│       ├── calendar.ts         # Calendar 插件骨架
│       └── doc.ts              # Doc 插件骨架
├── prisma/
│   └── schema.prisma           # SQLite schema
├── templates/                  # 共享报告模板（复用现有 .md 文件）
│   ├── weekly-report.md
│   ├── daily-report.md
│   └── monthly-report.md
├── data/                       # 运行时数据（JSONL + SQLite）
│   ├── commits/                # Git 提交记录（从 git-weekly-automation）
│   └── reports/                # 生成的报告
├── public/                     # 静态资源
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── .env.example
├── .gitignore                  # 更新：移除 Python 相关，添加 Node.js
├── config.example.json         # 保留
├── demo.html / COMPETITION.md  # 保留
└── CLAUDE.md                   # 更新：反映 TypeScript 架构
```

**清理步骤**：
```bash
rm -rf workreport_ai/ scripts/ requirements.txt
rm -rf __pycache__/ .venv/
```

**初始化命令**：
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-import-alias
npm install prisma @prisma/client openai node-cron zod react-markdown
npm install -D @types/node-cron
npx prisma init --datasource-provider sqlite
```

### 2. 核心模块重写（Python → TypeScript）

#### 2.1 `src/lib/models.ts`

```typescript
// WorkRecord 接口（对应 Python WorkRecord dict）
export interface WorkRecord {
  source: string;       // "git" | "task" | "calendar" | "doc"
  timestamp: string;    // ISO 8601
  title: string;
  detail: string;
  project: string;
  author: string;
  email?: string;
  raw?: Record<string, unknown>;
}

// PluginMeta 类
export class PluginMeta {
  constructor(
    public name: string,
    public displayName: string,
    public dataSource: string,
    public targetUsers: string,
    public status: "done" | "planned"
  ) {}
  get isAvailable(): boolean { return this.status === "done"; }
}

// TimeRange 类
export class TimeRange {
  constructor(
    public start: Date,
    public end: Date,
    public label: string
  ) {}
  get dateRangeStr(): string {
    return `${this.start.toISOString().slice(0, 10)} → ${this.end.toISOString().slice(0, 10)}`;
  }
}
```

#### 2.2 `src/lib/plugin.ts`

```typescript
// DataSourcePlugin 接口（对应 Python DataSourcePlugin ABC）
export interface DataSourcePlugin {
  readonly meta: PluginMeta;
  collect(args: CollectArgs): Promise<number>;
  read(since: Date, until: Date, email?: string): Promise<WorkRecord[]>;
  formatForPrompt(records: WorkRecord[]): string;
  stats(records: WorkRecord[]): { count: number; projectCount: number };
}

export interface CollectArgs {
  scan: string[];
  since?: string;
  until?: string;
  author?: string;
  allAuthors: boolean;
  dryRun: boolean;
  maxDepth?: number;
}
```

#### 2.3 `src/lib/ai-engine.ts`

核心流程：模板填充 → prompt 构造 → OpenAI 兼容 API 调用。

**实现方式**：
- 使用 `openai` Node.js SDK
- 配置优先级：环境变量 > `.env`
- `generateReport()` 函数为 `async`

**对应关系**：
- `build_system_prompt()` → `buildSystemPrompt()`
- `build_user_message()` → `buildUserMessage()`
- `call_openai_compatible_api()` → 使用 `openai` SDK 直接调用
- `generate_report()` → `generateReport()`

#### 2.4 `src/lib/registry.ts`

TypeScript 中改为 **显式注册**：

```typescript
export class PluginRegistry {
  private plugins: Map<string, DataSourcePlugin> = new Map();

  constructor(projectDir: string, pluginsConfig: Record<string, Record<string, unknown>>) {
    // 显式注册（而非动态导入）
    const plugins = [new GitPlugin(projectDir, pluginsConfig.git || {})];
    // 未来添加: new TaskPlugin(...), new CalendarPlugin(...), new DocPlugin(...)
    for (const p of plugins) {
      this.plugins.set(p.meta.name, p);
    }
  }

  get(name: string): DataSourcePlugin | undefined { return this.plugins.get(name); }
  all(): DataSourcePlugin[] { return Array.from(this.plugins.values()); }
  available(): DataSourcePlugin[] { return this.all().filter(p => p.meta.isAvailable); }
  names(): string[] { return Array.from(this.plugins.keys()); }
}
```

#### 2.5 `src/lib/storage.ts`

JSONL 存储 TypeScript 实现：
- `appendRecords()` — 按周分文件，按 dedup_field 去重
- `readRange()` — 遍历区间内周文件，过滤时间范围
- `loadHashes()` — 读取已存在的去重字段集合

#### 2.6 `src/lib/templates.ts`

- `loadTemplate()` — 读取 `.md` 文件，不存在时回退到内置默认
- `fillTemplate()` — `{{PLACEHOLDER}}` 替换
- 内置默认模板直接从 `templates/` 目录加载

#### 2.6 `src/lib/dates.ts`

JavaScript `Date` 对象实现时间范围计算：
- `getWeekRange()` — ISO 周范围
- `getDayRange()` — 当日范围
- `getMonthRange()` — 当月范围
- `getGitUserEmail()` — 调用 `git config --global user.email`

#### 2.7 `src/lib/scheduler.ts`

**node-cron** 定时任务：

**关键变化**：
- 不再使用 macOS launchd，改用 Node.js 进程内定时任务
- `addTask()` → `schedule.addJob()`（node-cron）
- `listTasks()` → 维护内存中的任务列表
- 配置存储在 SQLite（而非 plist 文件）
- `parseSchedule()` → 解析 "Fri 17:00" 为 cron 表达式

### 3. Git 插件（`src/plugins/git.ts`）

**核心逻辑**：
- `collect()` — 调用 `git-weekly-automation/scripts/collect-commits`（通过 `child_process.execFile`）
- `read()` — 读取 `data/commits/*.jsonl`
- `formatForPrompt()` — 按仓库分组

**关键变化**：
- `subprocess.run` → `child_process.execFile`
- 路径解析：`../git-weekly-automation` 相对于项目根目录
- JSON 解析：使用 Node.js 原生 `fs` + `JSON.parse`

### 4. Prisma Schema（`prisma/schema.prisma`）

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Config {
  id        Int    @id @default(0)
  apiKey    String @default("")
  apiBase   String @default("https://api.deepseek.com")
  model     String @default("deepseek-v4-flash")
  maxTokens Int    @default(4096)
  updatedAt DateTime @default(now())
}

model Report {
  id          String   @id @default(cuid())
  type        String   // "daily" | "weekly" | "monthly"
  label       String   // "W25 (2026)"
  dateRange   String   // "2026-06-15 → 2026-06-17"
  recordCount Int
  projectCount Int
  content     String
  createdAt   DateTime @default(now())
}

model DataSource {
  id          String   @id @default(cuid())
  name        String   @unique  // "git", "task", ...
  displayName String
  status      String   // "done" | "planned"
  connected   Boolean  @default(false)
  config      String   @default("{}")  // JSON
  updatedAt   DateTime @default(now())
}

model ScheduledTask {
  id        String   @id @default(cuid())
  name      String   @unique
  schedule  String   // "Fri 17:00"
  cronExpr  String   // "0 17 * * 5"
  enabled   Boolean  @default(true)
  command   String   // "generate"
  plugin    String?  // null = 所有插件
  createdAt DateTime @default(now())
}
```

### 5. API Routes 实现

#### 5.1 `POST /api/generate`

**请求体**：
```typescript
{ type: "weekly", week?: number, year?: number, month?: number, plugin?: string, allAuthors?: boolean, force?: boolean }
```

**流程**：
1. 解析时间范围
2. 加载配置（API Key 等）
3. 选择插件
4. 读取各插件记录 → 格式化
5. 调用 AI 引擎生成报告
6. 保存报告到 SQLite + 本地 `.md` 文件
7. 返回报告内容

#### 5.2 `POST /api/collect`

**请求体**：
```typescript
{ plugin: "git", scan: string[], since?: string, until?: string, author?: string, allAuthors?: boolean, dryRun?: boolean, maxDepth?: number }
```

**流程**：
1. 获取插件实例
2. 调用 `plugin.collect()`
3. 返回采集结果

#### 5.3 `GET /api/reports`

返回历史报告列表（从 SQLite 查询）。

#### 5.4 `GET /api/data-sources`

返回所有数据源插件状态。

#### 5.5 `GET /api/config` / `POST /api/config`

读取/更新配置。

### 6. 前端页面

#### 6.1 首页 Dashboard（`src/app/page.tsx`）

- 显示已连接的数据源状态
- 快速生成报告按钮（本周周报 / 今日日报 / 本月月报）
- 最近生成的报告列表

#### 6.2 报告管理页（`src/app/reports/page.tsx`）

- 报告列表（类型、日期、记录数）
- 点击查看详情（使用 `react-markdown` 渲染）
- 重新生成按钮

#### 6.3 数据源管理页（`src/app/data-sources/page.tsx`）

- 显示所有数据源（Git ✅, Task ⏳, Calendar ⏳, Doc ⏳）
- Git 插件配置（路径设置）
- 手动采集按钮

#### 6.4 配置页（`src/app/settings/page.tsx`）

- API Key / Base URL / Model 配置
- 定时任务管理

## Assumptions & Decisions

1. **100% TypeScript**：所有 Python 文件已删除，不再保留任何 Python 代码或依赖
2. **技术栈**：Next.js App Router + TypeScript + SQLite (Prisma) + openai SDK + node-cron + react-markdown
3. **无认证**：单用户模式，无需登录系统
4. **Git 子应用路径引用**：仍通过 `config.git.path` 指向 `../git-weekly-automation`
5. **核心逻辑完全用 TypeScript 实现**：不通过 child_process 调用 Python
6. **定时任务**：macOS launchd → node-cron（进程内调度）
7. **报告存储**：SQLite（元数据） + 本地 `.md` 文件（内容）
8. **UI 框架**：Tailwind CSS + shadcn/ui（简洁现代风格）

## Verification Steps

1. 初始化 Next.js 项目，确认能正常启动（`npm run dev`）
2. 验证 Prisma + SQLite 连接正常（`npx prisma migrate dev`）
3. 测试 TypeScript 核心模块：
   - `src/lib/dates.ts` — 正确计算周/日/月范围
   - `src/lib/templates.ts` — 正确加载模板并填充占位符
   - `src/lib/ai-engine.ts` — 能调用 OpenAI 兼容 API（使用 dry-run 测试）
4. 测试 Git 插件：
   - `src/plugins/git.ts` — 正确读取 `data/commits/*.jsonl`
   - `formatForPrompt()` — 正确按仓库分组
5. 测试 API Routes：
   - `POST /api/generate` — dry-run 模式返回正确 prompt
   - `POST /api/collect` — 能委托采集器
   - `GET /api/reports` — 返回报告列表
6. 测试前端页面：
   - Dashboard 显示数据源状态
   - 点击生成报告能调用 API 并展示结果
   - 报告管理页能渲染 Markdown
7. 端到端测试：从首页点击"生成本周周报" → 查看生成结果
