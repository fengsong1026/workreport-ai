# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

WorkReport AI is a plugin-based platform that auto-generates work reports (daily/weekly/monthly) from job data sources. Each job role maps to a data-source plugin; all plugins share one AI generation engine. The only landed plugin is **Git**, which fetches commit data via **GitHub OAuth + REST API** — zero local dependencies (no git, no Python, no local repos required).

**100% TypeScript** — Next.js App Router + Prisma + SQLite + openai SDK + node-cron.

## Common commands

```bash
npm run dev                                      # start dev server on port 8907
npm run build                                    # production build
npm run test                                     # run tests (vitest run)
npm run test:watch                               # run tests in watch mode
npm run check                                    # full CI check: tsc + lint + test + build
npx tsc --noEmit                                 # type-check without emitting
npx prisma db push                               # push schema without migration
npx prisma db migrate                            # run Prisma migrations (for schema changes)
npx prisma studio                                # DB GUI

# Docker
docker compose up -d --build                     # build & start container
docker compose logs -f                           # view logs
docker compose down                              # stop

# API testing (token required for protected endpoints)
curl -X POST <host>/api/auth/login -H 'Content-Type: application/json' -d '{"email":"a@b.com","password":"12345678"}'
curl <host>/api/data-sources -H 'Authorization: Bearer <token>'
curl -X POST <host>/api/generate -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '{"type":"weekly","allAuthors":true,"dryRun":true}'
```

### Pre-commit hooks

Husky + lint-staged: on `git commit`, runs `tsc --noEmit` then `eslint --fix` on staged `.ts/.tsx` files. Configured in `.husky/pre-commit` and `.lintstagedrc.json`.

## Architecture

### Auth system (token-based, no cookies)

- **JWT** stored in `localStorage` (key: `wr_token`), sent via `Authorization: Bearer <token>` header.
- **`src/lib/auth.ts`** — server-side: `signToken()`, `verifyToken()`, `extractBearerToken()`, `getSessionUser()`, `requireUser()`, `hashPassword()`, `verifyPassword()`. No cookie helpers.
- **`src/lib/auth-client.ts`** — client-side: `getToken()`, `setToken()`, `removeToken()`, `isAuthenticated()` (checks existence + JWT expiry via `isTokenExpired()`), `authFetch()` (wraps `fetch` with Bearer header; on 401 dispatches `auth:unauthorized` event), `isSafeRedirect()` (open-redirect guard).
- **`src/lib/rate-limit.ts`** — in-memory rate limiter used by login (5/15min), register (3/15min), generate (10/hour).
- **`src/lib/crypto.ts`** — AES-256-GCM encrypt/decrypt for OAuth tokens at rest in SQLite.
- **`src/app/components/AuthGuard.tsx`** — client component wrapping protected pages. Checks `isAuthenticated()` on mount, listens for `auth:unauthorized` events, redirects to `/login` via `router.push()`.
- **`src/middleware.ts`** — Edge runtime. All page routes pass through (client AuthGuard protects them). API routes (`/api/*`) check `Authorization: Bearer` header via `jose.jwtVerify()`. Public API prefixes: `/api/auth/`, `/api/health`, `/api/oauth/`.
- Login/register return `{ user, token }` in JSON body. Client stores token then does `router.push()`.

### Data flow

```
GitHub OAuth ──► token encrypted & stored in DB (DataSource.config)
                      │
user selects repos ──► plugin.collect() syncs repo list via GitHub API
                      │
report generation ──► plugin.read() calls GitHub Commits API ──► WorkRecord[]
                      │
                   plugin.formatForPrompt() ──► grouped by repo
                      │
                   ai-engine.generateReport() ──► templates/*.md ──► DB + reports/*.md
```

### Key modules

- **`src/lib/plugin.ts`** — `DataSourcePlugin` interface: `collect()`, `read()`, `formatForPrompt()`, `stats()`. `PluginMeta` for metadata.
- **`src/lib/registry.ts`** — explicit singleton plugin registry (no dynamic imports). All plugin factories listed in `PLUGIN_FACTORIES` array.
- **`src/lib/models.ts`** — shared types: `WorkRecord` (source/timestamp/title/detail/project/author/email/raw), `PluginMeta` class, `TimeRange` class.
- **`src/lib/dates.ts`** — ISO week/day/month range calculation: `getWeekRange()`, `getDayRange()`, `getMonthRange()`, `getRange()`.
- **`src/lib/ai-engine.ts`** — shared AI engine. Template fill → prompt → OpenAI-compatible `/v1/chat/completions`. Config priority: DB > env var > defaults. Has 60s timeout.
- **`src/lib/generate.ts`** — `generateReportForUser(userId, options)` is the single entry point for report generation. Loads plugin → computes date range → reads records → calls AI engine → writes `.md` file → writes DB → rolls back `.md` on DB failure. Used by both `/api/generate` and scheduled tasks.
- **`src/lib/github.ts`** — GitHub API client: OAuth token exchange, user info, repo listing, commit listing. `listCommits()` max 10 pages (1000 commits). 401/403 throw errors rather than silently returning `[]`.
- **`src/lib/scheduler.ts`** — node-cron. `parseSchedule()` converts human-readable strings ("Fri 17:00") to cron. Timezone via `process.env.TZ || "Asia/Shanghai"`.
- **`src/lib/scheduler-runner.ts`** — bridges DB `ScheduledTask` records to the node-cron `Scheduler`. `startScheduledTask()` / `stopScheduledTask()` / `loadAndStartAllTasks()`.
- **`src/lib/storage.ts`** — JSONL storage for future plugins. Uses Promise-chain write queue for concurrent-write safety.
- **`src/lib/templates.ts`** — `fillTemplate()` with `{{PLACEHOLDER}}` substitution. Escapes `{{` in user content.
- **`src/lib/oauth.ts`** — generic OAuth helpers: `getRequestOrigin()` (x-forwarded detection), `buildAuthorizeUrl()`, `exchangeCodeForToken()`.
- **`src/lib/oauth-providers.ts`** — `OAUTH_PROVIDERS` registry: GitLab, Jira, Linear, Feishu, Google Calendar, WeCom, Notion, Yuque. Each entry defines endpoints, scopes, env var prefix, and token auth mode (body vs Basic).
- **`src/lib/schemas.ts`** — Zod validation schemas for all API routes (`LoginSchema`, `RegisterSchema`, `GenerateSchema`, `ScheduleCreateSchema`, etc.) plus `parseBody()` helper. Every POST/PATCH route uses this — returns validated data or a 400 Response.
- **`src/lib/prisma.ts`** — Prisma client singleton (uses `globalThis` to survive Next.js dev-mode hot reload).
- **`src/instrumentation.ts`** — Next.js startup hook (Node.js runtime only). Calls `loadAndStartAllTasks()` on server start to resume persisted cron jobs from DB.

