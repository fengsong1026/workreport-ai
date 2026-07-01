/**
 * 数据源管理 API
 * GET  /api/data-sources  列出所有数据源插件 + 连接状态
 * POST /api/data-sources  更新数据源配置（仓库选择 / 断开连接）
 */

import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry";
import { prisma } from "@/lib/prisma";
import { OAUTH_PROVIDERS } from "@/lib/oauth-providers";
import { requireUser } from "@/lib/auth";
import { DataSourcesPostSchema, parseBody } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const registry = getRegistry();
  const plugins = registry.all().map((p) => ({
    name: p.meta.name,
    displayName: p.meta.displayName,
    dataSource: p.meta.dataSource,
    targetUsers: p.meta.targetUsers,
    status: p.meta.status,
    available: p.meta.isAvailable,
  }));

  const dsRows = await prisma.dataSource.findMany({ where: { userId: user.id } });
  const connections = new Map(dsRows.map((r) => [r.name, r]));

  const result = plugins.map((p) => {
    const conn = connections.get(p.name);
    if (!conn) return { ...p, connected: false };

    let extra: Record<string, unknown> = {};
    if (p.name === "git" && conn.connected) {
      try {
        const cfg = JSON.parse(conn.config) as {
          user?: { login?: string; name?: string | null };
          repos?: Array<{ id: number; fullName: string; selected: boolean }>;
        };
        extra = {
          user: cfg.user,
          repoCount: cfg.repos?.length || 0,
          selectedRepoCount: cfg.repos?.filter((r) => r.selected).length || 0,
          repos: cfg.repos || [],
        };
      } catch { /* config 解析失败，忽略 */ }
    }
    return { ...p, connected: conn.connected, ...extra };
  });

  const providers = Object.values(OAUTH_PROVIDERS).map((cfg) => {
    const conn = connections.get(cfg.name);
    return {
      name: cfg.name, displayName: cfg.displayName, plugin: cfg.plugin,
      connected: conn?.connected || false, special: cfg.special || false,
      docsUrl: cfg.docsUrl || null,
    };
  });

  return NextResponse.json({ plugins: result, providers });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = parseBody(DataSourcesPostSchema, body);
  if (!parsed.success) return parsed.response;

  const { name, action, repos } = parsed.data;

  const row = await prisma.dataSource.findUnique({
    where: { userId_name: { userId: user.id, name } },
  });
  if (!row) {
    return NextResponse.json({ error: `数据源 ${name} 未找到` }, { status: 404 });
  }

  if (action === "disconnect") {
    await prisma.dataSource.update({
      where: { userId_name: { userId: user.id, name } },
      data: { connected: false },
    });
    return NextResponse.json({ success: true, message: `${name} 已断开连接` });
  }

  if (action === "select-repos" && name === "git") {
    let cfg: {
      token: string;
      user: { login: string; name: string | null; email: string | null };
      repos: Array<{ id: number; fullName: string; selected: boolean }>;
    };
    try {
      cfg = JSON.parse(row.config);
    } catch {
      return NextResponse.json({ error: "数据源配置损坏，请重新连接" }, { status: 500 });
    }

    const selectedIds = new Set(repos || []);
    cfg.repos = cfg.repos.map((r) => ({ ...r, selected: selectedIds.has(r.id) }));

    await prisma.dataSource.update({
      where: { userId_name: { userId: user.id, name } },
      data: { config: JSON.stringify(cfg) },
    });

    return NextResponse.json({
      success: true, message: `已选择 ${selectedIds.size} 个仓库`, selectedCount: selectedIds.size,
    });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
