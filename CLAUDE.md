# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

WorkReport AI is a plugin-based platform that auto-generates work reports (daily/weekly/monthly) from job data sources. Each job role maps to a data-source plugin; all plugins share one AI generation engine. The only landed plugin is **Git** (Git Weekly Automation), which lives in the sibling directory `../git-weekly-automation` and is referenced by path — its code is NOT copied into this repo.

**100% TypeScript** — Next.js App Router + Prisma + SQLite + openai SDK + node-cron.

## Architecture

```
data sources ──► plugin.collect() ──► data/ ──► plugin.read() ──► plugin.formatForPrompt()
                                                                     │
                                                   ai-engine.generateReport()
                                                                     │
                                                   templates/*.md ──► reports/*.md
```

- **Plugin interface** (`src/lib/plugin.ts`): `DataSourcePlugin` interface. Each plugin implements `collect()`, `read()`, `formatForPrompt()`, `stats()`. Metadata via `PluginMeta` (name, displayName, dataSource, targetUsers, status: "done"|"planned").
- **Registry** (`src/lib/registry.ts`): explicitly registers plugin instances (no dynamic import). `getRegistry()` returns a singleton.
- **AI engine** (`src/lib/ai-engine.ts`): shared. Template fill → prompt build → OpenAI-compatible `/v1/chat/completions` call via `openai` SDK. Config priority: DB > env var > defaults.
- **Git plugin** (`src/plugins/git.ts`): path-references `../git-weekly-automation`. `collect()` shells out to its `scripts/collect-commits` via `child_process.execFile`; `read()` reads its `data/commits/*.jsonl` directly; `formatForPrompt()` groups by repo. The global Git Hook install is still done via the sibling's `scripts/setup`.
- **Scheduler** (`src/lib/scheduler.ts`): node-cron (in-process). Schedule strings like "Fri 17:00" parsed to cron expressions. Tasks persisted in SQLite via Prisma.
- **Database** (`prisma/schema.prisma`): SQLite via Prisma. Models: `Config`, `Report`, `DataSource`, `ScheduledTask`.

## Common commands

```bash
npm run dev                                      # start dev server
npm run build                                    # production build
npx prisma migrate dev                           # apply schema
npx prisma db push                               # push schema without migration
npx prisma studio                                # DB GUI

# API testing
curl localhost:3000/api/data-sources
curl -X POST localhost:3000/api/generate -H 'Content-Type: application/json' -d '{"type":"weekly","allAuthors":true,"dryRun":true}'
```

## Config

`.env` (gitignored) holds `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_API_BASE`, `OPENAI_MODEL`. The DB `Config` table (managed via /settings page) overrides env vars at runtime. The git plugin reads `config.git.path` (default `../git-weekly-automation`, relative to this project) to locate the sibling project.

## Data format

Plugins normalize to `WorkRecord` objects with standard fields: `source`, `timestamp` (ISO 8601), `title`, `detail`, `project`, `author`, `email`, `raw`. The git plugin maps the sibling's JSONL fields (`hash`, `message`, `repo`, `branch`, etc.) into `raw` while populating the standard fields. Planned plugins should write to `data/sources/<plugin>/YYYY-WXX.jsonl` via `src/lib/storage.ts`.

## Adding a plugin

1. Create `src/plugins/<name>.ts` exporting a class implementing `DataSourcePlugin`.
2. Set `meta` (PluginMeta with status "planned" until landed).
3. Register in `PLUGIN_FACTORIES` in `src/lib/registry.ts`.
4. Add a `plugins.<name>` entry in `config.example.json` (if config needed).

## Python compatibility

**No Python.** This project is 100% TypeScript. The only external Python dependency is the sibling `git-weekly-automation` collector script, invoked via `child_process.execFile` for historical data collection.
