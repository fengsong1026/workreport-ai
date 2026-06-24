# 用户系统实现计划

## Summary

当前项目完全没有用户系统——所有数据（报告、数据源配置、OAuth token、定时任务）都是全局共享的，任何人访问即可操作。本计划实现一套完整的用户系统（注册/登录/个人中心），并将报告、数据源配置、OAuth token 等数据与用户关联。AI 配置（Config）保持全局共享，不引入管理员角色。

## Current State Analysis

### 数据存储现状

| 表 | 存储内容 | 用户关联 | 问题 |
|---|---|---|---|
| Config | AI API Key/Model 等 | 无 | 全局共享（用户选择保持） |
| Report | 生成的报告内容 | 无 | 所有用户共享所有报告 |
| DataSource | OAuth token + 仓库选择 | 无 | 所有用户共享所有 OAuth token |
| ScheduledTask | 定时任务 | 无 | 所有用户共享所有定时任务 |

### 认证现状
- 无 User 模型
- 无 middleware.ts
- 无任何认证库（package.json 无 next-auth/jose/bcrypt）
- 所有 API 公开可访问

## Proposed Changes

### 技术选型
- **JWT 库**：`jose`（纯 JS，兼容 Next.js Edge Runtime，middleware 可用）
- **密码哈希**：`bcryptjs`（纯 JS，Docker alpine 兼容，无需原生编译）
- **会话存储**：httpOnly cookie（JWT token），7 天有效期

### 1. 安装依赖

```bash
npm install jose bcryptjs
npm install -D @types/bcryptjs
```

### 2. 修改 Prisma Schema

文件：`prisma/schema.prisma`

- **新增 User 模型**：
  ```prisma
  model User {
    id           String   @id @default(cuid())
    email        String   @unique
    name         String
    passwordHash String
    createdAt    DateTime @default(now())
    updatedAt    DateTime @default(now()) @updatedAt
    reports      Report[]
    dataSources  DataSource[]
    tasks        ScheduledTask[]
  }
  ```

- **Report 添加 userId**：
  ```prisma
  model Report {
    // ... 现有字段
    userId String
    user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
    @@index([userId, type])
    @@index([userId, createdAt])
  }
  ```

- **DataSource 添加 userId，复合唯一约束**：
  ```prisma
  model DataSource {
    // ... 现有字段
    userId String
    user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
    @@unique([userId, name])  // 替换原来的 name @unique
    @@index([userId])
  }
  ```

- **ScheduledTask 添加 userId**：
  ```prisma
  model ScheduledTask {
    // ... 现有字段
    userId String
    user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
    @@unique([userId, name])
    @@index([userId])
  }
  ```

- **Config 保持不变**（全局共享）

### 3. 新增 `src/lib/auth.ts` — 认证工具

核心函数：
- `signToken(userId)` — 用 jose 签发 JWT，7 天有效期
- `verifyToken(token)` — 验证 JWT，返回 userId
- `hashPassword(password)` — bcryptjs 哈希
- `verifyPassword(password, hash)` — bcryptjs 验证
- `getSessionUser(req)` — 从 cookie 读取 JWT，返回 User 或 null
- `requireUser(req)` — 获取当前用户，未登录抛 401

环境变量：`JWT_SECRET`（如未设置则用 `dev-secret-change-me`，生产环境必须设置）

### 4. 新增 `src/middleware.ts` — 认证中间件

- **放行路径**：`/login`, `/register`, `/api/auth/*`
- **保护路径**：所有其他 `/` 页面和 `/api/*` API
- 未登录访问页面 → 重定向到 `/login?redirect=<原路径>`
- 未登录访问 API → 返回 401 JSON

### 5. 新增认证 API

- `src/app/api/auth/register/route.ts` — POST 注册
  - 校验 email 唯一性、密码长度 ≥ 6
  - 哈希密码，创建 User
  - 签发 JWT，设置 cookie
  - 返回用户信息（不含 passwordHash）

- `src/app/api/auth/login/route.ts` — POST 登录
  - 查找 User by email
  - 验证密码
  - 签发 JWT，设置 cookie
  - 返回用户信息

- `src/app/api/auth/logout/route.ts` — POST 登出
  - 清除 cookie

### 6. 新增页面

- `src/app/login/page.tsx` — 登录页（email + 密码）
- `src/app/register/page.tsx` — 注册页（name + email + 密码）
- `src/app/profile/page.tsx` — 个人中心
  - 显示用户信息（name, email, 注册时间）
  - 修改名称
  - 修改密码（需输入旧密码）
  - 显示统计（报告数、数据源连接数）

### 7. 修改现有 API — 关联用户

- `src/app/api/generate/route.ts`：
  - 从 session 获取 userId
  - `prisma.report.create` 时添加 `userId`

- `src/app/api/reports/route.ts`：
  - GET：`where: { userId }` 只返回当前用户的报告
  - DELETE：`where: { id, userId }` 只能删除自己的报告

- `src/app/api/data-sources/route.ts`：
  - GET：`where: { userId }` 只返回当前用户的数据源
  - POST：`where: { userId, name }` 只能操作自己的数据源
  - upsert 时带 userId

- `src/app/api/oauth/callback/github/route.ts`：
  - 从 session 获取 userId
  - `prisma.dataSource.upsert` where 从 `{ name: "git" }` 改为 `{ userId_name: { userId, name: "git" } }`

- `src/app/api/oauth/callback/[provider]/route.ts`：
  - 同上，upsert where 改为复合唯一约束

- `src/app/api/oauth/github/route.ts` 和 `src/app/api/oauth/[provider]/route.ts`：
  - 添加 userId 检查（未登录不允许发起 OAuth）

### 8. 修改 `src/app/layout.tsx` — 导航栏

- 读取 session 用户
- 未登录：显示"登录"按钮
- 已登录：显示用户名 + 下拉菜单（个人中心、登出）

### 9. 数据库迁移

```bash
npx prisma db push  # 开发阶段直接 push，会清空现有数据
```

### 10. 更新 `.env.example`

添加 `JWT_SECRET` 占位

## Assumptions & Decisions

1. **Config 保持全局共享** — 用户选择，所有用户共用一套 AI 配置
2. **无管理员角色** — 所有用户平等，自注册即可使用
3. **自实现 JWT** — 不引入 next-auth，用 jose + bcryptjs 轻量实现
4. **现有数据清空** — 项目开发阶段无生产数据，`prisma db push` 直接重建
5. **OAuth 回调从 session cookie 读用户** — 用户发起 OAuth 前已登录，回调时 session cookie 仍在同一浏览器
6. **DataSource 复合唯一约束** — `@@unique([userId, name])` 替代原 `name @unique`，不同用户可连接同一 provider
7. **JWT_SECRET** — 从环境变量读取，开发环境有默认值，生产环境必须设置

## Verification

1. `npx prisma db push` 成功，schema 生效
2. `npm run lint` 无错误
3. `npx tsc --noEmit` 无类型错误
4. 注册流程：访问 /register → 填写信息 → 注册成功 → 自动登录 → 跳转首页
5. 登录流程：访问 /login → 输入凭据 → 登录成功 → 跳转首页
6. 鉴权保护：未登录访问 / → 重定向到 /login
7. 数据隔离：用户 A 连接 GitHub → 用户 B 登录看不到 A 的数据源
8. OAuth 关联：登录后连接 GitHub → token 存入当前用户的 DataSource
9. 报告隔离：用户 A 生成报告 → 用户 B 看不到
10. 个人中心：查看/修改个人信息，修改密码
