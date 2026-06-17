/**
 * 数据采集 API
 *
 * POST /api/collect
 *
 * 请求体：
 *   { plugin: "git", scan: string[], since?, until?, author?, allAuthors?, dryRun?, maxDepth? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry";
import type { CollectArgs } from "@/lib/plugin";

interface CollectBody {
  plugin?: string;
  scan?: string[];
  since?: string;
  until?: string;
  author?: string;
  allAuthors?: boolean;
  dryRun?: boolean;
  maxDepth?: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CollectBody;
  const pluginName = body.plugin || "git";

  const registry = getRegistry();
  const plugin = registry.get(pluginName);
  if (!plugin) {
    return NextResponse.json(
      { error: `未知插件: ${pluginName}` },
      { status: 400 },
    );
  }
  if (!plugin.meta.isAvailable) {
    return NextResponse.json(
      { error: `插件 [${plugin.meta.displayName}] 尚在规划中，无法采集` },
      { status: 400 },
    );
  }

  const args: CollectArgs = {
    scan: body.scan || [],
    since: body.since,
    until: body.until,
    author: body.author,
    allAuthors: body.allAuthors || false,
    dryRun: body.dryRun || false,
    maxDepth: body.maxDepth,
  };

  try {
    // collect 委托给插件，返回的状态通过 stdout 输出
    await plugin.collect(args);
    return NextResponse.json({
      success: true,
      message: `采集完成（插件: ${plugin.meta.displayName}）`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
