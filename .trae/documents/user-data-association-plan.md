# 用户数据关联 — 剩余实现计划

## Summary

用户系统的基础设施已落地（User 模型、JWT 认证、middleware、注册/登录/个人中心页面与 API）。本计划完成**最后一步：将现有业务数据（报告、数据源配置、OAuth token）与登录用户关联**，并修复一个原计划遗漏的关键问题——**插件层按 userId 查询 DataSource**。

## Current State Analysis（已验证）

### 已完成（无需改动）
- `prisma/schema.prisma`：User 模型 + Report/DataSource/ScheduledTask 的 userId 关系 + 复合唯一约束 `@@unique([userId, name])`
- `src/lib/auth.ts`：signToken / verifyToken / hashPassword / verifyPassword / getSessionUser / requireUser / cookie 工具
- `src/middleware.ts`：保护所有路由（放行 `/login` `/register` `/api/auth/*`），未登录返回 401 或重定向
- `src/app/api/auth/{register,login,logout,me,profile,password}/route.ts`：全部创建
- `src/app/{login,register,profile}/page.tsx`：全部创建
- `.env.example`：已加 `JWT_SECRET`

### 关键问题：插件层查询 DataSource 仍用 `where: { name }`（会编译/运行报错）

`name` 字段不再是 `@unique`，改为 `@@unique([userId, name])`。以下调用会失败：

| 文件 | 行 | 当前代码 | 问题 |
|---|---|---|---|
| `src/plugins/git.ts` | 51 | `findUnique({ where: { name: "git" } })` | name 不再唯一 |
| `src/plugins/git.ts` | 91 | `update({ where: { name: "git" } })` | name 不再唯一 |
| `src/app/api/data-sources/route.ts` | 88 | `findUnique({ where: { name } })` | name 不再唯一 |
| `src/app/api/oauth/callback/github/route.ts` | 72 | `upsert({ where: { name: "git" } })` | name 不再唯一 |
| `src/app/api/oauth/callback/[provider]/route.ts` | 76 | `upsert({ where: { name: provider } })` | name 不再唯一 |

### 业务 API 未关联用户

| 文件 | 问题 |
|---|---|
| `src/app/api/generate/route.ts` | 未取 userId；`prisma.report.create` 无 userId；`p.read()` 未传 userId |
| `src/app/api/reports/route.ts` | GET 未按 userId 过滤；DELETE 未校验归属 |
| `src/app/api/data-sources/route.ts` | GET `findMany()` 无过滤；POST 未带 userId |
| `src/app/api/collect/route.ts` | 未取 userId；`plugin.collect(args)` 未传 userId |
| `src/app/api/oauth/callback/*/route.ts` | upsert 未带 userId |
| `src/app/layout.tsx` | 导航栏无用户状态 |

### 插件接口需传入 userId

`DataSourcePlugin.read()` 和 `collect()` 当前无法获知 userId，导致 git 插件无法定位当前用户的 DataSource。需在接口中增加可选 `userId` 参数。

> TypeScript 兼容性：接口方法增加可选参数后，stub 插件（task/calendar/doc）的方法签名参数更少，仍可赋值给接口类型，**无需修改 stub 插件**。

## Proposed Changes

### 1. 修改插件接口 — 传入 userId

**文件：`src/lib/plugin.ts`**

- `CollectArgs` 增加字段：`userId?: string`
- `read()` 签名增加可选参数：`read(since: Date, until: Date, email?: string, userId?: string): Promise<WorkRecord[]>`

```ts
export interface CollectArgs {
  scan: string[];
  since?: string;
  until?: string;
  author?: string;
  allAuthors: boolean;
  dryRun: boolean;
  maxDepth?: number;
  userId?: string;   // ← 新增
}

export interface DataSourcePlugin {
  readonly meta: PluginMeta;
  collect(args: CollectArgs): Promise<number>;
  read(since: Date, until: Date, email?: string, userId?: string): Promise<WorkRecord[]>;  // ← 新增 userId
  formatForPrompt(records: WorkRecord[]): string;
  stats(records: WorkRecord[]): { count: number; projectCount: number };
}
```

### 2. 修改 Git 插件 — 按 userId 查询 DataSource

**文件：`src/plugins/git.ts`**

- `loadConfig(userId?: string)`：改用复合唯一键
  ```ts
  const row = await prisma.dataSource.findUnique({
    where: { userId_name: { userId: userId!, name: "git" } },
  });
  ```
- `read(since, until, email, userId?)`：将 userId 传给 loadConfig
- `collect(args)`：从 `args.userId` 取 userId，传给 loadConfig；`update` 的 where 改为 `{ userId_name: { userId, name: "git" } }`

### 3. 修改 generate API — 关联用户

**文件：`src/app/api/generate/route.ts`**

