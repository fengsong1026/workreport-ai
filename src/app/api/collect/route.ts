/**
 * 数据采集 API
 * POST /api/collect
 */

import { NextRequest, NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry";
import type { CollectArgs } from "@/lib/plugin";
import { requireUser } from "@/lib/auth";
import { CollectSchema, parseBody } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = parseBody(CollectSchema, body);
  if (!parsed.success) return parsed.response;

  const pluginName = parsed.data.plugin || "git";

  const registry = getRegistry();
  const plugin = registry.get(pluginName);
  if (!plugin) {
    return NextResponse.json({ error: `未知插件: ${pluginName}` }, { status: 400 });
  }
  if (!plugin.meta.isAvailable) {
    return NextResponse.json(
      { error: `插件 [${plugin.meta.displayName}] 尚在规划中，无法采集` },
      { status: 400 },
    );
  }

  const args: CollectArgs = { scan: [], allAuthors: true, dryRun: false, userId: user.id };
  try {
    const count = await plugin.collect(args);
    return NextResponse.json({ success: true, message: `同步完成，共 ${count} 个仓库`, count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