### Database

SQLite via Prisma. Models: `User`, `Config`, `Report`, `DataSource`, `ScheduledTask`.

- `User` — email/password auth with bcrypt hash.
- `DataSource` — per-user plugin connections. `@@unique([userId, name])` composite key. `config` JSON holds encrypted OAuth tokens + repo selection. Plugins load config via `findUnique({ where: { userId_name: { userId, name } } })` — never by `id` alone.
- `ScheduledTask` — cron tasks with `userId` ownership. Unique on `userId + name`.
- `Report` — generated reports with `userId`, `type`, `label`, `dateRange`, `content`, stats.

### API routes

| Route | Method | Auth | Notes |
|-------|--------|------|-------|
| `/api/auth/login` | POST | Public | Rate limited. Returns `{ user, token }` |
| `/api/auth/register` | POST | Public | Rate limited. Email regex, password ≥8, name ≤100 |
| `/api/auth/logout` | POST | Public | Client-side token removal |
| `/api/auth/me` | GET | Bearer | Returns user + stats |
| `/api/auth/password` | POST | Bearer | Password change (min 8) |
| `/api/auth/profile` | PATCH | Bearer | Name update (max 100) |
| `/api/generate` | POST | Bearer | Rate limited (10/hr). `dryRun` flag for preview |
| `/api/collect` | POST | Bearer | Trigger plugin data sync |
| `/api/reports` | GET/DELETE | Bearer | List (limit ≤200), detail, delete. Ownership checked |
| `/api/data-sources` | GET/POST | Bearer | List plugins + connection status, select repos, disconnect |
| `/api/schedule` | GET/POST | Bearer | List/create cron tasks. Name ≤200 |
| `/api/schedule/[id]` | PATCH/DELETE | Bearer | Update/delete. Ownership verified |
| `/api/oauth/github` | GET | Public | GitHub OAuth initiation |
| `/api/oauth/callback/github` | GET | Public | GitHub OAuth callback |
| `/api/oauth/[provider]` | GET | Public | Generic OAuth initiation (GitLab, Jira, Linear, etc.) |
| `/api/oauth/callback/[provider]` | GET | Public | Generic OAuth callback |
| `/api/health` | GET | Public | Returns 200 if DB ok, 503 if not |

### Adding a new API route — checklist

1. Define Zod schema in `src/lib/schemas.ts`
2. Use `parseBody(schema, body)` — on failure returns a 400 `Response`, so check: `if (parsed instanceof Response) return parsed` (or use `result.success` pattern)
3. POST/PATCH routes: wrap `req.json()` in try/catch → 400 on malformed JSON
4. Mutating routes: verify resource ownership (`userId` match) before acting
5. Add rate limit if user-facing and potentially expensive
6. Add to middleware's public prefix list only if truly unauthenticated

### Security patterns

- All POST/PATCH routes wrap `req.json()` in try/catch → 400 on malformed JSON.
- `redirect` query param in login/register validated via `isSafeRedirect()` — rejects external origins.
- `getRequestOrigin()` only trusts `x-forwarded-host` when `x-forwarded-proto` is also present.
- OAuth tokens encrypted at rest with AES-256-GCM (key derived from `JWT_SECRET`).
- `JWT_SECRET` falls back to `"dev-secret-change-me"` in development only; throws in production if unset.
- All mutating API routes verify resource ownership (userId matching).
- `JSON.parse()` on DB config fields wrapped in try/catch.

## Docker deployment

- **Dockerfile**: multi-stage (deps → builder → runner), `node:18-alpine`, `NODE_ENV=production`.
- **docker-entrypoint.sh**: runs `prisma db push --skip-generate` → `npm start`.
- **docker-compose.yml**: mounts `./data/db` and `./data/reports` for persistence. Health check on `/api/health`. Port `8088:3000`.
- Production must set `JWT_SECRET` env var (enforced at runtime).

## Config

`.env` (gitignored): `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_API_BASE`, `OPENAI_MODEL`, `JWT_SECRET`, GitHub OAuth vars. `DB Config` table overrides env vars at runtime.

## Adding a plugin

1. Create `src/plugins/<name>.ts` implementing `DataSourcePlugin`.
2. Set `meta` (PluginMeta with `status: "planned"` until landed).
3. Register in `PLUGIN_FACTORIES` in `src/lib/registry.ts`.
4. If the plugin needs OAuth, create routes under `src/app/api/oauth/<name>/` and `src/app/api/oauth/callback/<name>/`.