- 顶部 import `{ requireUser }` from `@/lib/auth`
- POST 开头：`const user = await requireUser(req); if (user instanceof NextResponse) return user;`
- `p.read(timeRange.start, timeRange.end, email)` → `p.read(timeRange.start, timeRange.end, email, user.id)`
- `prisma.report.create({ data: { ..., userId: user.id } })`

### 4. 修改 collect API — 关联用户

**文件：`src/app/api/collect/route.ts`**

- import `{ requireUser }` from `@/lib/auth`
- POST 开头：`const user = await requireUser(req); if (user instanceof NextResponse) return user;`
- `args.userId = user.id` 后再 `plugin.collect(args)`

### 5. 修改 reports API — 按用户过滤

**文件：`src/app/api/reports/route.ts`**

- import `{ requireUser }` from `@/lib/auth`
- GET：取 userId；单条查询 `findUnique({ where: { id } })` 后校验 `report.userId === user.id`（不匹配返回 404）；列表查询 `where: { userId: user.id, ...(type ? { type } : {}) }`
- DELETE：取 userId；`prisma.report.delete({ where: { id, userId: user.id } })`（Prisma 支持复合 where 删除，不归属则抛错→404）

### 6. 修改 data-sources API — 按用户过滤 + 复合键

**文件：`src/app/api/data-sources/route.ts`**

- import `{ requireUser }` from `@/lib/auth`
- GET：取 userId；`findMany({ where: { userId: user.id } })`
- POST：取 userId；`findUnique({ where: { userId_name: { userId: user.id, name } } })`；`update({ where: { userId_name: { userId: user.id, name } } })`

### 7. 修改 OAuth 回调 — 关联用户

**文件：`src/app/api/oauth/callback/github/route.ts`**

- import `{ getSessionUser }` from `@/lib/auth`
- 回调开头：`const user = await getSessionUser(req); if (!user) return NextResponse.redirect(new URL("/login?redirect=/data-sources", req.url));`
- upsert 改为：
  ```ts
  await prisma.dataSource.upsert({
    where: { userId_name: { userId: user.id, name: "git" } },
    create: { name: "git", displayName: "Git (GitHub)", status: "done", connected: true, config, userId: user.id },
    update: { connected: true, config },
  });
  ```

**文件：`src/app/api/oauth/callback/[provider]/route.ts`**

- 同上模式：`getSessionUser` → 未登录重定向 → upsert 用 `userId_name` 复合键 + create 带 `userId`

> 说明：OAuth 发起路由 `/api/oauth/github` 和 `/api/oauth/[provider]` 已被 middleware 保护（未登录返回 401），无需额外改动。回调时浏览器仍携带 session cookie（用户发起 OAuth 前已登录），故 `getSessionUser` 可成功取到 userId。

### 8. 修改导航栏 — 显示用户状态

**新建文件：`src/app/components/UserNav.tsx`**（client component）

- 调用 `GET /api/auth/me`
- 未登录：显示「登录」链接
- 已登录：显示用户名 + 「个人中心」+ 「退出」链接
- loading 时不渲染用户区，避免闪烁

**修改文件：`src/app/layout.tsx`**

- import `UserNav` 组件
- 在导航栏右侧（`<div className="flex items-center gap-6 text-sm">` 之后）插入 `<UserNav />`

### 9. 数据库迁移 + 验证

```bash
npx prisma db push     # 重建 schema（开发阶段清空现有数据，符合计划假设）
npm run lint
npx tsc --noEmit
```

## Assumptions & Decisions

1. **插件接口增加可选 userId 参数** — 原计划遗漏点；用可选参数保证 stub 插件无需改动（TS 协变兼容）
2. **OAuth 回调用 `getSessionUser` 而非 `requireUser`** — 回调是 GET 重定向，需返回 redirect 而非 JSON 401
3. **导航栏用 client 组件 `UserNav`** — 避免 server layout 引入 DB 查询，保持 layout 纯静态；额外一次 `/api/auth/me` 请求可接受
4. **reports DELETE 用 `{ id, userId }` 复合 where** — Prisma 支持唯一键 + 普通字段组合删除，不归属自动失败
5. **Config 保持全局** — 不加 userId，沿用原计划决策
6. **ScheduledTask 暂无 API** — 当前无 API 创建/查询定时任务，schema 已加 userId，未来 API 落地时再关联

## Verification

1. `npx prisma db push` 成功
2. `npm run lint` 无错误
3. `npx tsc --noEmit` 无类型错误
4. 注册 → 登录 → 导航栏显示用户名
5. 连接 GitHub → token 存入当前用户 DataSource → 切换用户后看不到对方数据源
6. 生成报告 → 报告归属当前用户 → 切换用户后看不到对方报告
7. 未登录访问 `/api/generate` → 401
8. 个人中心显示正确的报告数 / 数据源数
