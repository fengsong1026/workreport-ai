/**
 * 生成报告 API
 * POST /api/generate
 *
 * 限流：每用户 10 次/小时
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateReportForUser } from "@/lib/generate";
import { checkRateLimit } from "@/lib/rate-limit";
import { GenerateSchema, parseBody } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  // 速率限制（按用户 ID）
  if (!checkRateLimit(`generate:${user.id}`, 10, 60 * 60_000)) {
    return NextResponse.json(
      { error: "报告生成过于频繁，请稍后再试" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = parseBody(GenerateSchema, body);
  if (!parsed.success) return parsed.response;

  const result = await generateReportForUser(user.id, {
    type: parsed.data.type || "weekly",
    week: parsed.data.week,
    year: parsed.data.year,
    month: parsed.data.month,
    plugin: parsed.data.plugin,
    allAuthors: parsed.data.allAuthors,
    author: parsed.data.author,
    dryRun: parsed.data.dryRun,
  });

  if (!result.success) {
    const status = result.error?.includes("没有找到") ? 404 : 500;
    return NextResponse.json(
      { error: result.error, stats: result.stats.timeRange ? { timeRange: result.stats.timeRange } : undefined },
      { status },
    );
  }

  if (parsed.data.dryRun) {
    return NextResponse.json({ dryRun: true, prompt: result.content, stats: result.stats });
  }

  return NextResponse.json({
    success: true, reportId: result.reportId, content: result.content,
    stats: result.stats, filePath: result.filePath,
  });
}
