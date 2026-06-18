# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

WorkReport AI is a plugin-based platform that auto-generates work reports (daily/weekly/monthly) from job data sources. Each job role maps to a data-source plugin; all plugins share one AI generation engine. The only landed plugin is **Git**, which fetches commit data via **GitHub OAuth + REST API** — zero local dependencies (no git, no Python, no local repos required).

**100% TypeScript** — Next.js App Router + Prisma + SQLite + openai SDK + node-cron.

## Architecture

```
GitHub OAuth ──► token stored in DB
                      │
user selects repos ──► plugin.collect() syncs repo list via GitHub API
                      │
report generation ──► plugin.read() calls GitHub Commits API ──► WorkRecord[]
                      │
                   plugin.formatForPrompt() ──► grouped by repo
                      │
                   ai-engine.generateReport() ──► templates/*.md ──► reports/*.md
```

- **Plugin interface** (`src/lib/plugin.ts`): `DataSourcePlugin` interface. Each plugin implements `collect()`, `read()`, `formatForPrompt()`, `stats()`. Metadata via `PluginMeta` (name, displayName, dataSource, targetUsers, status: "done"|"planned").
- **Registry** (`src/lib/registry.ts`): explicitly registers plugin instances (no dynamic import). `getRegistry()` returns a singleton.
- **AI engine** (`src/lib/ai-engine.ts`): shared. Template fill → prompt build → OpenAI-compatible `/v1/chat/completions` call via `openai` SDK. Config priority: DB > env var > defaults.
- **Git plugin** (`src/plugins/git.ts`): GitHub OAuth + API. `collect()` syncs repo list via `GET /user/repos`; `read()` fetches commits via `GET /repos/{owner}/{repo}/commits` for selected repos; `formatForPrompt()` groups by repo. Token and repo selection stored in `DataSource.config` (JSON) in SQLite.
- **GitHub API client** (`src/lib/github.ts`): encapsulates OAuth token exchange, user info, repo listing, commit listing. All calls use `Authorization: Bearer <token>`. OAuth config (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`) read from environment variables — no hardcoded fallbacks.
- **OAuth flow** (`src/app/api/oauth/github/route.ts` + `src/app/api/oauth/callback/github/route.ts`): standard GitHub OAuth 2.0. State stored in httpOnly cookie for CSRF protection. Token stored in `DataSource` table on callback.
- **Scheduler** (`src/lib/scheduler.ts`): node-cron (in-process). Schedule strings like "Fri 17:00" parsed to cron expressions. Tasks persisted in SQLite via Prisma.
- **Database** (`prisma/schema.prisma`): SQLite via Prisma. Models: `Config`, `Report`, `DataSource`, `ScheduledTask`.

## Common commands

```bash
npm run dev                                      # start dev server
npm run build                                    # production build
npx prisma migrate dev                           # apply schema
npx prisma db push                               # push schema without migration
npx prisma studio                                # DB GUI

# API testing (replace <host> with your dev server address)
curl <host>/api/data-sources
curl -X POST <host>/api/generate -H 'Content-Type: application/json' -d '{"type":"weekly","allAuthors":true,"dryRun":true}'
```

## Config

`.env` (gitignored) holds `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_API_BASE`, `OPENAI_MODEL`, and GitHub OAuth vars (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`). All values must be provided via environment variables — no hardcoded fallbacks. The DB `Config` table (managed via /settings page) overrides env vars at runtime. The git plugin reads its OAuth token and selected repos from the `DataSource` table (name="git", config JSON).

### GitHub OAuth setup

1. Go to https://github.com/settings/developers → OAuth Apps → New OAuth App
2. Set Authorization callback URL to match `GITHUB_REDIRECT_URI` in `.env`
3. Copy Client ID and Client Secret to `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

## Data format

Plugins normalize to `WorkRecord` objects with standard fields: `source`, `timestamp` (ISO 8601), `title`, `detail`, `project`, `author`, `email`, `raw`. The git plugin maps GitHub API commit fields (`sha`, `commit.author`, `commit.message`, `html_url`) into these fields, with `raw` holding `{ sha, login, html_url }`. Planned plugins should write to `data/sources/<plugin>/YYYY-WXX.jsonl` via `src/lib/storage.ts`.

## Adding a plugin

1. Create `src/plugins/<name>.ts` exporting a class implementing `DataSourcePlugin`.
2. Set `meta` (PluginMeta with status "planned" until landed).
3. Register in `PLUGIN_FACTORIES` in `src/lib/registry.ts`.
4. If the plugin needs OAuth, create routes under `src/app/api/oauth/<name>/` and `src/app/api/oauth/callback/<name>/`.

## Python compatibility

**No Python.** This project is 100% TypeScript. All data sources are accessed via cloud APIs (GitHub REST API, future: Jira/Linear/Google/Notion OAuth).
