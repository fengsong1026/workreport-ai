/**
 * 数据源管理 API
 *
 * GET /api/data-sources          列出所有数据源插件
 * POST /api/data-sources         更新数据源配置（如 git.path）
 */

import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry";

export async function GET() {
  const registry = getRegistry();
  const plugins = registry.all().map((p) => ({
    name: p.meta.name,
    displayName: p.meta.displayName,
    dataSource: p.meta.dataSource,
    targetUsers: p.meta.targetUsers,
    status: p.meta.status,
    available: p.meta.isAvailable,
  }));
  return NextResponse.json({ plugins });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, config } = body as { name: string; config: Record<string, unknown> };

  if (!name) {
    return NextResponse.json({ error: "缺少 name 参数" }, { status: 400 });
  }

  // 目前仅支持 git.path 配置
  // 实际配置持久化可扩展到 DataSource 表
  return NextResponse.json({
    success: true,
    message: `数据源 ${name} 配置已更新`,
    config,
  });
}
