/**
 * 数据源管理 API
 *
 * GET  /api/data-sources          列出所有数据源插件 + 连接状态
 * POST /api/data-sources          更新数据源配置（仓库选择 / 断开连接）
 */

import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry";
import { prisma } from "@/lib/prisma";
import { OAUTH_PROVIDERS } from "@/lib/oauth-providers";
import { requireUser } from "@/lib/auth";

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

  // 读取 DB 中的连接状态（仅当前用户）
  const dsRows = await prisma.dataSource.findMany({
    where: { userId: user.id },
  });
  const connections = new Map(dsRows.map((r) => [r.name, r]));

  // 为每个插件附加连接信息
  const result = plugins.map((p) => {
    const conn = connections.get(p.name);
    if (!conn) {
      return { ...p, connected: false };
    }

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
      } catch {
        // config 解析失败，忽略
      }
    }

    return {
      ...p,
      connected: conn.connected,
      ...extra,
    };
  });

  // 所有 OAuth provider 的连接状态（不含 github，github 走专用路由在 plugins 里）
  const providers = Object.values(OAUTH_PROVIDERS).map((cfg) => {
    const conn = connections.get(cfg.name);
    return {
      name: cfg.name,
      displayName: cfg.displayName,
      plugin: cfg.plugin,
      connected: conn?.connected || false,
      special: cfg.special || false,
      docsUrl: cfg.docsUrl || null,
    };
  });

  return NextResponse.json({ plugins: result, providers });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json();
  const { name, action, repos } = body as {
    name: string;
    action?: "select-repos" | "disconnect";
    repos?: number[];
  };

  if (!name) {
    return NextResponse.json({ error: "缺少 name 参数" }, { status: 400 });
  }

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
    const cfg = JSON.parse(row.config) as {
      token: string;
      user: { login: string; name: string | null; email: string | null };
      repos: Array<{ id: number; fullName: string; selected: boolean }>;
    };

    const selectedIds = new Set(repos || []);
    cfg.repos = cfg.repos.map((r) => ({
      ...r,
      selected: selectedIds.has(r.id),
    }));

    await prisma.dataSource.update({
      where: { userId_name: { userId: user.id, name } },
      data: { config: JSON.stringify(cfg) },
    });

    return NextResponse.json({
      success: true,
      message: `已选择 ${selectedIds.size} 个仓库`,
      selectedCount: selectedIds.size,
    });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
